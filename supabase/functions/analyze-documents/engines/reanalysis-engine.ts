import type { ArquivoRow } from "./types.ts";

export interface ReanalysisInput {
  arquivosAtuais: ArquivoRow[];
  arquivoIdsSolicitados?: string[];
  categoriasAfetadas?: string[];
}

export function selectFilesForReanalysis(input: ReanalysisInput): ArquivoRow[] {
  const { arquivosAtuais, arquivoIdsSolicitados, categoriasAfetadas } = input;

  if (arquivoIdsSolicitados && arquivoIdsSolicitados.length > 0) {
    const ids = new Set(arquivoIdsSolicitados);
    return arquivosAtuais.filter((file) => ids.has(file.id));
  }

  if (categoriasAfetadas && categoriasAfetadas.length > 0) {
    const categorias = new Set(categoriasAfetadas);
    return arquivosAtuais.filter((file) => file.categoria && categorias.has(file.categoria));
  }

  return arquivosAtuais;
}
