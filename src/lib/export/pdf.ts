import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

import { loadUnicodeFont, needsUnicodeFont, toWinAnsiSafe } from "@/lib/export/fonts";
import type { RenderedPaper, RenderedQuestion } from "@/lib/export/paper-document";

/**
 * PDF renderer.
 *
 * Deliberately hand-laid-out rather than HTML-to-PDF: no headless browser to
 * install or sandbox, deterministic output, and it runs inside a normal Node
 * serverless function.
 *
 * Layout: A4 portrait, 50pt margins, header block on page 1, running footer
 * with page numbers on every page, mark distribution table at the end.
 */

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 50;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;

const SIZE = { title: 18, subtitle: 10, meta: 10, section: 12, question: 11, option: 10, footer: 8 };
const LEADING = 1.35;

export interface PdfResult {
  bytes: Uint8Array;
  /** True when Bangla/Unicode text had to be substituted. */
  degraded: boolean;
}

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  pageNumber: number;
  regular: PDFFont;
  bold: PDFFont;
  unicode: boolean;
  degraded: boolean;
  paper: RenderedPaper;
}

function encode(ctx: Ctx, text: string): string {
  if (ctx.unicode) return text;
  if (needsUnicodeFont(text)) {
    ctx.degraded = true;
    return toWinAnsiSafe(text);
  }
  return text;
}

/** Greedy word wrap against real glyph widths. */
function wrap(ctx: Ctx, text: string, font: PDFFont, size: number, width: number): string[] {
  const safe = encode(ctx, text).replace(/\s+/g, " ").trim();
  if (!safe) return [""];

  const words = safe.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    let candidateWidth: number;

    try {
      candidateWidth = font.widthOfTextAtSize(candidate, size);
    } catch {
      // A glyph the font cannot measure — fall back conservatively.
      candidateWidth = candidate.length * size * 0.5;
    }

    if (candidateWidth <= width) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function addPage(ctx: Ctx): void {
  ctx.page = ctx.doc.addPage([PAGE.width, PAGE.height]);
  ctx.pageNumber += 1;
  ctx.y = PAGE.height - MARGIN;
}

function ensureSpace(ctx: Ctx, needed: number): void {
  if (ctx.y - needed < MARGIN + 30) addPage(ctx);
}

function drawLines(
  ctx: Ctx,
  lines: string[],
  options: { font: PDFFont; size: number; x?: number; gapAfter?: number; colour?: [number, number, number] },
): void {
  const lineHeight = options.size * LEADING;

  for (const line of lines) {
    ensureSpace(ctx, lineHeight);
    ctx.page.drawText(line, {
      x: options.x ?? MARGIN,
      y: ctx.y - options.size,
      size: options.size,
      font: options.font,
      color: options.colour ? rgb(...options.colour) : rgb(0.1, 0.1, 0.1),
    });
    ctx.y -= lineHeight;
  }

  if (options.gapAfter) ctx.y -= options.gapAfter;
}

function drawText(
  ctx: Ctx,
  text: string,
  options: { font: PDFFont; size: number; x?: number; width?: number; gapAfter?: number },
): void {
  const lines = wrap(ctx, text, options.font, options.size, options.width ?? CONTENT_WIDTH);
  drawLines(ctx, lines, options);
}

function drawHeader(ctx: Ctx): void {
  drawText(ctx, ctx.paper.title, { font: ctx.bold, size: SIZE.title, gapAfter: 4 });

  if (ctx.paper.subtitle) {
    drawText(ctx, ctx.paper.subtitle, { font: ctx.regular, size: SIZE.subtitle, gapAfter: 4 });
  }

  // Metadata rendered as a two-column key/value block.
  const half = CONTENT_WIDTH / 2 - 10;
  const rows = Math.ceil(ctx.paper.meta.length / 2);

  for (let row = 0; row < rows; row += 1) {
    ensureSpace(ctx, SIZE.meta * LEADING);
    const left = ctx.paper.meta[row];
    const right = ctx.paper.meta[row + rows];

    if (left) {
      ctx.page.drawText(encode(ctx, `${left.label}: ${left.value}`), {
        x: MARGIN,
        y: ctx.y - SIZE.meta,
        size: SIZE.meta,
        font: ctx.regular,
        color: rgb(0.25, 0.25, 0.25),
      });
    }
    if (right) {
      ctx.page.drawText(encode(ctx, `${right.label}: ${right.value}`), {
        x: MARGIN + half + 20,
        y: ctx.y - SIZE.meta,
        size: SIZE.meta,
        font: ctx.regular,
        color: rgb(0.25, 0.25, 0.25),
      });
    }

    ctx.y -= SIZE.meta * LEADING;
  }

  ctx.y -= 6;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE.width - MARGIN, y: ctx.y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  ctx.y -= 14;

  if (ctx.paper.instructions) {
    drawText(ctx, ctx.paper.instructions, {
      font: ctx.regular,
      size: SIZE.option,
      gapAfter: 10,
    });
  }
}

function drawQuestion(ctx: Ctx, question: RenderedQuestion): void {
  ensureSpace(ctx, 60);

  const marksLabel = `[${question.marks}]`;
  const marksWidth = ctx.bold.widthOfTextAtSize(marksLabel, SIZE.question) + 6;

  const bodyLines = wrap(
    ctx,
    `${question.number}. ${question.text}`,
    ctx.regular,
    SIZE.question,
    CONTENT_WIDTH - marksWidth,
  );

  // Marks sit on the same baseline as the first line of the question.
  ensureSpace(ctx, SIZE.question * LEADING);
  ctx.page.drawText(marksLabel, {
    x: PAGE.width - MARGIN - marksWidth + 6,
    y: ctx.y - SIZE.question,
    size: SIZE.question,
    font: ctx.bold,
    color: rgb(0.35, 0.35, 0.35),
  });

  drawLines(ctx, bodyLines, { font: ctx.regular, size: SIZE.question });

  if (question.creative) {
    if (question.creative.instruction) {
      drawText(ctx, question.creative.instruction, { font: ctx.regular, size: SIZE.option, gapAfter: 4 });
    }
    for (const part of question.creative.parts) {
      drawText(ctx, `${part.label}. ${part.text} [${part.marks}]`, {
        font: ctx.regular,
        size: SIZE.question,
        x: MARGIN + 18,
        width: CONTENT_WIDTH - 18,
      });
      if (part.answer) {
        drawText(ctx, `Answer: ${part.answer}`, { font: ctx.bold, size: SIZE.option, x: MARGIN + 36, width: CONTENT_WIDTH - 36 });
      }
    }
  }

  for (const option of question.options) {
    drawText(ctx, `(${option.label}) ${option.text}`, {
      font: ctx.regular,
      size: SIZE.option,
      x: MARGIN + 18,
      width: CONTENT_WIDTH - 18,
    });
  }

  if (question.note) {
    drawText(ctx, question.note, {
      font: ctx.regular,
      size: SIZE.footer,
      x: MARGIN + 18,
      width: CONTENT_WIDTH - 18,
    });
  }

  if (question.answer) {
    drawText(ctx, `Answer: ${question.answer}`, {
      font: ctx.bold,
      size: SIZE.option,
      x: MARGIN + 18,
      width: CONTENT_WIDTH - 18,
    });
  }

  if (question.explanation) {
    drawText(ctx, `Explanation: ${question.explanation}`, {
      font: ctx.regular,
      size: SIZE.footer,
      x: MARGIN + 18,
      width: CONTENT_WIDTH - 18,
    });
  }

  ctx.y -= 8;
}

function drawMarkDistribution(ctx: Ctx): void {
  if (ctx.paper.marksByType.length === 0) return;

  ensureSpace(ctx, 80);
  ctx.y -= 6;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE.width - MARGIN, y: ctx.y },
    thickness: 0.5,
    color: rgb(0.75, 0.75, 0.75),
  });
  ctx.y -= 14;

  drawText(ctx, "Mark distribution", { font: ctx.bold, size: SIZE.section, gapAfter: 4 });

  for (const row of ctx.paper.marksByType) {
    drawText(ctx, `${row.label}: ${row.count} question(s), ${row.marks} mark(s)`, {
      font: ctx.regular,
      size: SIZE.option,
      x: MARGIN + 10,
    });
  }

  drawText(ctx, `Total: ${ctx.paper.totalQuestions} question(s), ${ctx.paper.totalMarks} mark(s)`, {
    font: ctx.bold,
    size: SIZE.option,
    x: MARGIN + 10,
  });
}

