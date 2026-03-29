import type { ClassificationResult, ProcessoRow, ValidationFinding } from "./types.ts";

function relatedFileIds(classifications: ClassificationResult[], category: string): string[] {
  return classifications.filter((item) => item.categoria === category).map((item) => item.arquivoId);
}

function hasCategory(classifications: ClassificationResult[], category: string): boolean {
  return classifications.some((item) => item.categoria === category);
}

export function runValidations(
  processo: ProcessoRow,
  classifications: ClassificationResult[],
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  const hasTR = hasCategory(classifications, "TERMO_DE_REFERENCIA");
  const hasMemorial = hasCategory(classifications, "MEMORIAL_OU_TR");
  const hasBudget = hasCategory(classifications, "ORCAMENTO");
  const hasSchedule = hasCategory(classifications, "CRONOGRAMA");
  const hasTechnicalResponsibility = hasCategory(classifications, "RESPONSABILIDADE_TECNICA");
  const hasQuotation = hasCategory(classifications, "COTACAO_OU_PROPOSTA");
  const hasTechnicalProject = classifications.some((item) =>
    ["DRENAGEM", "CADASTRO_TOPOGRAFIA", "URBANIZACAO_SINALIZACAO"].includes(item.categoria),
  );

  if (!hasTR && !hasMemorial) {
    findings.push({
      processoId: processo.id,
      codigo: "ESC_POCA_BASE_TECNICA_AUSENTE",
      severidade: "bloqueante",
      descricao: "Não foi identificada base técnica documental mínima para caracterização formal do objeto.",
      categoriaRelacionada: "BASE_TECNICA_DOCUMENTAL",
      arquivosRelacionados: [],
      evidencias: ["Ausência simultânea de TERMO_DE_REFERENCIA e MEMORIAL_OU_TR."],
    });
  }

  if (!hasBudget) {
    findings.push({
      processoId: processo.id,
      codigo: "ORC_AUSENTE",
      severidade: "bloqueante",
      descricao: "Não foi identificado documento orçamentário formalmente classificável.",
      categoriaRelacionada: "ORCAMENTO_E_CUSTOS",
      arquivosRelacionados: [],
      evidencias: ["Ausência da categoria ORCAMENTO."],
    });
  }

  if (hasBudget && !hasSchedule) {
    findings.push({
      processoId: processo.id,
      codigo: "CRO_AUSENTE",
      severidade: "alerta",
      descricao: "Há orçamento classificado, porém não foi identificado cronograma físico-financeiro por metadado documental.",
      categoriaRelacionada: "PLANEJAMENTO_DA_CONTRATACAO",
      arquivosRelacionados: relatedFileIds(classifications, "ORCAMENTO"),
      evidencias: ["ORCAMENTO presente sem CRONOGRAMA correspondente."],
    });
  }

  if (hasTechnicalProject && !hasTechnicalResponsibility) {
    findings.push({
      processoId: processo.id,
      codigo: "ART_RRT_AUSENTE",
      severidade: "alerta",
      descricao: "Foram identificadas peças técnicas por disciplina, mas não foi localizada responsabilidade técnica correspondente por nome de arquivo.",
      categoriaRelacionada: "RESPONSABILIDADE_TECNICA",
      arquivosRelacionados: classifications
        .filter((item) => ["DRENAGEM", "CADASTRO_TOPOGRAFIA", "URBANIZACAO_SINALIZACAO"].includes(item.categoria))
        .map((item) => item.arquivoId),
      evidencias: ["Peças técnicas presentes sem categoria RESPONSABILIDADE_TECNICA."],
    });
  }

  if (hasBudget && !hasQuotation) {
    findings.push({
      processoId: processo.id,
      codigo: "COT_BASE_NAO_IDENTIFICADA",
      severidade: "alerta",
      descricao: "Há orçamento classificado, mas não foram identificadas cotações ou propostas por metadado documental.",
      categoriaRelacionada: "DETERMINACAO_DOS_CUSTOS",
      arquivosRelacionados: relatedFileIds(classifications, "ORCAMENTO"),
      evidencias: ["ORCAMENTO presente sem COTACAO_OU_PROPOSTA."],
    });
  }

  if (classifications.every((item) => item.categoria === "OUTROS")) {
    findings.push({
      processoId: processo.id,
      codigo: "CLASSIFICACAO_INSUFICIENTE",
      severidade: "bloqueante",
      descricao: "O conjunto documental não produziu classificação mínima aproveitável.",
      categoriaRelacionada: "CLASSIFICACAO",
      arquivosRelacionados: classifications.map((item) => item.arquivoId),
      evidencias: ["Todos os arquivos permaneceram em OUTROS."],
    });
  }

  if (findings.length === 0) {
    findings.push({
      processoId: processo.id,
      codigo: "VALIDACAO_OK",
      severidade: "ok",
      descricao: `Conjunto documental de ${processo.numero_processo} sem inconsistência formal bloqueante detectada por metadado.` ,
      categoriaRelacionada: null,
      arquivosRelacionados: [],
      evidencias: ["Regras mínimas atendidas."],
    });
  }

  return findings;
}
