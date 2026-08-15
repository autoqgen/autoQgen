import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import type { RenderedPaper, RenderedQuestion } from "@/lib/export/paper-document";

/**
 * DOCX renderer.
 *
 * Consumes the same RenderedPaper model as the PDF exporter, so the two outputs
 * carry identical content and ordering. Unlike PDF, DOCX is natively Unicode —
 * Bangla renders without any font installation step.
 */

const FONT = "Noto Sans Bengali";
const FALLBACK_FONT = "Calibri";

function body(text: string, options: { bold?: boolean; size?: number; italics?: boolean } = {}) {
  return new TextRun({
    text,
    bold: options.bold,
    italics: options.italics,
    // Half-points, as DOCX expects.
    size: (options.size ?? 11) * 2,
    font: { name: FONT, hint: "default" },
  });
}

function questionParagraphs(question: RenderedQuestion): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      spacing: { before: 160, after: 40 },
      children: [
        body(`${question.number}. `, { bold: true }),
        body(question.text),
        body(`   [${question.marks}]`, { bold: true }),
      ],
    }),
  ];

  for (const option of question.options) {
    paragraphs.push(
      new Paragraph({
        indent: { left: 480 },
        spacing: { after: 20 },
        children: [body(`(${option.label}) ${option.text}`, { size: 10.5 })],
      }),
    );
  }

  if (question.note) {
    paragraphs.push(
      new Paragraph({
        indent: { left: 480 },
        children: [body(question.note, { size: 9, italics: true })],
      }),
    );
  }

  if (question.answer) {
    paragraphs.push(
      new Paragraph({
        indent: { left: 480 },
        spacing: { before: 40 },
        children: [body("Answer: ", { bold: true, size: 10.5 }), body(question.answer, { size: 10.5 })],
      }),
    );
  }

  if (question.explanation) {
    paragraphs.push(
      new Paragraph({
        indent: { left: 480 },
        children: [
          body("Explanation: ", { bold: true, size: 9 }),
          body(question.explanation, { size: 9 }),
        ],
      }),
    );
  }

  return paragraphs;
}

function markDistributionTable(paper: RenderedPaper): Table {
  const header = new TableRow({
    tableHeader: true,
    children: ["Type", "Questions", "Marks"].map(
      (label) =>
        new TableCell({
          width: { size: 33, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [body(label, { bold: true, size: 10 })] })],
        }),
    ),
  });

  const rows = paper.marksByType.map(
    (row) =>
      new TableRow({
        children: [row.label, String(row.count), String(row.marks)].map(
          (value) =>
            new TableCell({
              children: [new Paragraph({ children: [body(value, { size: 10 })] })],
            }),
        ),
      }),
  );

  const total = new TableRow({
    children: ["Total", String(paper.totalQuestions), String(paper.totalMarks)].map(
      (value) =>
        new TableCell({
          children: [new Paragraph({ children: [body(value, { bold: true, size: 10 })] })],
        }),
    ),
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...rows, total],
  });
}

export async function renderPaperDocx(paper: RenderedPaper): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [body(paper.title, { bold: true, size: 18 })],
    }),
  );

  if (paper.subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [body(paper.subtitle, { italics: true, size: 10 })],
      }),
    );
  }

  // Metadata as a borderless two-column grid, mirroring the PDF header.
  const metaRows: TableRow[] = [];
  for (let index = 0; index < paper.meta.length; index += 2) {
    const left = paper.meta[index];
    const right = paper.meta[index + 1];

    metaRows.push(
      new TableRow({
        children: [left, right].map(
          (cell) =>
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              },
              children: [
                new Paragraph({
                  children: [cell ? body(`${cell.label}: ${cell.value}`, { size: 10 }) : body("")],
                }),
              ],
            }),
        ),
      }),
    );
  }

  if (metaRows.length > 0) {
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: metaRows }));
  }

  if (paper.instructions) {
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 120 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 4 },
        },
        children: [body(paper.instructions, { size: 10 })],
      }),
    );
  }

  for (const section of paper.sections) {
    if (section.title) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 60 },
          children: [body(`${section.title}  (${section.sectionMarks} marks)`, { bold: true, size: 12 })],
        }),
      );
    }

    if (section.instructions) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [body(section.instructions, { size: 9, italics: true })],
        }),
      );
    }

    for (const question of section.questions) {
      children.push(...questionParagraphs(question));
    }
  }

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 320, after: 80 },
      children: [body("Mark distribution", { bold: true, size: 12 })],
    }),
  );
  children.push(markDistributionTable(paper));

  const document = new Document({
    title: paper.title,
    creator: "AutoQgen",
    description: paper.variant === "teacher" ? "Teacher copy with answer key" : "Student copy",
    styles: {
      default: {
        document: {
          run: { font: { name: FONT, hint: "default" }, size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {},
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  body(
                    `${paper.title} — ${paper.variant === "teacher" ? "Teacher copy" : "Student copy"}   |   Page `,
                    { size: 8 },
                  ),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    font: { name: FALLBACK_FONT },
                  }),
                  body(" of ", { size: 8 }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    font: { name: FALLBACK_FONT },
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}
