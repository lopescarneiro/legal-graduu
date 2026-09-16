import "server-only";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
} from "docx";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/** Formatos de export suportados. */
export type FormatoExport = "docx" | "pdf";

export const FORMATO_MIME: Record<FormatoExport, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

/** Slug seguro para nome de arquivo (sem acento, minúsculo, hífens). */
export function slugArquivo(s: string): string {
  const base = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "documento";
}

const RODAPE = "Legal Graduu — powered by Verônica Gilioli Advogados";

/** Quebra o corpo em linhas preservando parágrafos vazios (espaçamento). */
function linhas(corpo: string): string[] {
  return corpo.replace(/\r\n/g, "\n").split("\n");
}

// ===========================================================================
// WORD (.docx)
// ===========================================================================
export async function gerarDocx(titulo: string, corpo: string): Promise<Uint8Array> {
  const paragrafos: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
      children: [new TextRun({ text: titulo, bold: true, size: 28 })],
    }),
  ];

  for (const linha of linhas(corpo)) {
    if (linha.trim() === "") {
      paragrafos.push(new Paragraph({ children: [], spacing: { after: 120 } }));
      continue;
    }
    paragrafos.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 120, line: 300 },
        children: [new TextRun({ text: linha })],
      }),
    );
  }

  const doc = new Document({
    creator: "Legal Graduu",
    title: titulo,
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 24 }, // 12pt
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 }, // ~2cm
          },
        },
        footers: undefined,
        children: paragrafos,
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}

// ===========================================================================
// PDF
// ===========================================================================
const A4 = { w: 595.28, h: 841.89 };
const MARGEM = 56;
const FONTE = 11;
const ALTURA_LINHA = 16;

/** Quebra uma linha lógica em linhas físicas que cabem na largura. */
function quebrar(texto: string, font: PDFFont, tamanho: number, largura: number): string[] {
  const palavras = texto.split(/\s+/);
  const saida: string[] = [];
  let atual = "";
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (font.widthOfTextAtSize(tentativa, tamanho) <= largura || atual === "") {
      atual = tentativa;
    } else {
      saida.push(atual);
      atual = p;
    }
  }
  if (atual) saida.push(atual);
  return saida.length ? saida : [""];
}

export async function gerarPdf(titulo: string, corpo: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(titulo);
  pdf.setCreator("Legal Graduu");
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const larguraUtil = A4.w - MARGEM * 2;

  let page: PDFPage = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - MARGEM;

  const rodape = () => {
    page.drawText(RODAPE, {
      x: MARGEM,
      y: MARGEM / 2,
      size: 7,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  };
  const novaPagina = () => {
    rodape();
    page = pdf.addPage([A4.w, A4.h]);
    y = A4.h - MARGEM;
  };
  const garantir = (altura: number) => {
    if (y - altura < MARGEM + 12) novaPagina();
  };

  // Título centralizado
  const tituloLinhas = quebrar(titulo, fontBold, 14, larguraUtil);
  for (const tl of tituloLinhas) {
    const w = fontBold.widthOfTextAtSize(tl, 14);
    garantir(20);
    page.drawText(tl, { x: (A4.w - w) / 2, y: y - 14, size: 14, font: fontBold });
    y -= 22;
  }
  y -= 12;

  // Corpo
  for (const linha of linhas(corpo)) {
    if (linha.trim() === "") {
      y -= ALTURA_LINHA * 0.6;
      continue;
    }
    for (const fisica of quebrar(linha, font, FONTE, larguraUtil)) {
      garantir(ALTURA_LINHA);
      page.drawText(fisica, { x: MARGEM, y: y - FONTE, size: FONTE, font });
      y -= ALTURA_LINHA;
    }
  }
  rodape();

  return pdf.save();
}

/** Gera o arquivo no formato pedido. */
export async function gerarArquivo(
  formato: FormatoExport,
  titulo: string,
  corpo: string,
): Promise<Uint8Array> {
  return formato === "pdf" ? gerarPdf(titulo, corpo) : gerarDocx(titulo, corpo);
}
