import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildInventory, summarizeInventory } from "./engines/inventory-engine.ts";
import { classifyInventory } from "./engines/classifier-engine.ts";
import { buildEvidenceMap } from "./engines/evidence-engine.ts";
import { runValidations } from "./engines/validation-engine.ts";
import { scoreConfidence } from "./engines/confidence-engine.ts";
import { inferObject } from "./engines/object-engine.ts";
import { selectFilesForReanalysis } from "./engines/reanalysis-engine.ts";
import {
  replaceDadosExtraidos,
  replaceEvidences,
  replaceFindings,
  replaceInventory,
} from "./engines/persistence.ts";
import type { ArquivoRow, ProcessoRow } from "./engines/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );

  try {
    const body = await req.json();
    const processoId = body.processo_id as string | undefined;
    const reanalysisFileIds = body.file_ids as string[] | undefined;
    const reanalysisCategories = body.categorias as string[] | undefined;

    if (!processoId) {
      return new Response(JSON.stringify({ error: "processo_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: processo, error: processoError } = await supabase
      .from("processos")
      .select("id, nome_processo, numero_processo, orgao, secretaria")
      .eq("id", processoId)
      .single<ProcessoRow>();

    if (processoError || !processo) throw processoError || new Error("processo não encontrado");

    const { data: arquivos, error: arquivosError } = await supabase
      .from("arquivos")
      .select("id, processo_id, nome_original, extensao, storage_path, categoria, hash")
      .eq("processo_id", processoId)
      .returns<ArquivoRow[]>();

    if (arquivosError) throw arquivosError;
    const arquivosSelecionados = selectFilesForReanalysis({
      arquivosAtuais: arquivos || [],
      arquivoIdsSolicitados: reanalysisFileIds,
      categoriasAfetadas: reanalysisCategories,
    });

    if (arquivosSelecionados.length === 0) {
      return new Response(JSON.stringify({ error: "nenhum arquivo elegível para análise" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("processos").update({ status: "analisando" }).eq("id", processoId);

    const context = { processo, arquivos: arquivosSelecionados };
    const inventory = buildInventory(context);
    const classifications = classifyInventory(inventory);

    for (const item of classifications) {
      await supabase.from("arquivos").update({ categoria: item.categoria }).eq("id", item.arquivoId);
    }

    const evidence = buildEvidenceMap(processoId, inventory, classifications);
    const findings = runValidations(processo, classifications);
    const confidence = scoreConfidence(inventory, classifications, findings);
    const objeto = inferObject(processo, classifications);
    const inventorySummary = summarizeInventory(inventory);

    await replaceInventory(supabase, processoId, inventory);
    await replaceEvidences(supabase, processoId, evidence);
    await replaceFindings(supabase, processoId, findings);
    await replaceDadosExtraidos(supabase, processo, objeto, confidence, findings);

    await supabase.from("analysis_runs").insert({
      processo_id: processoId,
      escopo: reanalysisFileIds?.length ? "seletiva_por_arquivo" : reanalysisCategories?.length ? "seletiva_por_categoria" : "completa",
      score_confianca: confidence.score,
      aprovado_minimo: confidence.aprovadoMinimo,
      resumo_json: {
        inventorySummary,
        classifications,
        findings,
        confidence,
      },
    });

    await supabase.from("processos").update({ status: "revisao" }).eq("id", processoId);

    return new Response(JSON.stringify({
      success: true,
      processo_id: processoId,
      total_arquivos: inventorySummary.totalArquivos,
      score_confianca: confidence.score,
      aprovado_minimo: confidence.aprovadoMinimo,
      findings,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
