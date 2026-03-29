import type { ArquivoRow, EngineContext, InventoryItem } from "./types.ts";
import { normalizeText, toTokenList } from "./text-utils.ts";

const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".odt"];

function getDirectory(path: string): string {
  const normalized = path.split("\\").join("/");
  const parts = normalized.split("/");
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

function getBasename(path: string): string {
  const normalized = path.split("\\").join("/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

function buildWarnings(file: ArquivoRow): string[] {
  const warnings: string[] = [];
  const ext = file.extensao.toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) warnings.push("extensao_nao_suportada");
  if (!file.storage_path) warnings.push("storage_path_ausente");
  if (!file.nome_original.trim()) warnings.push("nome_original_ausente");
  return warnings;
}

export function buildInventory(context: EngineContext): InventoryItem[] {
  return context.arquivos.map((file) => {
    const nomeNormalizado = normalizeText(file.nome_original);
    const diretorio = getDirectory(file.nome_original);
    const basename = getBasename(file.nome_original);
    const avisos = buildWarnings(file);

    return {
      arquivoId: file.id,
      processoId: file.processo_id,
      nomeOriginal: file.nome_original,
      nomeNormalizado,
      caminhoNormalizado: normalizeText(file.storage_path || file.nome_original),
      extensao: file.extensao.toLowerCase(),
      basename,
      diretorio,
      tokens: toTokenList(`${file.nome_original} ${diretorio}`),
      suportado: avisos.length === 0,
      avisos,
    };
  });
}

export function summarizeInventory(items: InventoryItem[]) {
  const countsByExtension: Record<string, number> = {};
  const warnings: string[] = [];

  for (const item of items) {
    countsByExtension[item.extensao] = (countsByExtension[item.extensao] || 0) + 1;
    warnings.push(...item.avisos.map((warning) => `${item.nomeOriginal}: ${warning}`));
  }

  return {
    totalArquivos: items.length,
    suportados: items.filter((item) => item.suportado).length,
    countsByExtension,
    warnings,
  };
}
