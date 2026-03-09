import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const normalize = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// ── HIGH-PRIORITY filename rules (checked BEFORE folder rules) ──
// These override folder-based classification when a filename clearly indicates a different category
const HIGH_PRIORITY_FILENAME_RULES: [string, string][] = [
  ["cronograma", "CRONOGRAMA"],
  ["art", "RESPONSABILIDADE_TECNICA"],
  ["rrt", "RESPONSABILIDADE_TECNICA"],
];

// ── Folder-path-based rules ──
const FOLDER_CATEGORY_MAP: Record<string, string> = {
  "/md/": "MEMORIAL_OU_TR",
  "/dre/": "DRENAGEM",
  "/cat/": "CADASTRO_TOPOGRAFIA",
  "/urb_sin/": "URBANIZACAO_SINALIZACAO",
  "/urb/": "URBANIZACAO_SINALIZACAO",
  "/sin/": "URBANIZACAO_SINALIZACAO",
  "/orc/": "ORCAMENTO",
  "/cro/": "CRONOGRAMA",
  "/adm/": "ADMINISTRATIVO",
};

// ── Standard filename keyword rules (checked after folder) ──
const FILENAME_RULES: [string, string][] = [
  ["orcamento sintetico", "ORCAMENTO"],
  ["orc sintetico", "ORCAMENTO"],
  ["composicoes", "ORCAMENTO"],
  ["composicao", "ORCAMENTO"],
  ["curva abc", "ORCAMENTO"],
  ["memoria de calculo", "ORCAMENTO"],
  ["mem calculo", "ORCAMENTO"],
  ["cotacoes", "ORCAMENTO"],
  ["cotacao", "ORCAMENTO"],
  ["dmt", "ORCAMENTO"],
  ["bdi", "ORCAMENTO"],
  ["orcamento", "ORCAMENTO"],
  ["planilha", "ORCAMENTO"],
  ["sinapi", "ORCAMENTO"],
  ["memorial", "MEMORIAL_OU_TR"],
  ["termo de referencia", "MEMORIAL_OU_TR"],
  ["projeto basico", "MEMORIAL_OU_TR"],
  ["projeto executivo", "MEMORIAL_OU_TR"],
  ["drenagem", "DRENAGEM"],
  ["topografia", "CADASTRO_TOPOGRAFIA"],
  ["cadastro", "CADASTRO_TOPOGRAFIA"],
  ["planialtimetrico", "CADASTRO_TOPOGRAFIA"],
  ["levantamento", "CADASTRO_TOPOGRAFIA"],
  ["urbanizacao", "URBANIZACAO_SINALIZACAO"],
  ["sinalizacao", "URBANIZACAO_SINALIZACAO"],
  ["pavimentacao", "URBANIZACAO_SINALIZACAO"],
];

