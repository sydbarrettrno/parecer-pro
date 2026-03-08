export interface SecaoParecer {
  key: string;
  titulo: string;
  texto: string;
  origem?: string;
  confianca?: string;
  oculto: boolean;
}

interface DadoExtraido {
  id: string;
  campo: string;
  valor: string;
  origem_documento?: string | null;
  confianca?: string | null;
}

interface Arquivo {
  nome_original: string;
  categoria?: string | null;
}

interface Processo {
  numero_processo: string;
}

const campoLabels: Record<string, string> = {
  objeto_contratacao: "Objeto da Contratação",
  numero_processo: "Número do Processo",
  orgao_responsavel: "Órgão Responsável",
  secretaria_responsavel: "Secretaria Responsável",
  valor_estimado: "Valor Estimado",
  responsavel_tecnico: "Responsável Técnico",
};

export { campoLabels };

const EXCLUDED_EXTRA_FIELDS = [
  "objeto_contratacao", "valor_estimado", "responsavel_tecnico",
  "numero_processo", "orgao_responsavel", "secretaria_responsavel",
];

export function buildSecoesFromData(
  processo: Processo,
  dadosExtraidos: DadoExtraido[],
  arquivos: Arquivo[]
): SecaoParecer[] {
  const dadosMap: Record<string, { valor: string; origem?: string; confianca?: string }> = {};
  dadosExtraidos.forEach((d) => {
    dadosMap[d.campo] = {
      valor: d.valor,
      origem: d.origem_documento ?? undefined,
      confianca: d.confianca ?? undefined,
    };
  });

  const docsList = arquivos
    .map((a, i) => `${i + 1}. ${a.nome_original} [${a.categoria || "OUTROS"}]`)
    .join("\n");

  const NOT_FOUND = "Não foi identificada informação correspondente nos documentos analisados.";

  const secoes: SecaoParecer[] = [
    {
      key: "objeto",
      titulo: "1. IDENTIFICAÇÃO E OBJETO",
      texto: dadosMap["objeto_contratacao"]?.valor || NOT_FOUND,
      origem: dadosMap["objeto_contratacao"]?.origem,
      confianca: dadosMap["objeto_contratacao"]?.confianca,
      oculto: false,
    },
    {
      key: "documentos_analisados",
      titulo: "2. DOCUMENTOS ANALISADOS",
      texto: docsList || "Nenhum documento analisado.",
      oculto: false,
    },
    {
      key: "assunto",
      titulo: "3. ASSUNTO",
      texto: `Elaboração de Parecer Técnico para o material apresentado, visando instruir procedimento licitatório para execução de obra pública, conforme especificações constantes nas peças técnicas que integram o processo nº ${processo.numero_processo}.`,
      oculto: false,
    },
    {
      key: "consideracoes_iniciais",
      titulo: "4. CONSIDERAÇÕES INICIAIS",
      texto: "Este parecer tem por objetivo verificar se o conjunto documental apresentado possui completude, clareza e consistência documental para subsidiar a instrução do procedimento licitatório, à luz da Lei nº 14.133/2021.",
      oculto: false,
    },
    {
      key: "projetos_documentos",
      titulo: "5.1 PROJETOS E DEMAIS DOCUMENTOS TÉCNICOS",
      texto: NOT_FOUND,
      oculto: false,
    },
    {
      key: "valor_estimado",
      titulo: "5.2 VALOR GLOBAL ORÇADO",
      texto: dadosMap["valor_estimado"]?.valor || NOT_FOUND,
      origem: dadosMap["valor_estimado"]?.origem,
      confianca: dadosMap["valor_estimado"]?.confianca,
      oculto: false,
    },
    {
      key: "determinacao_custos",
      titulo: "5.3 DETERMINAÇÃO DOS CUSTOS",
      texto: NOT_FOUND,
      oculto: false,
    },
    {
      key: "oneracao_desoneracao",
      titulo: "5.4 ONERAÇÃO / DESONERAÇÃO",
      texto: NOT_FOUND,
      oculto: false,
    },
    {
      key: "bdi",
      titulo: "5.5 BDI",
      texto: NOT_FOUND,
      oculto: false,
    },
    {
      key: "cronograma",
      titulo: "5.6 CRONOGRAMA FÍSICO-FINANCEIRO E MEMORIAIS",
      texto: NOT_FOUND,
      oculto: false,
    },
    ...dadosExtraidos
      .filter((d) => !EXCLUDED_EXTRA_FIELDS.includes(d.campo))
      .map((d, i) => ({
        key: `extra_${d.id}`,
        titulo: `5.${7 + i} ${campoLabels[d.campo] || d.campo.toUpperCase()}`,
        texto: d.valor,
        origem: d.origem_documento ?? undefined,
        confianca: d.confianca ?? undefined,
        oculto: false,
      })),
    {
      key: "conclusao",
      titulo: "6. CONCLUSÃO – PARECER TÉCNICO",
      texto: `Parecer técnico elaborado com base na análise de ${arquivos.length} documento(s) integrante(s) do processo administrativo nº ${processo.numero_processo}.`,
      oculto: false,
    },
    {
      key: "inconsistencias",
      titulo: "REGISTRO DE INCONSISTÊNCIAS GRAVES",
      texto: "Não foram identificadas inconsistências graves nos documentos analisados.",
      oculto: false,
    },
    {
      key: "complementacao",
      titulo: "SOLICITAÇÃO DE COMPLEMENTAÇÃO DOCUMENTAL",
      texto: "Não há solicitação de complementação documental.",
      oculto: false,
    },
    {
      key: "responsavel_tecnico_final",
      titulo: "RESPONSÁVEL TÉCNICO",
      texto: dadosMap["responsavel_tecnico"]?.valor || NOT_FOUND,
      oculto: false,
    },
  ];

  return secoes;
}
