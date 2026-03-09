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

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  ADMINISTRATIVO: ["oficio", "despacho", "portaria", "memorando", "decreto", "edital", "ata", "certidao", "declaracao", "requerimento", "solicitacao"],
  MEMORIAL_OU_TR: ["memorial", "termo de referencia", "tr", "especificacao", "descritivo", "projeto basico", "projeto executivo"],
  ORCAMENTO: ["orcamento", "planilha", "bdi", "composicao", "sinapi", "custo", "preco", "valor global", "valor total"],
  CRONOGRAMA: ["cronograma", "prazo", "etapa", "fisico-financeiro", "gantt", "dias corridos"],
  RESPONSABILIDADE_TECNICA: ["art", "rrt", "crea", "cau", "responsavel tecnico", "engenheiro", "arquiteto", "anotacao de responsabilidade"],
  DRENAGEM: ["drenagem", "escoamento", "bueiro", "galeria", "caixa de passagem"],
  CADASTRO_TOPOGRAFIA: ["topografia", "levantamento", "cadastro", "planialtimetrico", "coordenadas"],
  URBANIZACAO_SINALIZACAO: ["urbanizacao", "sinalizacao", "calcada", "pavimentacao", "meio-fio"],
};

// Extract text from PDF
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

// Extract text from DOCX/ODT
async function extractTextFromDOCX(buffer: ArrayBuffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value || "";
  } catch (error) {
    console.error("DOCX extraction error:", error);
    return "";
  }
}

// Extract text from XLSX
function extractTextFromXLSX(buffer: ArrayBuffer): string {
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    let text = "";
    
    // Process first 5 sheets max
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

// Main text extraction function
async function extractTextFromFile(buffer: ArrayBuffer, extension: string): Promise<string> {
  const ext = extension.toLowerCase().replace(".", "");
  
  switch (ext) {
    case "pdf":
      return await extractTextFromPDF(buffer);
    case "docx":
    case "odt":
      return await extractTextFromDOCX(buffer);
    case "xlsx":
    case "xls":
      return extractTextFromXLSX(buffer);
    default:
      return "";
  }
}

// Classify document using filename AND extracted text
function classifyDocument(filename: string, extractedText: string = ""): string {
  const normalizeText = (text: string) => 
    text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  const combinedText = normalizeText(filename + " " + extractedText.slice(0, 5000));
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => combinedText.includes(kw))) {
      return category;
    }
  }
  return "OUTROS";
}

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

    // Get process info
    const { data: processo, error: procErr } = await supabase
      .from("processos")
      .select("*")
      .eq("id", processo_id)
      .single();
    if (procErr) throw procErr;

    // Get files
    const { data: arquivos, error: arqErr } = await supabase
      .from("arquivos")
      .select("*")
      .eq("processo_id", processo_id);
    if (arqErr) throw arqErr;

    // Extract text from each file and classify
    const fileDescriptions: string[] = [];
    
    for (const arq of arquivos) {
      let textoExtraido = "";
      
      // Download file from storage
      if (arq.storage_path) {
        try {
          const { data: fileData, error: downloadErr } = await supabase.storage
            .from("processos")
            .download(arq.storage_path);
          
          if (!downloadErr && fileData) {
            const buffer = await fileData.arrayBuffer();
            textoExtraido = await extractTextFromFile(buffer, arq.extensao);
            
            // Truncate to 50KB max for storage
            if (textoExtraido.length > 50000) {
              textoExtraido = textoExtraido.slice(0, 50000) + "... [truncado]";
            }
          }
        } catch (err) {
          console.error(`Error downloading ${arq.nome_original}:`, err);
        }
      }
      
      // Classify using filename + extracted text
      const categoria = classifyDocument(arq.nome_original, textoExtraido);
      
      // Update arquivo with extracted text and category
      await supabase
        .from("arquivos")
        .update({ 
          categoria,
          texto_extraido: textoExtraido || null
        })
        .eq("id", arq.id);
      
      // Build description for AI prompt
      const textPreview = textoExtraido.slice(0, 2000);
      fileDescriptions.push(
        `- ${arq.nome_original} (${categoria}):\n${textPreview || "[Sem texto extraído]"}`
      );
    }

    // Build context for AI analysis with extracted text
    const prompt = `Você é um analista técnico de processos licitatórios de engenharia pública.

Analise as informações do processo e o CONTEÚDO DOS DOCUMENTOS abaixo e extraia os seguintes dados:
1. objeto_contratacao - O objeto da contratação (buscar no memorial descritivo ou termo de referência)
2. numero_processo - Número do processo administrativo
3. orgao_responsavel - Órgão responsável
4. secretaria_responsavel - Secretaria responsável
5. valor_estimado - Valor estimado da contratação (buscar na planilha orçamentária)
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
- Para cada dado, retorne um JSON com os campos: campo, valor, origem_documento, confianca (alta/media/baixa)
- Se encontrou o dado no conteúdo do documento, use confiança "alta"
- Se inferiu de outras informações, use confiança "media"
- Se não encontrou, use: "Não foi identificada informação correspondente nos documentos analisados." com confiança "baixa"
- Responda APENAS com um array JSON, sem markdown, sem explicações

Exemplo de resposta:
[{"campo":"objeto_contratacao","valor":"Reforma do prédio sede","origem_documento":"Termo de Referência","confianca":"alta"}]`;

    // Call AI via Supabase AI gateway
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

    // Fallback if AI failed
    if (extractedData.length === 0) {
      extractedData = [
        { campo: "objeto_contratacao", valor: processo.nome_processo, origem_documento: "Cadastro do processo", confianca: "media" },
        { campo: "numero_processo", valor: processo.numero_processo, origem_documento: "Cadastro do processo", confianca: "alta" },
        { campo: "orgao_responsavel", valor: processo.orgao, origem_documento: "Cadastro do processo", confianca: "alta" },
        { campo: "secretaria_responsavel", valor: processo.secretaria, origem_documento: "Cadastro do processo", confianca: "alta" },
        { campo: "valor_estimado", valor: "Não foi identificada informação correspondente nos documentos analisados.", origem_documento: null, confianca: "baixa" },
        { campo: "responsavel_tecnico", valor: "Não foi identificada informação correspondente nos documentos analisados.", origem_documento: null, confianca: "baixa" },
      ];
    }

    // Clear old extracted data
    await supabase.from("dados_extraidos").delete().eq("processo_id", processo_id);

    // Insert extracted data
    for (const item of extractedData) {
      await supabase.from("dados_extraidos").insert({
        processo_id,
        campo: item.campo,
        valor: item.valor,
        origem_documento: item.origem_documento || null,
        confianca: item.confianca || "media",
      });
    }

    // Update process status
    await supabase
      .from("processos")
      .update({ status: "revisao" })
      .eq("id", processo_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        extracted: extractedData.length,
        filesProcessed: arquivos.length 
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