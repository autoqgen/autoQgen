import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
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
 * Uses the Paper Design configuration supplied by the live preview (or the
 * saved configuration for callers that do not send one).
 */

const LEADING = 1.35;
const MM_TO_PT = 72 / 25.4;
const PAPER_SIZE: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 216, height: 279 },
  Legal: { width: 216, height: 356 },
  A5: { width: 148, height: 210 },
};

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
  width: number;
  height: number;
  margin: number;
  originX: number;
  contentWidth: number;
  columnWidth: number;
  columnGap: number;
  column: number;
  columnCount: number;
  columnStartY: number;
}

function pageSize(paper: RenderedPaper): { width: number; height: number } {
  const size = PAPER_SIZE[paper.design.paper.size] ?? PAPER_SIZE.A4!;
  const landscape = paper.design.paper.orientation === "landscape";
  return {
    width: (landscape ? size.height : size.width) * MM_TO_PT,
    height: (landscape ? size.width : size.height) * MM_TO_PT,
  };
}

function fontSize(px: number): number {
  return px * 0.75;
}

function questionLabel(index: number, style: string): string {
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  const bnLetters = ["ক", "খ", "গ", "ঘ", "ঙ", "চ", "ছ", "জ", "ঝ", "ঞ", "ট", "ঠ", "ড", "ঢ", "ণ", "ত", "থ", "দ", "ধ", "ন", "প", "ফ", "ব", "ভ", "ম", "য", "র", "ল", "শ", "ষ", "স", "হ"];
  const arabicLetters = ["ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي"];
  const n = index + 1;
  if (style === "bn-digit") return String(n).replace(/\d/g, (digit) => bnDigits[Number(digit)] ?? digit);
  if (style === "bn-letter") return bnLetters[index % bnLetters.length] ?? String(n);
  if (style === "arabic-letter") return arabicLetters[index % arabicLetters.length] ?? String(n);
  if (style === "en-letter") return String.fromCharCode(97 + (index % 26));
  if (style === "roman") {
    const table: [number, string][] = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
    let remaining = n;
    return table.reduce((result, [value, symbol]) => {
      while (remaining >= value) {
        result += symbol;
        remaining -= value;
      }
      return result;
    }, "");
  }
  return String(n);
}

function optionLabel(index: number, labelStyle: string, optionStyle: string): string {
  const label = questionLabel(index, labelStyle === "en-lower" ? "en-letter" : labelStyle);
  const value = labelStyle === "en-upper" ? label.toUpperCase() : label;
  switch (optionStyle) {
    case "dot": return `${value}.`;
    case "paren-right": return `${value})`;
    case "spaced-paren": return `( ${value} )`;
    default: return `(${value})`;
  }
}

function drawBand(ctx: Ctx, text: string, top: boolean): void {
  const label = text || " ";
  const size = 8.25;
  const lines = wrap(ctx, label, ctx.regular, size, ctx.contentWidth - 12);
  const height = Math.max(size + 10, lines.length * size * LEADING + 10);
  ensureSpace(ctx, height);
  const y = ctx.y - height;
  ctx.page.drawRectangle({
    x: ctx.originX,
    y,
    width: ctx.contentWidth,
    height,
    color: rgb(0.06, 0.09, 0.16),
  });
  const textTop = ctx.y;
  ctx.y -= 4;
  drawLines(ctx, lines, {
    font: ctx.regular,
    size,
    x: ctx.originX + 6,
    width: ctx.contentWidth - 12,
    colour: [1, 1, 1],
    align: "center",
  });
  ctx.y = textTop - height;
  ctx.y -= top ? 3 : 14;
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
  const paragraphs = encode(ctx, text).split(/\r?\n/);
  const safe = paragraphs.map((line) => line.replace(/[^\S\r\n]+/g, " ").trim());
  const lines: string[] = [];
  for (const paragraph of safe) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(" ");
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      let candidateWidth: number;

      try {
        candidateWidth = font.widthOfTextAtSize(candidate, size);
      } catch {
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
  }

  return lines;
}

