import type { ClassificationResult, ConfidenceResult, InventoryItem, ValidationFinding } from "./types.ts";

export function scoreConfidence(
  inventory: InventoryItem[],
  classifications: ClassificationResult[],
  findings: ValidationFinding[],
): ConfidenceResult {
  let score = 100;
  const fatoresPositivos: string[] = [];
  const fatoresRedutores: string[] = [];

  const supportedRatio = inventory.length === 0 ? 0 : inventory.filter((item) => item.suportado).length / inventory.length;
  const classifiedRatio = classifications.length === 0
    ? 0
    : classifications.filter((item) => item.categoria !== "OUTROS").length / classifications.length;
  const highConfidenceRatio = classifications.length === 0
    ? 0
    : classifications.filter((item) => item.confianca === "alta").length / classifications.length;

  if (supportedRatio >= 0.9) fatoresPositivos.push("inventario_estavel");
  else {
    score -= 10;
    fatoresRedutores.push("inventario_com_arquivos_nao_suportados");
  }

  if (classifiedRatio >= 0.7) fatoresPositivos.push("classificacao_ampla");
  else {
    score -= 15;
    fatoresRedutores.push("muitos_arquivos_sem_classificacao_util");
  }

  if (highConfidenceRatio >= 0.4) fatoresPositivos.push("classificacao_contextual_consistente");
  else {
    score -= 10;
    fatoresRedutores.push("classificacao_com_baixa_firmeza");
  }

  const blockers = findings.filter((item) => item.severidade === "bloqueante").length;
  const alerts = findings.filter((item) => item.severidade === "alerta").length;

  score -= blockers * 20;
  score -= alerts * 5;

  if (blockers === 0) fatoresPositivos.push("sem_bloqueios_formais");
  if (alerts > 0) fatoresRedutores.push(`alertas_formais:${alerts}`);
  if (blockers > 0) fatoresRedutores.push(`bloqueios_formais:${blockers}`);

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  const nivel = score >= 85 ? "alta" : score >= 75 ? "media" : "baixa";

  return {
    score,
    aprovadoMinimo: score >= 75 && blockers === 0,
    nivel,
    fatoresPositivos,
    fatoresRedutores,
  };
}
