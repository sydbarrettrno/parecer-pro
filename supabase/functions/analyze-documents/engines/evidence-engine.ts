import type { ClassificationResult, EvidenceRecord, InventoryItem } from "./types.ts";

export function buildEvidenceMap(
  processoId: string,
  inventory: InventoryItem[],
  classifications: ClassificationResult[],
): EvidenceRecord[] {
  const evidence: EvidenceRecord[] = [];
  const classificationByFile = new Map(classifications.map((item) => [item.arquivoId, item]));

  for (const item of inventory) {
    evidence.push({
      processoId,
      arquivoId: item.arquivoId,
      chave: "inventory.file_detected",
      valor: item.nomeOriginal,
      tipoFonte: "inventory",
      trecho: item.diretorio || null,
      confianca: "alta",
    });

    evidence.push({
      processoId,
      arquivoId: item.arquivoId,
      chave: "inventory.extension",
      valor: item.extensao,
      tipoFonte: "inventory",
      trecho: item.basename,
      confianca: "alta",
    });

    for (const warning of item.avisos) {
      evidence.push({
        processoId,
        arquivoId: item.arquivoId,
        chave: "inventory.warning",
        valor: warning,
        tipoFonte: "inventory",
        trecho: item.nomeOriginal,
        confianca: "media",
      });
    }

    const classification = classificationByFile.get(item.arquivoId);
    if (classification) {
      evidence.push({
        processoId,
        arquivoId: item.arquivoId,
        chave: "classification.category",
        valor: classification.categoria,
        tipoFonte: "classification",
        trecho: classification.motivos.join(", ") || null,
        confianca: classification.confianca,
      });
    }
  }

  const grouped: Record<string, number> = {};
  for (const item of classifications) grouped[item.categoria] = (grouped[item.categoria] || 0) + 1;

  for (const [categoria, quantidade] of Object.entries(grouped)) {
    evidence.push({
      processoId,
      arquivoId: null,
      chave: "summary.category_count",
      valor: `${categoria}:${quantidade}`,
      tipoFonte: "summary",
      trecho: null,
      confianca: "alta",
    });
  }

  return evidence;
}
