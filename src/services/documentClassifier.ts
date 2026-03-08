const CATEGORY_KEYWORDS: Record<string, string[]> = {
  ADMINISTRATIVO: ["oficio", "despacho", "portaria", "memorando", "decreto", "edital", "ata", "certidao", "declaracao"],
  MEMORIAL_OU_TR: ["memorial", "termo de referencia", "tr", "especificacao", "descritivo", "projeto basico"],
  ORCAMENTO: ["orcamento", "planilha", "bdi", "composicao", "sinapi", "custo", "preco"],
  CRONOGRAMA: ["cronograma", "prazo", "etapa", "fisico-financeiro", "gantt"],
  RESPONSABILIDADE_TECNICA: ["art", "rrt", "crea", "cau", "responsavel tecnico", "engenheiro", "arquiteto"],
};

export function classifyDocument(filename: string): string {
  const lower = filename.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return "OUTROS";
}
