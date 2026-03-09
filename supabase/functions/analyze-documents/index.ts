import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as pdfParse from "npm:pdf-parse@1.1.1";
import mammoth from "npm:mammoth@1.6.0";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── Classification keywords (filename + content) ──
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  MEMORIAL_OU_TR: [
    "memorial", "termo de referencia", "tr", "especificacao", "descritivo",
    "projeto basico", "projeto executivo",
  ],
  ORCAMENTO: [
    "orcamento", "orcamento sintetico", "composicoes", "composicao",
    "curva abc", "memoria de calculo", "cotacoes", "cotacao", "dmt",
    "planilha", "bdi", "sinapi", "custo", "preco", "valor global",
    "valor total",
  ],
  CRONOGRAMA: [
    "cronograma", "prazo", "etapa", "fisico-financeiro", "fisico financeiro",
    "gantt", "dias corridos",
  ],
  RESPONSABILIDADE_TECNICA: [
    "art", "rrt", "crea", "cau", "responsavel tecnico", "engenheiro",
    "arquiteto", "anotacao de responsabilidade",
  ],
  DRENAGEM: [
    "drenagem", "escoamento", "bueiro", "galeria", "caixa de passagem",
    "projeto de drenagem",
  ],
  CADASTRO_TOPOGRAFIA: [
    "topografia", "levantamento", "cadastro", "planialtimetrico",
    "coordenadas", "cadastro topografico",
  ],
  URBANIZACAO_SINALIZACAO: [
    "urbanizacao", "sinalizacao", "calcada", "pavimentacao", "meio-fio",
    "meio fio",
  ],
  ADMINISTRATIVO: [
    "oficio", "despacho", "portaria", "memorando", "decreto", "edital",
    "ata", "certidao", "declaracao", "requerimento", "solicitacao",
  ],
};

// ── Folder-path-based rules ──
const FOLDER_CATEGORY_MAP: Record<string, string> = {
  "/md/": "MEMORIAL_OU_TR",
  "/dre/": "DRENAGEM",
  "/cat/": "CADASTRO_TOPOGRAFIA",
  "/urb_sin/": "URBANIZACAO_SINALIZACAO",
  "/urb/": "URBANIZACAO_SINALIZACAO",
  "/sin/": "URBANIZACAO_SINALIZACAO",
  "/orc/": "ORCAMENTO",
  "/cro/": "CRONOGRAMA",
};

// ── Text extraction helpers ──
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    const uint8Array = new Uint8Array(buffer);
    const result = await pdfParse.default(uint8Array);
    return result.text || "";
  } catch (error) {
    console.error("PDF extraction error:", error);
    return "";
  }
}

async function extractTextFromDOCX(buffer: ArrayBuffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value || "";
  } catch (error) {
    console.error("DOCX extraction error:", error);
    return "";
  }
}

function extractTextFromXLSX(buffer: ArrayBuffer): string {
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    let text = "";
    const sheetsToProcess = workbook.SheetNames.slice(0, 5);
    for (const sheetName of sheetsToProcess) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      text += `\n--- ${sheetName} ---\n${csv}`;
    }
    return text;
  } catch (error) {
    console.error("XLSX extraction error:", error);
    return "";
  }
}

async function extractTextFromFile(buffer: ArrayBuffer, extension: string): Promise<string> {
  const ext = extension.toLowerCase().replace(".", "");
  switch (ext) {
    case "pdf": return await extractTextFromPDF(buffer);
    case "docx":
    case "odt": return await extractTextFromDOCX(buffer);
    case "xlsx":
    case "xls": return extractTextFromXLSX(buffer);
    default: return "";
  }
}