function addPage(ctx: Ctx): void {
  ctx.page = ctx.doc.addPage([ctx.width, ctx.height]);
  ctx.pageNumber += 1;
  ctx.columnStartY = ctx.height - ctx.margin;
  ctx.y = ctx.columnStartY;
  ctx.column = 0;
  drawPageOverlays(ctx, ctx.page);
  drawColumnDividers(ctx, ctx.page);
}

function ensureSpace(ctx: Ctx, needed: number): void {
  if (ctx.y - needed < ctx.margin + 20) {
    if (ctx.column + 1 < ctx.columnCount) {
      ctx.column += 1;
      ctx.y = ctx.columnStartY;
    } else {
      addPage(ctx);
    }
  }
}

function drawLines(
  ctx: Ctx,
  lines: string[],
  options: {
    font: PDFFont;
    size: number;
    x?: number;
    width?: number;
    gapAfter?: number;
    colour?: [number, number, number];
    align?: "left" | "center" | "right";
    justify?: boolean;
  },
): void {
  const lineHeight = options.size * LEADING;

  for (const [lineIndex, line] of lines.entries()) {
    ensureSpace(ctx, lineHeight);
    const textWidth = options.font.widthOfTextAtSize(line, options.size);
    const x = options.x ?? columnX(ctx);
    const width = options.width ?? ctx.columnWidth;
    const spaces = line.match(/ /g)?.length ?? 0;
    const additionalSpaces = options.justify && lineIndex < lines.length - 1 && spaces > 0
      ? Math.floor((width - textWidth) / Math.max(1, options.font.widthOfTextAtSize(" ", options.size) * spaces))
      : 0;
    const drawnLine = additionalSpaces > 0
      ? line.split(" ").join(`${" ".repeat(additionalSpaces + 1)}`)
      : line;
    const drawnWidth = options.font.widthOfTextAtSize(drawnLine, options.size);
    const alignedX =
      options.align === "center" ? x + Math.max(0, (width - drawnWidth) / 2) :
      options.align === "right" ? x + Math.max(0, width - drawnWidth) :
      x;
    ctx.page.drawText(drawnLine, {
      x: alignedX,
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
  options: {
    font: PDFFont;
    size: number;
    x?: number;
    width?: number;
    gapAfter?: number;
    align?: "left" | "center" | "right";
    justify?: boolean;
  },
): void {
  const lines = wrap(ctx, text, options.font, options.size, options.width ?? ctx.columnWidth);
  drawLines(ctx, lines, options);
}

function columnX(ctx: Ctx): number {
  return ctx.originX + ctx.column * (ctx.columnWidth + ctx.columnGap);
}

function drawPageOverlays(ctx: Ctx, page: PDFPage): void {
  const { booklet, advanced } = ctx.paper.design;
  if (booklet.enabled) {
    page.drawLine({
      start: { x: ctx.width / 2, y: ctx.margin },
      end: { x: ctx.width / 2, y: ctx.height - ctx.margin },
      thickness: 0.5,
      color: rgb(0.8, 0.82, 0.85),
      dashArray: [3, 3],
    });
    page.drawText("Booklet", {
      x: ctx.width - ctx.margin - 39,
      y: ctx.height - ctx.margin + 4,
      size: 7.5,
      font: ctx.regular,
      color: rgb(0.4, 0.44, 0.5),
    });
  }
  if (ctx.paper.design.paper.twoCopiesPerPage) {
    page.drawLine({
      start: { x: ctx.width / 2, y: ctx.margin },
      end: { x: ctx.width / 2, y: ctx.height - ctx.margin },
      thickness: 0.5,
      color: rgb(0.55, 0.58, 0.62),
      dashArray: [3, 3],
    });
  }

  if (advanced.watermark) {
    const watermark = encode(ctx, advanced.watermarkText || "SAMPLE").toUpperCase();
    const size = 54;
    const textWidth = ctx.bold.widthOfTextAtSize(watermark, size);
    page.drawText(watermark, {
      x: (ctx.width - textWidth) / 2,
      y: ctx.height / 2,
      size,
      font: ctx.bold,
      color: rgb(0, 0, 0),
      opacity: Math.min(0.4, Math.max(0.02, advanced.watermarkOpacity / 100)),
      rotate: degrees(advanced.watermarkPosition === "horizontal" ? 0 : -38),
    });
  }
}

function drawColumnDividers(ctx: Ctx, page: PDFPage): void {
  if (ctx.paper.design.layout.columnDivider && ctx.columnCount > 1) {
    for (let index = 1; index < ctx.columnCount; index += 1) {
      const x = ctx.originX + index * ctx.columnWidth + (index - 0.5) * ctx.columnGap;
      page.drawLine({
        start: { x, y: ctx.margin },
        end: { x, y: ctx.columnStartY },
        thickness: 0.5,
        color: rgb(0.8, 0.82, 0.85),
      });
    }
  }
}

function drawHeader(ctx: Ctx): void {
  const { header, studentInfo, codes, font, advanced, heading } = ctx.paper.design;
  const align = header.logoPosition === "left" ? "left" : header.logoPosition === "right" ? "right" : "center";
  const style = header.headerStyle;
  const horizontalRule = style !== "compact";

  if (advanced.headerBand) drawBand(ctx, advanced.headerBandText || " ", true);
  if (style === "formal") {
    ctx.page.drawLine({
      start: { x: columnX(ctx), y: ctx.y },
      end: { x: columnX(ctx) + ctx.columnWidth, y: ctx.y },
      thickness: 1.3,
      color: rgb(0.65, 0.68, 0.72),
    });
    ctx.y -= 8;
  }

  if (header.showLogo) {
    const logoSize = 36;
    ensureSpace(ctx, logoSize + 5);
    const x = align === "left" ? columnX(ctx) : align === "right" ? columnX(ctx) + ctx.columnWidth - logoSize : columnX(ctx) + (ctx.columnWidth - logoSize) / 2;
    ctx.page.drawRectangle({
      x,
      y: ctx.y - logoSize,
      width: logoSize,
      height: logoSize,
      borderColor: rgb(0.75, 0.78, 0.82),
      borderWidth: 0.6,
      borderDashArray: [2, 2],
    });
    ctx.page.drawText("Logo", {
      x: x + (logoSize - ctx.regular.widthOfTextAtSize("Logo", 6)) / 2,
      y: ctx.y - logoSize / 2,
      size: 6,
      font: ctx.regular,
      color: rgb(0.4, 0.44, 0.5),
    });
    ctx.y -= logoSize + 5;
  }

  if (header.showOrganizationName && header.organizationName) {
    drawText(ctx, header.organizationName.toLocaleUpperCase(), {
      font: ctx.bold,
      size: fontSize(font.headerSize * 1.35),
      align,
      gapAfter: 2,
    });
  }
  if (header.showOrganizationAddress && header.organizationAddress) {
    drawText(ctx, header.organizationAddress, {
      font: ctx.regular,
      size: fontSize(font.headerSize * 0.72),
      align,
      gapAfter: 3,
    });
  }

  if (horizontalRule) {
    ctx.y -= 2;
    ctx.page.drawLine({
      start: { x: columnX(ctx), y: ctx.y },
      end: { x: columnX(ctx) + ctx.columnWidth, y: ctx.y },
      thickness: style === "formal" ? 1.3 : 0.6,
      color: rgb(0.65, 0.68, 0.72),
    });
    if (style === "formal") {
      ctx.y -= 2;
      ctx.page.drawLine({
        start: { x: columnX(ctx), y: ctx.y },
        end: { x: columnX(ctx) + ctx.columnWidth, y: ctx.y },
        thickness: 0.5,
        color: rgb(0.65, 0.68, 0.72),
      });
    }
    ctx.y -= fontSize(12);
  } else {
    ctx.y -= fontSize(8);
  }

  ctx.y -= fontSize(8);
  if (header.programName) {
    drawText(ctx, header.programName, {
      font: ctx.bold,
      size: fontSize(font.headerSize),
      align: "center",
      gapAfter: 2,
    });
  }
  const metadata = [
    header.subject ? `${heading.language === "bn" ? "বিষয়" : "Subject"}: ${header.subject}` : "",
    header.className ? `${heading.language === "bn" ? "শ্রেণি" : "Class"}: ${header.className}` : "",
    header.chapter ? `${heading.language === "bn" ? "অধ্যায়" : "Chapter"}: ${header.chapter}` : "",
    [header.board, header.year].filter(Boolean).join(" · ") || header.boardAndYear,
  ].filter(Boolean);
  if (metadata.length) {
    drawText(ctx, metadata.join("    "), {
      font: ctx.regular,
      size: fontSize(font.size * 0.9),
      align: "center",
      gapAfter: 2,
    });
  }
  const summary = [
    `${heading.language === "bn" ? "পূর্ণমান" : "Full Marks"}: ${header.totalMarks || String(ctx.paper.totalMarks)}`,
    header.totalTime ? `${heading.language === "bn" ? "সময়" : "Time"}: ${header.totalTime}` : "",
    codes.showSubjectCode ? `${heading.language === "bn" ? "বিষয় কোড" : "Subject Code"}: ______` : "",
    codes.showQuestionSetCode ? `${heading.language === "bn" ? "সেট কোড" : "Set Code"}: ______` : "",
  ].filter(Boolean);
  drawText(ctx, summary.join("    "), {
    font: ctx.regular,
    size: fontSize(font.size * 0.9),
    align: "center",
    gapAfter: 4,
  });

  const studentFields: string[] = [];
  if (studentInfo.name) studentFields.push(`${heading.language === "bn" ? "নাম" : "Name"}: ____________________`);
  if (studentInfo.roll) studentFields.push(`${heading.language === "bn" ? "রোল" : "Roll"}: ____________`);
  if (studentInfo.registration) studentFields.push(`${heading.language === "bn" ? "রেজিস্ট্রেশন" : "Registration"}: ____________`);
  if (studentInfo.section) studentFields.push(`${heading.language === "bn" ? "শাখা" : "Section"}: ________`);
  if (studentInfo.date) {
    const date = studentInfo.dateMode === "today"
      ? new Date().toLocaleDateString()
      : studentInfo.dateMode === "custom" ? studentInfo.customDate || "____________" : "____________";
    studentFields.push(`${heading.language === "bn" ? "তারিখ" : "Date"}: ${date}`);
  }
  if (studentInfo.obtainedMarks) {
    studentFields.push(`${heading.language === "bn" ? "প্রাপ্ত নম্বর" : "Obtained Marks"}: ______`);
  }
  if (studentFields.length) {
    ctx.y -= fontSize(12);
    ctx.page.drawLine({
      start: { x: columnX(ctx), y: ctx.y },
      end: { x: columnX(ctx) + ctx.columnWidth, y: ctx.y },
      thickness: 0.5,
      color: rgb(0.82, 0.84, 0.87),
    });
    ctx.y -= 4;
    drawText(ctx, studentFields.join("    "), {
      font: ctx.regular,
      size: fontSize(font.size * 0.88),
      gapAfter: 4,
    });
    ctx.page.drawLine({
      start: { x: columnX(ctx), y: ctx.y },
      end: { x: columnX(ctx) + ctx.columnWidth, y: ctx.y },
      thickness: 0.5,
      color: rgb(0.82, 0.84, 0.87),
    });
    ctx.y -= 5;
  }

  if (header.instructions) {
    ctx.y -= fontSize(12);
    drawText(ctx, header.instructions, {
      font: ctx.regular,
      size: fontSize(font.size * 0.9),
      align: "center",
      gapAfter: 6,
    });
  }
  if (ctx.paper.design.booklet.enabled) ctx.y -= 3;
}

function drawPageHeader(ctx: Ctx): void {
  const columnWidth = ctx.columnWidth;
  const columnCount = ctx.columnCount;
  ctx.column = 0;
  ctx.columnWidth = ctx.contentWidth;
  ctx.columnCount = 1;
  drawHeader(ctx);
  ctx.columnWidth = columnWidth;
  ctx.columnCount = columnCount;
  ctx.columnStartY = ctx.y - fontSize(16);
  ctx.y = ctx.columnStartY;
}

function drawQuestion(ctx: Ctx, question: RenderedQuestion): void {
  const { font, numbering, heading, layout } = ctx.paper.design;
  const questionSize = fontSize(font.questionSize);
  const optionSize = fontSize(font.optionSize);
  const indent = 12;
  const marksWidth = numbering.showMarksBesideQuestion
    ? ctx.bold.widthOfTextAtSize(`[${question.marks}]`, questionSize) + 5
    : 0;
  const questionWidth = ctx.columnWidth - marksWidth;
  let estimatedHeight = wrap(ctx, question.text, ctx.regular, questionSize, questionWidth).length * questionSize * LEADING;
  if (question.stimulus) {
    estimatedHeight +=
      questionSize * LEADING * (1 + wrap(ctx, question.stimulus, ctx.regular, questionSize, ctx.columnWidth - fontSize(16)).length) +
      fontSize(18);
  }
  for (const part of question.parts ?? []) {
    estimatedHeight += wrap(ctx, `${part.label}) ${part.text}`, ctx.regular, questionSize, ctx.columnWidth - indent).length * questionSize * LEADING;
    estimatedHeight += part.options.reduce(
      (sum, option) => sum + wrap(ctx, `(${option.label}) ${option.text}`, ctx.regular, optionSize, ctx.columnWidth - indent * 2).length * optionSize * LEADING,
      0,
    );
    if (part.answer) estimatedHeight += wrap(ctx, `Answer: ${part.answer}`, ctx.bold, optionSize, ctx.columnWidth - indent * 2).length * optionSize * LEADING + 6;
  }
  if (question.options.length > 0) {
    const optionColumns = ctx.columnCount > 1 ? 1 : 2;
    const optionWidth = (ctx.columnWidth - fontSize(24)) / optionColumns;
    for (let index = 0; index < question.options.length; index += optionColumns) {
      let rowLines = 1;
      for (let column = 0; column < optionColumns && index + column < question.options.length; column += 1) {
        const optionIndex = index + column;
        const option = question.options[optionIndex]!;
        const text = `${optionLabel(optionIndex, numbering.mcqOptionLabels, numbering.optionStyle)} ${option.text}`;
        rowLines = Math.max(rowLines, wrap(ctx, text, ctx.regular, optionSize, optionWidth).length);
      }
      estimatedHeight += rowLines * optionSize * LEADING;
    }
  }
  if (question.answer) estimatedHeight += wrap(ctx, `Answer: ${question.answer}`, ctx.bold, optionSize, ctx.columnWidth - indent).length * optionSize * LEADING + 6;
  ensureSpace(ctx, estimatedHeight + Math.max(layout.rowGapMm, 3) * MM_TO_PT);

  if (question.stimulus) {
    const padding = fontSize(8);
    const stimulusLines = wrap(ctx, question.stimulus, ctx.regular, questionSize, ctx.columnWidth - padding * 2);
    const stimulusHeight = (stimulusLines.length + 1) * questionSize * LEADING + 2 + padding * 2;
    ensureSpace(ctx, stimulusHeight);
    ctx.page.drawRectangle({
      x: columnX(ctx),
      y: ctx.y - stimulusHeight,
      width: ctx.columnWidth,
      height: stimulusHeight,
      color: rgb(0.97, 0.98, 0.99),
    });
    ctx.y -= padding;
    drawText(ctx, `${heading.language === "bn" ? "উদ্দীপক" : "Stimulus"}:`, {
      font: ctx.bold,
      size: questionSize,
      gapAfter: 2,
      x: columnX(ctx) + padding,
      width: ctx.columnWidth - padding * 2,
    });
    drawText(ctx, question.stimulus, {
      font: ctx.regular,
      size: questionSize,
      x: columnX(ctx) + padding,
      width: ctx.columnWidth - padding * 2,
      gapAfter: fontSize(6),
      justify: layout.justify,
    });
    ctx.y -= padding - fontSize(6);
  }

  const number = numbering.showQuestionNumber
    ? `${questionLabel(question.number - 1, numbering.questionNumbering)}. `
    : "";
  const marks = numbering.showMarksBesideQuestion ? `[${question.marks}]` : "";
  const visibleMarksWidth = marks ? ctx.bold.widthOfTextAtSize(marks, questionSize) + 5 : 0;
  const questionLines = wrap(ctx, `${number}${question.text}`, ctx.regular, questionSize, ctx.columnWidth - visibleMarksWidth);
  ensureSpace(ctx, questionSize * LEADING);
  if (marks) {
    ctx.page.drawText(marks, {
      x: columnX(ctx) + ctx.columnWidth - ctx.bold.widthOfTextAtSize(marks, questionSize),
      y: ctx.y - questionSize,
      size: questionSize,
      font: ctx.bold,
      color: rgb(0.35, 0.35, 0.35),
    });
  }
  drawLines(ctx, questionLines, {
    font: ctx.regular,
    size: questionSize,
    width: ctx.columnWidth - visibleMarksWidth,
    justify: layout.justify,
  });

  for (const part of question.parts ?? []) {
    drawText(ctx, `${part.label}) ${part.text}`, {
      font: ctx.regular,
      size: questionSize,
      x: columnX(ctx) + indent,
      width: ctx.columnWidth - indent,
      justify: layout.justify,
    });
    for (const option of part.options) {
      drawText(ctx, `(${option.label}) ${option.text}`, {
        font: ctx.regular,
        size: optionSize,
        x: columnX(ctx) + indent * 2,
        width: ctx.columnWidth - indent * 2,
        justify: layout.justify,
      });
    }
    if (part.answer) drawAnswer(ctx, part.answer, optionSize, indent * 2, heading.language);
  }

  if (question.options.length > 0) {
    const optionColumns = ctx.columnCount > 1 ? 1 : 2;
    const optionWidth = (ctx.columnWidth - fontSize(24)) / optionColumns;
    question.options.forEach((option, index) => {
      const label = optionLabel(index, numbering.mcqOptionLabels, numbering.optionStyle);
      const column = index % optionColumns;
      drawText(ctx, `${label} ${option.text}`, {
        font: ctx.regular,
        size: optionSize,
        x: columnX(ctx) + indent + column * optionWidth,
        width: optionWidth,
        justify: layout.justify,
      });
      if (optionColumns === 2 && column === 1) ctx.y += optionSize * LEADING;
    });
  }

  if (question.answer) drawAnswer(ctx, question.answer, optionSize, indent, heading.language);

  ctx.y -= Math.max(layout.rowGapMm, 3) * MM_TO_PT;
}

function drawAnswer(ctx: Ctx, answer: string, size: number, indent: number, language: "bn" | "en"): void {
  const prefix = language === "bn" ? "উত্তর" : "Answer";
  const width = ctx.columnWidth - indent;
  const lines = wrap(ctx, `${prefix}: ${answer}`, ctx.bold, size, width - 8);
  const height = lines.length * size * LEADING + 6;
  ensureSpace(ctx, height);
  const x = columnX(ctx) + indent;
  ctx.page.drawRectangle({
    x,
    y: ctx.y - height,
    width,
    height,
    color: rgb(0.92, 0.97, 0.93),
  });
  ctx.y -= 3;
  drawLines(ctx, lines, {
    font: ctx.bold,
    size,
    x: x + 4,
    width: width - 8,
    colour: [0.08, 0.3, 0.16],
  });
  ctx.y -= 3;
}

export async function renderPaperPdfSingle(paper: RenderedPaper, copySide: 0 | 1 | null = null): Promise<PdfResult> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  doc.setTitle(paper.title);
  doc.setCreator("AutoQgen");
  doc.setProducer("AutoQgen");

  const unicodeFont = loadUnicodeFont();

  let regular: PDFFont;
  let bold: PDFFont;
  let unicode = false;
  const family = paper.design.font.family;
  const standardFonts = family === "serif"
    ? [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold] as const
    : family === "mono"
      ? [StandardFonts.Courier, StandardFonts.CourierBold] as const
      : [StandardFonts.Helvetica, StandardFonts.HelveticaBold] as const;

  if (unicodeFont.loaded && unicodeFont.bytes) {
    const embedded = await doc.embedFont(unicodeFont.bytes, { subset: true });
    regular = embedded;
    // A single weight is embedded; bold reuses it so layout stays consistent.
    bold = embedded;
    unicode = true;
  } else {
    regular = await doc.embedFont(standardFonts[0]);
    bold = await doc.embedFont(standardFonts[1]);
  }

  const dimensions = pageSize(paper);
  const margin = paper.design.paper.marginMm * MM_TO_PT;
  const copyGap = paper.design.paper.twoCopiesPerPage ? 6 * MM_TO_PT : 0;
  const contentWidth = paper.design.paper.twoCopiesPerPage
    ? (dimensions.width - margin * 2 - copyGap) / 2
    : dimensions.width - margin * 2;
  const originX = margin + (copySide ?? 0) * (contentWidth + copyGap);
  const columnCount = Math.min(4, Math.max(1, paper.design.layout.columnCount));
  const columnGap = Math.min(
    paper.design.layout.columnGapMm * MM_TO_PT,
    columnCount > 1 ? contentWidth / (columnCount * 2) : 0,
  );
  const columnWidth = (contentWidth - columnGap * (columnCount - 1)) / columnCount;
  const firstPage = doc.addPage([dimensions.width, dimensions.height]);
  const ctx: Ctx = {
    doc,
    page: firstPage,
    y: dimensions.height - margin,
    pageNumber: 1,
    regular,
    bold,
    unicode,
    degraded: false,
    paper,
    width: dimensions.width,
    height: dimensions.height,
    margin,
    originX,
    contentWidth,
    columnWidth,
    columnGap,
    column: 0,
    columnCount,
    columnStartY: dimensions.height - margin,
  };

  drawPageOverlays(ctx, firstPage);
  drawPageHeader(ctx);
  drawColumnDividers(ctx, firstPage);

  if (paper.design.output.question === false) {
    ctx.y -= fontSize(24);
    drawText(ctx, "Question list hidden — enable “Question” under Design ▸ Basic Settings ▸ Output.", {
      font: ctx.regular,
      size: fontSize(14),
      align: "center",
    });
  } else {
    for (const question of paper.sections.flatMap((section) => section.questions)) {
      drawQuestion(ctx, question);
    }
  }

  if (paper.design.advanced.footerBand) {
    drawBand(ctx, paper.design.advanced.footerBandText || " ", false);
  }

  return { bytes: await doc.save(), degraded: ctx.degraded };
}

export async function renderPaperPdf(paper: RenderedPaper): Promise<PdfResult> {
  if (!paper.design.paper.twoCopiesPerPage) return renderPaperPdfSingle(paper);

  const [left, right] = await Promise.all([
    renderPaperPdfSingle(paper, 0),
    renderPaperPdfSingle(paper, 1),
  ]);
  const output = await PDFDocument.create();
  const [leftPages, rightPages] = await Promise.all([
    output.embedPdf(left.bytes),
    output.embedPdf(right.bytes),
  ]);
  const dimensions = pageSize(paper);
  const pageCount = Math.max(leftPages.length, rightPages.length);
  for (let index = 0; index < pageCount; index += 1) {
    const page = output.addPage([dimensions.width, dimensions.height]);
    const leftPage = leftPages[index];
    const rightPage = rightPages[index];
    if (leftPage) page.drawPage(leftPage);
    if (rightPage) page.drawPage(rightPage);
  }
  return { bytes: await output.save(), degraded: left.degraded || right.degraded };
}
