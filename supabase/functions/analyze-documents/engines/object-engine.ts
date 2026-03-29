import type { ClassificationResult, ProcessoRow } from "./types.ts";

const LABELS: Record<string, string> = {
  DRENAGEM: "drenagem",
  URBANIZACAO_SINALIZACAO: "urbanização e sinalização",
  CADASTRO_TOPOGRAFIA: "cadastro e topografia",
  MEMORIAL_OU_TR: "memorial descritivo",
  TERMO_DE_REFERENCIA: "termo de referência",
};

export function inferObject(processo: ProcessoRow, classifications: ClassificationResult[]): string {
  const disciplinas = Array.from(
    new Set(
      classifications
        .map((item) => LABELS[item.categoria])
        .filter(Boolean),
    ),
  );

  if (disciplinas.length === 0) return processo.nome_processo;
  return `Execução de serviços de ${disciplinas.join(", ")} para o processo ${processo.numero_processo}.`;
}