function drawFooters(ctx: Ctx): void {
  const pages = ctx.doc.getPages();
  const stamp = ctx.paper.generatedAt.toISOString().slice(0, 10);
  const left = encode(ctx, `${ctx.paper.title} — ${ctx.paper.variant === "teacher" ? "Teacher copy" : "Student copy"}`);

  pages.forEach((page, index) => {
    page.drawLine({
      start: { x: MARGIN, y: MARGIN + 18 },
      end: { x: PAGE.width - MARGIN, y: MARGIN + 18 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });

    page.drawText(left, {
      x: MARGIN,
      y: MARGIN + 6,
      size: SIZE.footer,
      font: ctx.regular,
      color: rgb(0.45, 0.45, 0.45),
    });

    const label = `Page ${index + 1} of ${pages.length}  ·  ${stamp}`;
    const width = ctx.regular.widthOfTextAtSize(label, SIZE.footer);

    page.drawText(label, {
      x: PAGE.width - MARGIN - width,
      y: MARGIN + 6,
      size: SIZE.footer,
      font: ctx.regular,
      color: rgb(0.45, 0.45, 0.45),
    });
  });
}

export async function renderPaperPdf(paper: RenderedPaper): Promise<PdfResult> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  doc.setTitle(paper.title);
  doc.setCreator("AutoQgen");
  doc.setProducer("AutoQgen");

  const unicodeFont = loadUnicodeFont();

  let regular: PDFFont;
  let bold: PDFFont;
  let unicode = false;

  if (unicodeFont.loaded && unicodeFont.bytes) {
    const embedded = await doc.embedFont(unicodeFont.bytes, { subset: true });
    regular = embedded;
    // A single weight is embedded; bold reuses it so layout stays consistent.
    bold = embedded;
    unicode = true;
  } else {
    regular = await doc.embedFont(StandardFonts.Helvetica);
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  }

  const ctx: Ctx = {
    doc,
    page: doc.addPage([PAGE.width, PAGE.height]),
    y: PAGE.height - MARGIN,
    pageNumber: 1,
    regular,
    bold,
    unicode,
    degraded: false,
    paper,
  };

  drawHeader(ctx);

  paper.sections.forEach((section, index) => {
    if (section.title || section.instructions) {
      ensureSpace(ctx, 40);
      ctx.y -= 4;

      if (section.title) {
        drawText(ctx, `${section.title}  (${section.sectionMarks} marks)`, {
          font: ctx.bold,
          size: SIZE.section,
          gapAfter: 2,
        });
      }
      if (section.instructions) {
        drawText(ctx, section.instructions, { font: ctx.regular, size: SIZE.footer, gapAfter: 4 });
      }
    } else if (index > 0) {
      ctx.y -= 6;
    }

    for (const question of section.questions) {
      drawQuestion(ctx, question);
    }
  });

  drawMarkDistribution(ctx);
  drawFooters(ctx);

  return { bytes: await doc.save(), degraded: ctx.degraded };
}
