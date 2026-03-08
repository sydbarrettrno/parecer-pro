import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";

const campoLabels: Record<string, string> = {
  objeto_contratacao: "Objeto da Contratação",
  numero_processo: "Número do Processo",
  orgao_responsavel: "Órgão Responsável",
  secretaria_responsavel: "Secretaria Responsável",
  valor_estimado: "Valor Estimado",
  responsavel_tecnico: "Responsável Técnico",
};

export async function generateParecerDocx(conteudo: any, filename: string) {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children: [
          // Header
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "PARECER TÉCNICO",
                bold: true,
                size: 32,
                font: "Arial",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: conteudo.identificacao_parecer?.numero || "",
                size: 24,
                font: "Arial",
              }),
            ],
          }),

          // 1. Identificação do Parecer
          sectionTitle("1. IDENTIFICAÇÃO DO PARECER"),
          textParagraph(`Número: ${conteudo.identificacao_parecer?.numero || "—"}`),
          textParagraph(`Data: ${conteudo.identificacao_parecer?.data || "—"}`),
          spacer(),

          // 2. Identificação do Processo
          sectionTitle("2. IDENTIFICAÇÃO DO PROCESSO"),
          textParagraph(`Nome: ${conteudo.identificacao_processo?.nome || "—"}`),
          textParagraph(`Número do Processo: ${conteudo.identificacao_processo?.numero || "—"}`),
          textParagraph(`Órgão: ${conteudo.identificacao_processo?.orgao || "—"}`),
          textParagraph(`Secretaria: ${conteudo.identificacao_processo?.secretaria || "—"}`),
          spacer(),

          // 3. Objeto
          sectionTitle("3. OBJETO"),
          textParagraph(conteudo.objeto || "Não foi identificada informação correspondente nos documentos analisados."),
          spacer(),

          // 4. Documentos Analisados
          sectionTitle("4. DOCUMENTOS ANALISADOS"),
          ...(conteudo.documentos_analisados?.map((doc: any, i: number) =>
            textParagraph(`${i + 1}. ${doc.nome} [${doc.categoria}]`)
          ) || [textParagraph("Nenhum documento analisado.")]),
          spacer(),

          // 5. Análise Técnica
          sectionTitle("5. ANÁLISE TÉCNICA"),
          ...(conteudo.analise_tecnica?.flatMap((item: any) => [
            new Paragraph({
              spacing: { before: 120, after: 60 },
              children: [
                new TextRun({
                  text: `${campoLabels[item.campo] || item.campo}: `,
                  bold: true,
                  size: 22,
                  font: "Arial",
                }),
                new TextRun({
                  text: item.valor,
                  size: 22,
                  font: "Arial",
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 120 },
              children: [
                new TextRun({
                  text: `Origem: ${item.origem || "—"} | Confiança: ${item.confianca || "—"}`,
                  size: 18,
                  italics: true,
                  font: "Arial",
                  color: "666666",
                }),
              ],
            }),
          ]) || []),
          spacer(),

          // 6. Inconsistências
          sectionTitle("6. REGISTRO DE INCONSISTÊNCIAS GRAVES"),
          textParagraph(conteudo.inconsistencias || "Não foram identificadas inconsistências graves nos documentos analisados."),
          spacer(),

          // 7. Complementação
          sectionTitle("7. SOLICITAÇÃO DE COMPLEMENTAÇÃO DOCUMENTAL"),
          textParagraph(conteudo.complementacao || "Não há solicitação de complementação documental."),
          spacer(),

          // 8. Síntese
          sectionTitle("8. SÍNTESE DA ANÁLISE"),
          textParagraph(conteudo.sintese || "—"),
          spacer(),

          // 9. Responsável Técnico
          sectionTitle("9. IDENTIFICAÇÃO DO RESPONSÁVEL TÉCNICO"),
          textParagraph(conteudo.responsavel_tecnico || "Não foi identificada informação correspondente nos documentos analisados."),
          spacer(),
          spacer(),

          // Signature
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 600 },
            children: [
              new TextRun({
                text: "________________________________",
                size: 22,
                font: "Arial",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "Responsável Técnico",
                size: 22,
                font: "Arial",
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}

function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24,
        font: "Arial",
      }),
    ],
    border: {
      bottom: {
        color: "2B4C7E",
        style: BorderStyle.SINGLE,
        size: 6,
        space: 4,
      },
    },
  });
}

function textParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({
        text,
        size: 22,
        font: "Arial",
      }),
    ],
  });
}

function spacer(): Paragraph {
  return new Paragraph({ spacing: { after: 200 }, children: [] });
}