// ── Classification: folder path → filename keywords → content keywords ──
function classifyDocument(filename: string, extractedText: string = ""): string {
  const normalize = (text: string) =>
    text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1) Check folder path first (highest priority)
  const normalizedPath = normalize(filename);
  for (const [folder, category] of Object.entries(FOLDER_CATEGORY_MAP)) {
    if (normalizedPath.includes(folder)) {
      return category;
    }
  }

  // 2) Check filename-only keywords (medium priority, avoids false positives from content)
  const normalizedFilename = normalize(filename.split("/").pop() || filename);
  
  // Specific filename rules with high confidence
  const filenameRules: [RegExp | string, string][] = [
    ["cronograma", "CRONOGRAMA"],
    ["orcamento sintetico", "ORCAMENTO"],
    ["composicoes", "ORCAMENTO"],
    ["composicao", "ORCAMENTO"],
    ["curva abc", "ORCAMENTO"],
    ["memoria de calculo", "ORCAMENTO"],
    ["cotacoes", "ORCAMENTO"],
    ["cotacao", "ORCAMENTO"],
    ["dmt", "ORCAMENTO"],
    ["bdi", "ORCAMENTO"],
    ["orcamento", "ORCAMENTO"],
    ["planilha", "ORCAMENTO"],
    ["memorial", "MEMORIAL_OU_TR"],
    ["termo de referencia", "MEMORIAL_OU_TR"],
    ["drenagem", "DRENAGEM"],
    ["topografia", "CADASTRO_TOPOGRAFIA"],
    ["cadastro", "CADASTRO_TOPOGRAFIA"],
    ["planialtimetrico", "CADASTRO_TOPOGRAFIA"],
    ["urbanizacao", "URBANIZACAO_SINALIZACAO"],
    ["sinalizacao", "URBANIZACAO_SINALIZACAO"],
    ["pavimentacao", "URBANIZACAO_SINALIZACAO"],
    ["art", "RESPONSABILIDADE_TECNICA"],
    ["rrt", "RESPONSABILIDADE_TECNICA"],
  ];

  for (const [pattern, category] of filenameRules) {
    if (normalizedFilename.includes(pattern as string)) {
      return category;
    }
  }

  // 3) Check combined text (filename + content) for broader keyword matches
  const combinedText = normalize(filename + " " + extractedText.slice(0, 5000));
  
  // Check in priority order (most specific first)
  const priorityOrder = [
    "MEMORIAL_OU_TR", "ORCAMENTO", "CRONOGRAMA", "RESPONSABILIDADE_TECNICA",
    "DRENAGEM", "CADASTRO_TOPOGRAFIA", "URBANIZACAO_SINALIZACAO", "ADMINISTRATIVO",
  ];

  for (const category of priorityOrder) {
    const keywords = CATEGORY_KEYWORDS[category];
    if (keywords && keywords.some((kw) => combinedText.includes(kw))) {
      return category;
    }
  }

  return "OUTROS";
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { processo_id } = await req.json();
    if (!processo_id) {
      return new Response(JSON.stringify({ error: "processo_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: processo, error: procErr } = await supabase
      .from("processos")
      .select("*")
      .eq("id", processo_id)
      .single();
    if (procErr) throw procErr;

    const { data: arquivos, error: arqErr } = await supabase
      .from("arquivos")
      .select("*")
      .eq("processo_id", processo_id);
    if (arqErr) throw arqErr;

    // Extract text, classify each file, and build descriptions for AI
    const fileDescriptions: string[] = [];
    const classifiedFiles: { nome: string; categoria: string; texto: string }[] = [];

    for (const arq of arquivos) {
      let textoExtraido = "";

      if (arq.storage_path) {
        try {
          const { data: fileData, error: downloadErr } = await supabase.storage
            .from("processos")
            .download(arq.storage_path);

          if (!downloadErr && fileData) {
            const buffer = await fileData.arrayBuffer();
            textoExtraido = await extractTextFromFile(buffer, arq.extensao);
            if (textoExtraido.length > 50000) {
              textoExtraido = textoExtraido.slice(0, 50000) + "... [truncado]";
            }
          }
        } catch (err) {
          console.error(`Error downloading ${arq.nome_original}:`, err);
        }
      }

      const categoria = classifyDocument(arq.nome_original, textoExtraido);

      await supabase
        .from("arquivos")
        .update({ categoria, texto_extraido: textoExtraido || null })
        .eq("id", arq.id);

      classifiedFiles.push({ nome: arq.nome_original, categoria, texto: textoExtraido });

      const textPreview = textoExtraido.slice(0, 2000);
      fileDescriptions.push(
        `- ${arq.nome_original} (${categoria}):\n${textPreview || "[Sem texto extraído]"}`
      );
    }

    // ── Build AI prompt ──
    // Gather discipline names from classified files for object inference
    const disciplineMap: Record<string, string> = {
      DRENAGEM: "drenagem",
      URBANIZACAO_SINALIZACAO: "urbanização e sinalização",
      CADASTRO_TOPOGRAFIA: "cadastro e topografia",
      MEMORIAL_OU_TR: "memorial descritivo",
      ORCAMENTO: "orçamento",
      CRONOGRAMA: "cronograma",
    };
    const presentDisciplines = [...new Set(classifiedFiles.map((f) => f.categoria))]
      .filter((c) => disciplineMap[c])
      .map((c) => disciplineMap[c]);

    const prompt = `Você é um analista técnico de processos licitatórios de engenharia pública.

Analise as informações do processo e o CONTEÚDO DOS DOCUMENTOS abaixo e extraia os seguintes dados:

1. objeto_contratacao - O objeto REAL da contratação. NÃO use apenas o nome do processo.
   Monte uma descrição técnica do objeto a partir do conteúdo dos memoriais, termos de referência,
   nomes dos projetos e disciplinas presentes. Deve refletir a natureza da obra (ex: "Execução de
   serviços de pavimentação, drenagem, urbanização e sinalização da Rua XYZ").
   Disciplinas identificadas nos documentos: ${presentDisciplines.join(", ") || "não identificadas"}.

2. numero_processo - Número do processo administrativo
3. orgao_responsavel - Órgão responsável
4. secretaria_responsavel - Secretaria responsável
5. valor_estimado - Valor estimado da contratação (buscar na planilha orçamentária ou orçamento sintético)
6. responsavel_tecnico - Responsável técnico (buscar na ART/RRT)

INFORMAÇÕES DO PROCESSO:
- Nome: ${processo.nome_processo}
- Número: ${processo.numero_processo}
- Órgão: ${processo.orgao}
- Secretaria: ${processo.secretaria}

CONTEÚDO DOS DOCUMENTOS:
${fileDescriptions.join("\n\n").slice(0, 30000)}

INSTRUÇÕES:
- Analise o CONTEÚDO REAL dos documentos, não apenas os nomes dos arquivos
- Para o campo objeto_contratacao, NÃO repita simplesmente o nome do processo.
  Construa uma descrição técnica com base nos documentos.
- Para cada dado, retorne um JSON com os campos: campo, valor, origem_documento, confianca (alta/media/baixa)
- Se encontrou o dado no conteúdo do documento, use confiança "alta"
- Se inferiu de outras informações, use confiança "media"
- Se não encontrou, use: "Não foi identificada informação correspondente nos documentos analisados." com confiança "baixa"
- Responda APENAS com um array JSON, sem markdown, sem explicações

Exemplo de resposta:
[{"campo":"objeto_contratacao","valor":"Execução de serviços de pavimentação, drenagem e sinalização da Rua Exemplo","origem_documento":"Memorial Descritivo","confianca":"alta"}]`;

    let extractedData: any[] = [];

    try {
      const aiResponse = await fetch(`${SUPABASE_URL}/functions/v1/ai-proxy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (aiResponse.ok) {
        const aiResult = await aiResponse.json();
        const content = aiResult.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        }
      }
    } catch (aiErr) {
      console.error("AI analysis error:", aiErr);
    }

    // Fallback with better objeto construction
    if (extractedData.length === 0) {
      const objetoFallback = presentDisciplines.length > 0
        ? `Execução de serviços de ${presentDisciplines.join(", ")} – ${processo.nome_processo}`
        : processo.nome_processo;

      extractedData = [
        { campo: "objeto_contratacao", valor: objetoFallback, origem_documento: "Inferido dos documentos classificados", confianca: "media" },
        { campo: "numero_processo", valor: processo.numero_processo, origem_documento: "Cadastro do processo", confianca: "alta" },
        { campo: "orgao_responsavel", valor: processo.orgao, origem_documento: "Cadastro do processo", confianca: "alta" },
        { campo: "secretaria_responsavel", valor: processo.secretaria, origem_documento: "Cadastro do processo", confianca: "alta" },
        { campo: "valor_estimado", valor: "Não foi identificada informação correspondente nos documentos analisados.", origem_documento: null, confianca: "baixa" },
        { campo: "responsavel_tecnico", valor: "Não foi identificada informação correspondente nos documentos analisados.", origem_documento: null, confianca: "baixa" },
      ];
    }

    // Clear old extracted data & insert new
    await supabase.from("dados_extraidos").delete().eq("processo_id", processo_id);

    for (const item of extractedData) {
      await supabase.from("dados_extraidos").insert({
        processo_id,
        campo: item.campo,
        valor: item.valor,
        origem_documento: item.origem_documento || null,
        confianca: item.confianca || "media",
      });
    }

    await supabase
      .from("processos")
      .update({ status: "revisao" })
      .eq("id", processo_id);

    return new Response(
      JSON.stringify({
        success: true,
        extracted: extractedData.length,
        filesProcessed: arquivos.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
