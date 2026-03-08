import type { Database } from "@/integrations/supabase/types";

export type CategoriaDocumento = Database["public"]["Enums"]["categoria_documento"];

/**
 * Regras de classificação: cada categoria possui:
 * - keywords: termos buscados no nome do arquivo E na pasta de origem
 * - abbreviations: abreviações comuns usadas em nomes de pasta/arquivo
 */
const CLASSIFICATION_RULES: {
  category: CategoriaDocumento;
  keywords: string[];
  abbreviations: string[];
}[] = [
  {
    category: "ADMINISTRATIVO",
    keywords: ["oficio", "despacho", "portaria", "memorando", "decreto", "edital", "ata", "certidao", "declaracao", "administrativo", "contrato", "convenio", "licitacao"],
    abbreviations: ["adm", "admin"],
  },
  {
    category: "MEMORIAL_OU_TR",
    keywords: ["memorial", "memorial descritivo", "termo de referencia", "especificacao", "descritivo", "projeto basico"],
    abbreviations: ["md", "tr"],
  },
  {
    category: "ORCAMENTO",
    keywords: ["orcamento", "planilha", "bdi", "composicao", "sinapi", "custo", "preco", "orcamentario"],
    abbreviations: ["orc"],
  },
  {
    category: "CRONOGRAMA",
    keywords: ["cronograma", "prazo", "etapa", "fisico-financeiro", "fisico financeiro", "gantt"],
    abbreviations: ["cron"],
  },
  {
    category: "RESPONSABILIDADE_TECNICA",
    keywords: ["art", "rrt", "crea", "cau", "responsavel tecnico", "engenheiro", "arquiteto", "responsabilidade tecnica"],
    abbreviations: ["rt"],
  },
  {
    category: "DRENAGEM",
    keywords: ["drenagem", "pluvial", "bueiro", "galeria", "boca de lobo", "caixa de passagem", "rede de drenagem"],
    abbreviations: ["dre", "dren"],
  },
  {
    category: "CADASTRO_TOPOGRAFIA",
    keywords: ["cadastro", "topografia", "levantamento topografico", "planialtimetrico", "geodesia", "georreferenciamento", "topografico"],
    abbreviations: ["cat", "topo"],
  },
  {
    category: "URBANIZACAO_SINALIZACAO",
    keywords: ["urbanizacao", "sinalizacao", "paisagismo", "calcada", "meio-fio", "pavimentacao", "sinaletica", "urbano"],
    abbreviations: ["urb", "sin", "urb_sin"],
  },
  {
    category: "OUTROS",
    keywords: [],
    abbreviations: [],
  },
];

/**
 * Normaliza texto removendo acentos e convertendo para minúsculo.
 */
function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Classifica um documento com base no nome do arquivo e pasta de origem.
 * O caminho completo (fullPath) é usado para extrair informações de contexto.
 */
export function classifyDocument(fullPath: string): CategoriaDocumento {
  const normalized = normalize(fullPath);

  // Extrai segmentos do caminho para análise individual
  const segments = normalized.split("/").map((s) => s.replace(/[^a-z0-9]/g, " ").trim());
  const combinedText = segments.join(" ");

  for (const rule of CLASSIFICATION_RULES) {
    if (rule.keywords.length === 0 && rule.abbreviations.length === 0) continue;

    // Busca por keywords no texto completo do caminho
    if (rule.keywords.some((kw) => combinedText.includes(kw))) {
      return rule.category;
    }

    // Busca por abreviações como segmentos isolados (pastas ou prefixos de arquivo)
    for (const seg of segments) {
      const words = seg.split(/\s+/);
      if (rule.abbreviations.some((abbr) => words.includes(abbr))) {
        return rule.category;
      }
    }
  }

  return "OUTROS";
}
