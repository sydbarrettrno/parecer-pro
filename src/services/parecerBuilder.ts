import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { SecaoParecer } from "./objectExtractor";

interface Processo {
  nome_processo: string;
  numero_processo: string;
  orgao: string;
  secretaria: string;
}

interface Arquivo {
  nome_original: string;
  categoria?: string | null;
}

const ANALISE_KEYS = [
  "valor_estimado", "projetos_documentos", "determinacao_custos",
  "oneracao_desoneracao", "bdi", "cronograma",
];

export function buildParecerConteudo(
  processo: Processo,
  arquivos: Arquivo[],
  secoes: SecaoParecer[],
  nextVersion: number
) {
  const visibleSections = secoes.filter((s) => !s.oculto);
  const getSecao = (key: string) =>
    visibleSections.find((s) => s.key === key)?.texto || "";

  const NOT_FOUND = "Não foi identificada informação correspondente nos documentos analisados.";

  return {
    identificacao_parecer: {
      numero: `Nº ${String(nextVersion).padStart(3, "0")}/${new Date().getFullYear()} – ${processo.secretaria}`,
      data: format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
    },
    identificacao_processo: {
      nome: processo.nome_processo,
      numero: processo.numero_processo,
      orgao: processo.orgao,
      secretaria: processo.secretaria,
    },
    objeto: getSecao("objeto") || NOT_FOUND,
    documentos_analisados: arquivos.map((a) => ({
      nome: a.nome_original,
      categoria: a.categoria || "OUTROS",
    })),
    assunto: getSecao("assunto") || null,
    consideracoes_iniciais: getSecao("consideracoes_iniciais") || null,
    analise_tecnica: visibleSections
      .filter((s) => ANALISE_KEYS.includes(s.key) || s.key.startsWith("extra_"))
      .map((s) => ({
        campo: s.key,
        valor: s.texto,
        origem: s.origem,
        confianca: s.confianca,
      })),
    inconsistencias: getSecao("inconsistencias") || "Não foram identificadas inconsistências graves nos documentos analisados.",
    complementacao: getSecao("complementacao") || null,
    sintese: getSecao("conclusao") || "—",
    conclusao: getSecao("conclusao") || "—",
    responsavel_tecnico: getSecao("responsavel_tecnico_final") || NOT_FOUND,
  };
}

/**
 * Build parecer conteudo from raw extracted data (used in ResultadoFinal).
 */
export function buildParecerFromRawData(
  processo: Processo,
  dadosExtraidos: Array<{ campo: string; valor: string; origem_documento?: string | null; confianca?: string | null }>,
  arquivos: Arquivo[],
  nextVersion: number
) {
  const dadosMap: Record<string, string> = {};
  dadosExtraidos.forEach((d) => {
    dadosMap[d.campo] = d.valor;
  });

  const NOT_FOUND = "Não foi identificada informação correspondente nos documentos analisados.";

  return {
    identificacao_parecer: {
      numero: `PT-${processo.numero_processo}-V${String(nextVersion).padStart(2, "0")}`,
      data: format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
    },
    identificacao_processo: {
      nome: processo.nome_processo,
      numero: processo.numero_processo,
      orgao: processo.orgao,
      secretaria: processo.secretaria,
    },
    objeto: dadosMap["objeto_contratacao"] || NOT_FOUND,
    documentos_analisados: arquivos.map((a) => ({
      nome: a.nome_original,
      categoria: a.categoria || "OUTROS",
    })),
    analise_tecnica: dadosExtraidos.map((d) => ({
      campo: d.campo,
      valor: d.valor,
      origem: d.origem_documento,
      confianca: d.confianca,
    })),
    inconsistencias: "Não foram identificadas inconsistências graves nos documentos analisados.",
    complementacao: null,
    sintese: `Parecer técnico elaborado com base na análise de ${arquivos.length} documento(s) integrante(s) do processo administrativo nº ${processo.numero_processo}.`,
    responsavel_tecnico: dadosMap["responsavel_tecnico"] || NOT_FOUND,
  };
}
