"use client";

import type { CSSProperties } from "react";

import { EmptyState } from "@/components/ui";
import type { PaperDesignConfig } from "@/components/papers/DesignTab";
import type { PaperDetailData } from "@/components/papers/PaperDetail";

/**
 * Live, design-driven render of the question paper shown on the View page.
 *
 * Every value comes from the current (local, unsaved) `design` state owned by
 * PaperDetail, so moving any Design control updates this immediately — no save,
 * no request, no change to the selected questions. This is the on-screen
 * preview only; the PDF/DOCX export renderer is untouched.
 */

/* ------------------------------ number formats ----------------------------- */

const BN_DIGIT = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const BN_LETTER = [
  "ক", "খ", "গ", "ঘ", "ঙ", "চ", "ছ", "জ", "ঝ", "ঞ", "ট", "ঠ", "ড", "ঢ", "ণ", "ত",
  "থ", "দ", "ধ", "ন", "প", "ফ", "ব", "ভ", "ম", "য", "র", "ল", "শ", "ষ", "স", "হ",
];
const AR_LETTER = [
  "ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط",
  "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي",
];

function toBnDigits(n: number): string {
  return String(n)
    .split("")
    .map((c) => BN_DIGIT[Number(c)] ?? c)
    .join("");
}

function toRoman(input: number): string {
  const table: [number, string][] = [
    [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"],
    [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
  ];
  let out = "";
  let n = input;
  for (const [value, symbol] of table) {
    while (n >= value) {
      out += symbol;
      n -= value;
    }
  }
  return out || "i";
}

/** Sequence label for a 0-based index in the given style (question numbers + MCQ labels). */
function seqLabel(index: number, style: string): string {
  switch (style) {
    case "bn-digit":
      return toBnDigits(index + 1);
    case "en-digit":
      return String(index + 1);
    case "bn-letter":
      return BN_LETTER[index % BN_LETTER.length] ?? String(index + 1);
    case "en-letter":
    case "en-lower":
      return String.fromCharCode(97 + (index % 26));
    case "en-upper":
      return String.fromCharCode(65 + (index % 26));
    case "roman":
      return toRoman(index + 1);
    case "arabic-letter":
      return AR_LETTER[index % AR_LETTER.length] ?? String(index + 1);
    default:
      return String(index + 1);
  }
}

function wrapOption(label: string, style: string): string {
  switch (style) {
    case "dot":
      return `${label}.`;
    case "paren-right":
      return `${label})`;
    case "spaced-paren":
      return `( ${label} )`;
    case "paren-both":
    default:
      return `(${label})`;
  }
}

/* -------------------------------- paper box ------------------------------- */

const PAPER_MM: Record<PaperDesignConfig["paper"]["size"], { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  Letter: { w: 216, h: 279 },
  Legal: { w: 216, h: 356 },
  A5: { w: 148, h: 210 },
};

const FONT_STACK: Record<PaperDesignConfig["font"]["family"], string> = {
  system: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  sans: "'Helvetica Neue', Arial, 'Liberation Sans', sans-serif",
  serif: "Georgia, 'Times New Roman', 'Liberation Serif', serif",
  mono: "'SFMono-Regular', 'Courier New', monospace",
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

interface PaperPreviewProps {
  design: PaperDesignConfig;
  paper: PaperDetailData;
  showAnswers: boolean;
}

export default function PaperPreview({ design, paper, showAnswers }: PaperPreviewProps) {
  const { header, studentInfo, codes, heading, layout, numbering, font, advanced } = design;
  const bn = heading.language === "bn";
  const L = (en: string, bnText: string) => (bn ? bnText : en);

  const dims = PAPER_MM[design.paper.size];
  const landscape = design.paper.orientation === "landscape";
  const sheetStyle: CSSProperties = {
    width: `${landscape ? dims.h : dims.w}mm`,
    minHeight: `${landscape ? dims.w : dims.h}mm`,
    maxWidth: "100%",
    padding: `${design.paper.marginMm}mm`,
    fontFamily: FONT_STACK[font.family],
    fontSize: `${font.size}px`,
  };

  const multiCol = layout.columnCount > 1;
  const listStyle: CSSProperties = multiCol
    ? {
        columnCount: layout.columnCount,
        columnGap: `${layout.columnGapMm}mm`,
        columnRule: layout.columnDivider ? "1px solid #cbd5e1" : "none",
      }
    : layout.fillAvailableSpace
      ? { display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "45vh" }
      : {};

  const itemStyle: CSSProperties = {
    breakInside: "avoid",
    marginBottom: `${Math.max(layout.rowGapMm, 3)}mm`,
    textAlign: layout.justify ? "justify" : "left",
  };

  const headerAlign =
    header.logoPosition === "left"
      ? "items-start text-left"
      : header.logoPosition === "right"
        ? "items-end text-right"
        : "items-center text-center";

  const headerFrame =
    header.headerStyle === "formal"
      ? "border-y-2 border-double border-slate-400 py-3"
      : header.headerStyle === "compact"
        ? "pb-2"
        : "border-b border-slate-300 pb-3";

  const totalMarks = header.totalMarks || String(paper.totalMarks);
  const boardYear = [header.board, header.year].filter(Boolean).join(" · ") || header.boardAndYear;

  const metaTop: string[] = [];
  if (header.subject) metaTop.push(`${L("Subject", "বিষয়")}: ${header.subject}`);
  if (header.className) metaTop.push(`${L("Class", "শ্রেণি")}: ${header.className}`);
  if (header.chapter) metaTop.push(`${L("Chapter", "অধ্যায়")}: ${header.chapter}`);
  if (boardYear) metaTop.push(`${L("Board", "বোর্ড")}: ${boardYear}`);

  const dateText =
    studentInfo.dateMode === "today"
      ? new Date().toLocaleDateString()
      : studentInfo.dateMode === "custom"
        ? studentInfo.customDate || "____________"
        : "____________";

  const studentFields: [string, string][] = [];
  if (studentInfo.name) studentFields.push([L("Name", "নাম"), "____________________"]);
  if (studentInfo.roll) studentFields.push([L("Roll", "রোল"), "____________"]);
  if (studentInfo.registration) studentFields.push([L("Registration", "রেজিস্ট্রেশন"), "____________"]);
  if (studentInfo.section) studentFields.push([L("Section", "শাখা"), "________"]);
  if (studentInfo.date) studentFields.push([L("Date", "তারিখ"), dateText]);

  const hideQuestions = design.output.question === false;

  const body = (
    <div style={{ position: "relative" }}>
      {advanced.headerBand ? (
        <div
          style={{
            background: "#0f172a",
            color: "#fff",
            textAlign: "center",
            fontSize: "11px",
            letterSpacing: "0.03em",
            padding: "5px 10px",
            borderRadius: "2px",
            marginBottom: "10px",
          }}
        >
          {advanced.headerBandText || " "}
        </div>
      ) : null}

      {/* Header & organization */}
      <div className={`flex flex-col gap-1 ${headerAlign} ${headerFrame}`}>
        {header.showLogo ? (
          <div className="mb-1 grid h-12 w-12 place-items-center rounded border border-dashed border-slate-300 text-[8px] uppercase tracking-wide text-slate-400">
            Logo
          </div>
        ) : null}
        {header.showOrganizationName && header.organizationName ? (
          <div
            style={{
              fontSize: `${font.headerSize * 1.35}px`,
              fontWeight: 700,
              lineHeight: 1.15,
              textTransform: "uppercase",
            }}
          >
            {header.organizationName}
          </div>
        ) : null}
        {header.showOrganizationAddress && header.organizationAddress ? (
          <div className="text-slate-500" style={{ fontSize: `${font.headerSize * 0.72}px` }}>
            {header.organizationAddress}
          </div>
        ) : null}
      </div>

      {/* Exam / paper information */}
      <div className="mt-2 text-center">
        {header.programName ? (
          <div style={{ fontSize: `${font.headerSize}px`, fontWeight: 600 }}>{header.programName}</div>
        ) : null}
        {metaTop.length > 0 ? (
          <div
            className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-0.5 text-slate-600"
            style={{ fontSize: `${font.size * 0.9}px` }}
          >
            {metaTop.map((entry) => (
              <span key={entry}>{entry}</span>
            ))}
          </div>
        ) : null}
        <div
          className="mt-0.5 flex flex-wrap justify-center gap-x-4 gap-y-0.5 font-medium text-slate-700"
          style={{ fontSize: `${font.size * 0.9}px` }}
        >
          <span>
            {L("Full Marks", "পূর্ণমান")}: {totalMarks}
          </span>
          {header.totalTime ? (
            <span>
              {L("Time", "সময়")}: {header.totalTime}
            </span>
          ) : null}
          {codes.showSubjectCode ? <span>{L("Subject Code", "বিষয় কোড")}: ______</span> : null}
          {codes.showQuestionSetCode ? <span>{L("Set Code", "সেট কোড")}: ______</span> : null}
        </div>
      </div>

      {/* Student information */}
      {studentFields.length > 0 || studentInfo.obtainedMarks ? (
        <div
          className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-y border-slate-200 py-1.5 text-slate-700"
          style={{ fontSize: `${font.size * 0.88}px` }}
        >
          {studentFields.map(([key, value]) => (
            <span key={key}>
              {key}: <span className="text-slate-400">{value}</span>
            </span>
          ))}
          {studentInfo.obtainedMarks ? (
            <span className="ml-auto rounded border border-slate-300 px-2 py-0.5 text-xs">
              {L("Obtained Marks", "প্রাপ্ত নম্বর")}: ______
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Instructions */}
      {header.instructions ? (
        <p
          className="mt-3 whitespace-pre-line text-center italic text-slate-600"
          style={{ fontSize: `${font.size * 0.9}px` }}
        >
          {header.instructions}
        </p>
      ) : null}

      {/* Questions */}
      {hideQuestions ? (
        <p className="mt-6 text-center text-sm text-slate-400">
          Question list hidden — enable “Question” under Design ▸ Basic Settings ▸ Output.
        </p>
      ) : paper.questions.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="This paper is empty" body="Add questions before publishing it." />
        </div>
      ) : (
        <ol className="mt-4" style={listStyle}>
          {paper.questions.map((question) => (
            <li key={question.number} style={itemStyle}>
              <div className="flex gap-2">
                {numbering.showQuestionNumber ? (
                  <span className="shrink-0 font-semibold">
                    {seqLabel(question.number - 1, numbering.questionNumbering)}.
                  </span>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <span style={{ fontSize: `${font.questionSize}px` }}>{question.text}</span>
                    {numbering.showMarksBesideQuestion ? (
                      <span
                        className="shrink-0 text-slate-500"
                        style={{ fontSize: `${font.size * 0.8}px` }}
                      >
                        [{question.marks}]
                      </span>
                    ) : null}
                  </div>

                  {question.options.length > 0 ? (
                    <div
                      className="mt-1 grid gap-x-6 gap-y-0.5 pl-1"
                      style={{
                        gridTemplateColumns: multiCol ? "1fr" : "repeat(2, minmax(0, 1fr))",
                        fontSize: `${font.optionSize}px`,
                      }}
                    >
                      {question.options.map((option, optionIndex) => (
                        <span key={option.label} className="text-slate-700">
                          <span className="text-slate-400">
                            {wrapOption(
                              seqLabel(optionIndex, numbering.mcqOptionLabels),
                              numbering.optionStyle,
                            )}
                          </span>{" "}
                          {option.text}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {showAnswers && question.answer ? (
                    <p
                      className="mt-1 rounded bg-emerald-50 px-2 py-1 text-emerald-900"
                      style={{ fontSize: `${font.size * 0.8}px` }}
                    >
                      <span className="font-semibold">{L("Answer", "উত্তর")}: </span>
                      {question.answer}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {advanced.footerBand ? (
        <div
          style={{
            background: "#0f172a",
            color: "#fff",
            textAlign: "center",
            fontSize: "11px",
            letterSpacing: "0.03em",
            padding: "5px 10px",
            borderRadius: "2px",
            marginTop: "14px",
          }}
        >
          {advanced.footerBandText || " "}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="paper-preview-scroll overflow-x-auto rounded-2xl bg-slate-100 p-4">
      <div
        className="paper-preview-sheet relative mx-auto bg-white text-slate-900 shadow-lg transition-[width,min-height] duration-200"
        style={sheetStyle}
      >
        {advanced.watermark ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
          >
            <span
              style={{
                transform: advanced.watermarkPosition === "horizontal" ? "none" : "rotate(-38deg)",
                fontSize: "84px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                color: "#000",
                opacity: clamp(advanced.watermarkOpacity / 100, 0.02, 0.4),
              }}
            >
              {advanced.watermarkText || "SAMPLE"}
            </span>
          </div>
        ) : null}

        {design.booklet.enabled ? (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-slate-300"
            />
            <span className="absolute right-2 top-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              Booklet
            </span>
          </>
        ) : null}

        {design.paper.twoCopiesPerPage ? (
          <div className="flex gap-[6mm]" style={{ fontSize: "0.82em" }}>
            <div className="min-w-0 flex-1">{body}</div>
            <div className="border-l border-dashed border-slate-400" />
            <div className="min-w-0 flex-1">{body}</div>
          </div>
        ) : (
          body
        )}
      </div>
    </div>
  );
}
