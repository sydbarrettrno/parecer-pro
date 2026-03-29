export type CategoriaDocumento =
  | "ADMINISTRATIVO"
  | "MEMORIAL_OU_TR"
  | "TERMO_DE_REFERENCIA"
  | "ORCAMENTO"
  | "CRONOGRAMA"
  | "RESPONSABILIDADE_TECNICA"
  | "COTACAO_OU_PROPOSTA"
  | "MODELO"
  | "DRENAGEM"
  | "CADASTRO_TOPOGRAFIA"
  | "URBANIZACAO_SINALIZACAO"
  | "OUTROS";

export type NivelConfianca = "alta" | "media" | "baixa";
export type ResultadoValidacao = "ok" | "alerta" | "bloqueante";

export interface ProcessoRow {
  id: string;
  nome_processo: string;
  numero_processo: string;
  orgao: string;
  secretaria: string;
}

export interface ArquivoRow {
  id: string;
  processo_id: string;
  nome_original: string;
  extensao: string;
  storage_path: string | null;
  categoria: CategoriaDocumento | null;
  hash?: string | null;
}

export interface InventoryItem {
  arquivoId: string;
  processoId: string;
  nomeOriginal: string;
  nomeNormalizado: string;
  caminhoNormalizado: string;
  extensao: string;
  basename: string;
  diretorio: string;
  tokens: string[];
  suportado: boolean;
  avisos: string[];
}

export interface ClassificationResult {
  arquivoId: string;
  categoria: CategoriaDocumento;
  confianca: NivelConfianca;
  motivos: string[];
}

export interface EvidenceRecord {
  processoId: string;
  arquivoId: string | null;
  chave: string;
  valor: string;
  tipoFonte: "filename" | "path" | "inventory" | "classification" | "validation" | "summary";
  trecho: string | null;
  confianca: NivelConfianca;
}

export interface ValidationFinding {
  processoId: string;
  codigo: string;
  severidade: ResultadoValidacao;
  descricao: string;
  categoriaRelacionada: string | null;
  arquivosRelacionados: string[];
  evidencias: string[];
}

export interface ConfidenceResult {
  score: number;
  aprovadoMinimo: boolean;
  nivel: NivelConfianca;
  fatoresPositivos: string[];
  fatoresRedutores: string[];
}

export interface EngineContext {
  processo: ProcessoRow;
  arquivos: ArquivoRow[];
}
