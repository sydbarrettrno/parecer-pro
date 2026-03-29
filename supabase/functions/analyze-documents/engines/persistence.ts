import type {
  ClassificationResult,
  ConfidenceResult,
  EvidenceRecord,
  InventoryItem,
  ProcessoRow,
  ValidationFinding,
} from "./types.ts";

export async function replaceInventory(supabase: any, processoId: string, items: InventoryItem[]) {
  await supabase.from("document_inventory").delete().eq("processo_id", processoId);
  if (items.length === 0) return;

  await supabase.from("document_inventory").insert(
    items.map((item) => ({
      processo_id: processoId,
      arquivo_id: item.arquivoId,
      nome_original: item.nomeOriginal,
      nome_normalizado: item.nomeNormalizado,
      caminho_normalizado: item.caminhoNormalizado,
      extensao: item.extensao,
      diretorio: item.diretorio,
      suportado: item.suportado,
      avisos: item.avisos,
    })),
  );
}

export async function replaceEvidences(supabase: any, processoId: string, evidence: EvidenceRecord[]) {
  await supabase.from("document_evidences").delete().eq("processo_id", processoId);
  if (evidence.length === 0) return;

  await supabase.from("document_evidences").insert(
    evidence.map((item) => ({
      processo_id: item.processoId,
      arquivo_id: item.arquivoId,
      chave: item.chave,
      valor: item.valor,
      tipo_fonte: item.tipoFonte,
      trecho: item.trecho,
      confianca: item.confianca,
    })),
  );
}

export async function replaceFindings(supabase: any, processoId: string, findings: ValidationFinding[]) {
  await supabase.from("validation_findings").delete().eq("processo_id", processoId);
  if (findings.length === 0) return;

  await supabase.from("validation_findings").insert(
    findings.map((item) => ({
      processo_id: item.processoId,
      codigo: item.codigo,
      severidade: item.severidade,
      descricao: item.descricao,
      categoria_relacionada: item.categoriaRelacionada,
      arquivos_relacionados: item.arquivosRelacionados,
      evidencias: item.evidencias,
    })),
  );
}

export async function replaceDadosExtraidos(
  supabase: any,
  processo: ProcessoRow,
  objeto: string,
  confidence: ConfidenceResult,
  findings: ValidationFinding[],
) {
  await supabase.from("dados_extraidos").delete().eq("processo_id", processo.id);

  const analiseCompletude = findings
    .map((item) => `${item.codigo}: ${item.descricao}`)
    .join("\n");

  const enquadramento = confidence.aprovadoMinimo
    ? "FAVORÁVEL AO PROSSEGUIMENTO"
    : findings.some((item) => item.severidade === "bloqueante")
    ? "DESFAVORÁVEL AO PROSSEGUIMENTO POR INSUFICIÊNCIA DOCUMENTAL OBJETIVAMENTE CONSTATADA"
    : "FAVORÁVEL AO PROSSEGUIMENTO, CONDICIONADO À JUNTADA DOCUMENTAL EXPRESSAMENTE IDENTIFICADA";

  const rows = [
    {
      processo_id: processo.id,
      campo: "objeto_contratacao",
      valor: objeto,
      origem_documento: "Motor de análise documental",
      confianca: confidence.nivel,
    },
    {
      processo_id: processo.id,
      campo: "numero_processo",
      valor: processo.numero_processo,
      origem_documento: "Cadastro do processo",
      confianca: "alta",
    },
    {
      processo_id: processo.id,
      campo: "orgao_responsavel",
      valor: processo.orgao,
      origem_documento: "Cadastro do processo",
      confianca: "alta",
    },
    {
      processo_id: processo.id,
      campo: "secretaria_responsavel",
      valor: processo.secretaria,
      origem_documento: "Cadastro do processo",
      confianca: "alta",
    },
    {
      processo_id: processo.id,
      campo: "analise_completude",
      valor: analiseCompletude || "Sem pendências formais detectadas por metadado.",
      origem_documento: "Validation Engine",
      confianca: confidence.nivel,
    },
    {
      processo_id: processo.id,
      campo: "score_confianca_geral",
      valor: String(confidence.score),
      origem_documento: "Confidence Engine",
      confianca: confidence.nivel,
    },
    {
      processo_id: processo.id,
      campo: "enquadramento_documental",
      valor: enquadramento,
      origem_documento: "Confidence Engine + Validation Engine",
      confianca: confidence.nivel,
    },
  ];

  await supabase.from("dados_extraidos").insert(rows);
}