// ── Classification: high-priority filename → folder path → filename keywords ──
function classifyDocument(filename: string): string {
  const normalizedPath = normalize(filename);
  const normalizedFilename = normalize(filename.split("/").pop() || filename);

  // 1) High-priority filename rules (e.g. "cronograma" inside /orc/ folder)
  for (const [pattern, category] of HIGH_PRIORITY_FILENAME_RULES) {
    if (normalizedFilename.includes(pattern)) {
      return category;
    }
  }

  // 2) Folder path
  for (const [folder, category] of Object.entries(FOLDER_CATEGORY_MAP)) {
    if (normalizedPath.includes(folder)) {
      return category;
    }
  }

  // 3) Filename keywords
  for (const [pattern, category] of FILENAME_RULES) {
    if (normalizedFilename.includes(pattern)) {
      return category;
    }
  }

  return "OUTROS";
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { processo_id } = await req.json();
    if (!processo_id) {
      return new Response(JSON.stringify({ error: "processo_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: processo, error: procErr } = await supabase
      .from("processos")
      .select("*")
      .eq("id", processo_id)
      .single();
    if (procErr) throw procErr;

    const { data: arquivos, error: arqErr } = await supabase
      .from("arquivos")
      .select("*")
      .eq("processo_id", processo_id);
    if (arqErr) throw arqErr;

    // Classify each file
    const classifiedFiles: { nome: string; categoria: string }[] = [];

    for (const arq of arquivos) {
      const categoria = classifyDocument(arq.nome_original);
      await supabase
        .from("arquivos")
        .update({ categoria })
        .eq("id", arq.id);
      classifiedFiles.push({ nome: arq.nome_original, categoria });
    }

    // Build discipline list
    const disciplineMap: Record<string, string> = {
      DRENAGEM: "drenagem",
      URBANIZACAO_SINALIZACAO: "urbanização e sinalização",
      CADASTRO_TOPOGRAFIA: "cadastro e topografia",
      MEMORIAL_OU_TR: "memorial descritivo / termo de referência",
      ORCAMENTO: "orçamento e composição de custos",
      CRONOGRAMA: "cronograma físico-financeiro",
      RESPONSABILIDADE_TECNICA: "responsabilidade técnica (ART/RRT)",
      ADMINISTRATIVO: "documentos administrativos",
    };
    const presentCategories = [...new Set(classifiedFiles.map((f) => f.categoria))];
    const presentDisciplines = presentCategories
      .filter((c) => disciplineMap[c])
      .map((c) => disciplineMap[c]);

    // Group files by category for AI context
    const filesByCategory: Record<string, string[]> = {};
    classifiedFiles.forEach((f) => {
      if (!filesByCategory[f.categoria]) filesByCategory[f.categoria] = [];
      filesByCategory[f.categoria].push(f.nome);
    });

    const categoryBreakdown = Object.entries(filesByCategory)
      .map(([cat, files]) => `${cat} (${files.length} doc${files.length > 1 ? 's' : ''}):\n${files.map(f => `  - ${f}`).join("\n")}`)
      .join("\n\n");

    // Identify missing categories for completeness analysis
    const expectedCategories = ["MEMORIAL_OU_TR", "ORCAMENTO", "CRONOGRAMA"];
    const missingCategories = expectedCategories.filter(c => !presentCategories.includes(c));
    const missingInfo = missingCategories.length > 0
      ? `CATEGORIAS AUSENTES: ${missingCategories.map(c => disciplineMap[c] || c).join(", ")}`
      : "TODAS AS CATEGORIAS ESSENCIAIS ESTÃO PRESENTES";

    // ── Enhanced AI prompt ──
    const prompt = `Você é um analista técnico sênior especializado em processos licitatórios de obras públicas, com profundo conhecimento da Lei nº 14.133/2021.

INFORMAÇÕES DO PROCESSO:
- Nome: ${processo.nome_processo}
- Número: ${processo.numero_processo}
- Órgão: ${processo.orgao}
- Secretaria: ${processo.secretaria}

DOCUMENTOS CLASSIFICADOS POR CATEGORIA:
${categoryBreakdown}

DISCIPLINAS IDENTIFICADAS: ${presentDisciplines.join(", ") || "nenhuma identificada"}
${missingInfo}

CAMPOS A EXTRAIR — responda com um array JSON:

1. "objeto_contratacao" — Construa uma descrição técnica completa do objeto da contratação.
   REGRAS:
   - NÃO repita simplesmente o nome do processo
   - Use as disciplinas identificadas para compor a descrição
   - Identifique o local/logradouro a partir do nome do processo
   - Formato esperado: "Execução de serviços de [disciplinas] da/do [local], no município de [município se identificável]"
   - Confiança: "alta"

2. "numero_processo" — Use exatamente: "${processo.numero_processo}". Confiança: "alta"

3. "orgao_responsavel" — Use exatamente: "${processo.orgao}". Confiança: "alta"

4. "secretaria_responsavel" — Use exatamente: "${processo.secretaria}". Confiança: "alta"

5. "valor_estimado" — Analise os nomes dos arquivos de orçamento.
   - Se há orçamento sintético, mencione que existe e indique os documentos.
   - Se há versões com e sem desoneração, mencione ambas.
   - Se não conseguir identificar valor numérico, diga: "Valor a ser verificado nos documentos de orçamento sintético identificados: [lista dos docs]"
   - Confiança: "baixa" se sem valor, "media" se referenciou documentos

6. "responsavel_tecnico" — Verifique se há ART/RRT nos documentos.
   - Se sim: "A ser verificado nos documentos de responsabilidade técnica identificados: [docs]"
   - Se não: "Não foram identificados documentos de responsabilidade técnica (ART/RRT)"
   - Confiança: "baixa"

7. "analise_completude" — Faça uma análise de completude documental:
   - Liste categorias presentes e ausentes
   - Para cada categoria ausente, indique a importância para o processo licitatório
   - Se alguma peça essencial está ausente (como cronograma separado, ART/RRT), recomende complementação
   - Confiança: "alta"

8. "regime_tributario" — Analise os nomes dos documentos de orçamento:
   - Identifique se há versões desoneradas e sem desoneração
   - Indique qual parece ser o regime adotado
   - Confiança: "media"

INSTRUÇÕES:
- Responda APENAS com um array JSON, sem markdown, sem explicações
- Formato: [{"campo":"...","valor":"...","origem_documento":"...","confianca":"alta|media|baixa"}]
- A origem_documento deve indicar de quais documentos você inferiu a informação
- Seja técnico, preciso e detalhado nas respostas`;

    let extractedData: any[] = [];

    try {
      console.log("Calling Lovable AI gateway with enhanced prompt...");
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (aiResponse.ok) {
        const aiResult = await aiResponse.json();
        const content = aiResult.choices?.[0]?.message?.content || "";
        console.log("AI response received, length:", content.length);
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        }
      } else {
        const errStatus = aiResponse.status;
        const errText = await aiResponse.text();
        console.error("AI gateway error:", errStatus, errText);
      }
    } catch (aiErr) {
      console.error("AI analysis error:", aiErr);
    }

    // Fallback if AI fails
    if (extractedData.length === 0) {
      const objetoFallback = presentDisciplines.length > 0
        ? `Execução de serviços de ${presentDisciplines.join(", ")} – ${processo.nome_processo}`
        : processo.nome_processo;

      extractedData = [
        { campo: "objeto_contratacao", valor: objetoFallback, origem_documento: "Inferido dos documentos classificados", confianca: "media" },
        { campo: "numero_processo", valor: processo.numero_processo, origem_documento: "Cadastro do processo", confianca: "alta" },
        { campo: "orgao_responsavel", valor: processo.orgao, origem_documento: "Cadastro do processo", confianca: "alta" },
        { campo: "secretaria_responsavel", valor: processo.secretaria, origem_documento: "Cadastro do processo", confianca: "alta" },
        { campo: "valor_estimado", valor: "Não foi possível identificar. Verificar orçamento sintético.", origem_documento: null, confianca: "baixa" },
        { campo: "responsavel_tecnico", valor: "Não foram identificados documentos de responsabilidade técnica.", origem_documento: null, confianca: "baixa" },
      ];
    }

    // Clear old extracted data & insert new
    await supabase.from("dados_extraidos").delete().eq("processo_id", processo_id);

    for (const item of extractedData) {
      await supabase.from("dados_extraidos").insert({
        processo_id,
        campo: item.campo,
        valor: item.valor,
        origem_documento: item.origem_documento || null,
        confianca: item.confianca || "media",
      });
    }

    await supabase
      .from("processos")
      .update({ status: "revisao" })
      .eq("id", processo_id);

    return new Response(
      JSON.stringify({
        success: true,
        extracted: extractedData.length,
        filesProcessed: arquivos.length,
        classifications: classifiedFiles,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);

    try {
      const { processo_id } = await req.clone().json().catch(() => ({}));
      if (processo_id) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        await supabase.from("processos").update({ status: "erro" }).eq("id", processo_id);
      }
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
