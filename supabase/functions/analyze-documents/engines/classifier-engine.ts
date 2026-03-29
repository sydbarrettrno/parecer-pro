import type { CategoriaDocumento, ClassificationResult, InventoryItem, NivelConfianca } from "./types.ts";
import { hasAnyFragment, hasAnyToken, hasToken } from "./text-utils.ts";

function decideConfidence(motivos: string[]): NivelConfianca {
  if (motivos.length >= 2) return "alta";
  if (motivos.length === 1) return "media";
  return "baixa";
}

function classifyOne(item: InventoryItem): ClassificationResult {
  const motivos: string[] = [];
  const tokens = item.tokens;
  const path = `${item.nomeOriginal} ${item.diretorio}`;
  let categoria: CategoriaDocumento = "OUTROS";

  if (hasAnyToken(tokens, ["template", "modelo"])) {
    categoria = "MODELO";
    motivos.push("token_modelo");
  } else if (hasAnyToken(tokens, ["cronograma"])) {
    categoria = "CRONOGRAMA";
    motivos.push("token_cronograma");
  } else if (hasAnyToken(tokens, ["art", "rrt"])) {
    categoria = "RESPONSABILIDADE_TECNICA";
    motivos.push("token_responsabilidade_tecnica");
  } else if (hasAnyToken(tokens, ["proposta", "cotacao", "cotacoes"])) {
    categoria = "COTACAO_OU_PROPOSTA";
    motivos.push("token_cotacao_ou_proposta");
  } else if (hasToken(tokens, "tr") || hasAnyFragment(path, ["termo de referencia"])) {
    categoria = "TERMO_DE_REFERENCIA";
    motivos.push("token_termo_referencia");
  } else if (hasAnyFragment(path, ["orcamento", "planilha", "composicao", "curva abc", "memoria de calculo", "sinapi", "sintetico", "bdi", "dmt"])) {
    categoria = "ORCAMENTO";
    motivos.push("fragmento_orcamento");
  } else if (hasAnyFragment(path, ["memorial", "projeto basico", "projeto executivo"])) {
    categoria = "MEMORIAL_OU_TR";
    motivos.push("fragmento_memorial");
  } else if (hasAnyFragment(path, ["drenagem"])) {
    categoria = "DRENAGEM";
    motivos.push("fragmento_drenagem");
  } else if (hasAnyFragment(path, ["topografia", "cadastro", "planialtimetrico", "levantamento"])) {
    categoria = "CADASTRO_TOPOGRAFIA";
    motivos.push("fragmento_topografia");
  } else if (hasAnyFragment(path, ["urbanizacao", "sinalizacao", "pavimentacao"])) {
    categoria = "URBANIZACAO_SINALIZACAO";
    motivos.push("fragmento_urbanizacao_sinalizacao");
  } else if (hasAnyFragment(path, ["adm/", "/adm", "administrativo", "declinando", "sem devolucao"])) {
    categoria = "ADMINISTRATIVO";
    motivos.push("fragmento_administrativo");
  }

  if (categoria === "OUTROS" && item.diretorio) {
    const dir = item.diretorio;
    if (hasAnyFragment(dir, ["/md", "md/"])) {
      categoria = "MEMORIAL_OU_TR";
      motivos.push("diretorio_md");
    } else if (hasAnyFragment(dir, ["/dre", "dre/"])) {
      categoria = "DRENAGEM";
      motivos.push("diretorio_drenagem");
    } else if (hasAnyFragment(dir, ["/cat", "cat/"])) {
      categoria = "CADASTRO_TOPOGRAFIA";
      motivos.push("diretorio_cadastro_topografia");
    } else if (hasAnyFragment(dir, ["/urb", "urb/", "/sin", "sin/"])) {
      categoria = "URBANIZACAO_SINALIZACAO";
      motivos.push("diretorio_urbanizacao_sinalizacao");
    } else if (hasAnyFragment(dir, ["/orc", "orc/"])) {
      categoria = "ORCAMENTO";
      motivos.push("diretorio_orcamento");
    } else if (hasAnyFragment(dir, ["/cro", "cro/"])) {
      categoria = "CRONOGRAMA";
      motivos.push("diretorio_cronograma");
    }
  }

  return {
    arquivoId: item.arquivoId,
    categoria,
    confianca: decideConfidence(motivos),
    motivos,
  };
}

export function classifyInventory(items: InventoryItem[]): ClassificationResult[] {
  return items.map(classifyOne);
}
