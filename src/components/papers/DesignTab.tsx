"use client";

import type { ComponentType } from "react";
import { useState } from "react";
import {
  Barcode,
  BookOpen,
  Building2,
  Check as CheckIcon,
  ChevronDown,
  ClipboardList,
  Columns3,
  FileText,
  Languages,
  ListOrdered,
  RotateCcw,
  Save,
  Settings2,
  SlidersHorizontal,
  StickyNote,
  Type,
  User,
} from "lucide-react";

import { Alert, Badge, Button, Field, Select, TextInput } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";

/**
 * Design tab of the Paper View sidebar — paper appearance / output only.
 *
 * This tab is fully controlled: every control writes to `controller.value`
 * (local state owned by PaperDetail), which drives the live PaperPreview
 * immediately — no save, no request, no change to the selected questions.
 * "Save Design" persists `designConfig` via PATCH /api/papers/:id/design;
 * "Reset" restores the last-saved config. Neither regenerates questions,
 * touches QuestionUsage, or bumps the paper version.
 */

type Cfg = {
  template: string;
  output: Record<"question" | "sheet" | "downloadFile" | "answer" | "solution" | "explanation", boolean>;
  header: {
    showLogo: boolean;
    logoPosition: "left" | "center" | "right";
    headerStyle: "standard" | "compact" | "formal";
    showOrganizationName: boolean;
    organizationName: string;
    showOrganizationAddress: boolean;
    organizationAddress: string;
    programName: string;
    subject: string;
    className: string;
    chapter: string;
    board: string;
    year: string;
    boardAndYear: string;
    totalMarks: string;
    totalTime: string;
    instructions: string;
  };
  studentInfo: {
    name: boolean;
    roll: boolean;
    registration: boolean;
    section: boolean;
    obtainedMarks: boolean;
    date: boolean;
    dateMode: "blank" | "today" | "custom";
    customDate: string;
  };
  codes: { showSubjectCode: boolean; showQuestionSetCode: boolean };
  heading: { language: "bn" | "en"; style: string };
  layout: {
    arrangeBySubject: boolean;
    fillAvailableSpace: boolean;
    justify: boolean;
    columnCount: number;
    columnDivider: boolean;
    columnGapMm: number;
    rowGapMm: number;
  };
  numbering: {
    showQuestionNumber: boolean;
    questionNumbering: "bn-digit" | "en-digit" | "bn-letter" | "en-letter" | "roman" | "arabic-letter";
    optionStyle: "paren-both" | "dot" | "paren-right" | "spaced-paren";
    mcqOptionLabels: "bn-letter" | "en-lower" | "en-upper" | "roman" | "bn-digit";
    showMarksBesideQuestion: boolean;
  };
  font: {
    family: "system" | "sans" | "serif" | "mono";
    size: number;
    questionSize: number;
    optionSize: number;
    headerSize: number;
  };
  paper: {
    size: "A4" | "Letter" | "Legal" | "A5";
    orientation: "portrait" | "landscape";
    twoCopiesPerPage: boolean;
    marginMm: number;
  };
  booklet: { enabled: boolean };
  advanced: {
    watermark: boolean;
    watermarkText: string;
    watermarkOpacity: number;
    watermarkPosition: "diagonal" | "horizontal";
    headerBand: boolean;
    headerBandText: string;
    footerBand: boolean;
    footerBandText: string;
  };
};

/** Shared with PaperDetail / PaperPreview so the live preview reads the same shape. */
export type PaperDesignConfig = Cfg;

export interface DesignView {
  paperId: string;
  canSave: boolean;
  config: Cfg;
}

export interface DesignController {
  value: Cfg;
  onChange: (next: Cfg) => void;
  dirty: boolean;
  onReset: () => void;
  onSaved: () => void;
}

const QNUM_OPTS: { value: Cfg["numbering"]["questionNumbering"]; label: string }[] = [
  { value: "bn-digit", label: "১, ২, ৩" },
  { value: "en-digit", label: "1, 2, 3" },
  { value: "bn-letter", label: "ক, খ, গ" },
  { value: "en-letter", label: "a, b, c" },
  { value: "roman", label: "i, ii, iii" },
  { value: "arabic-letter", label: "ا, ب, ت" },
];
const OPT_STYLE: { value: Cfg["numbering"]["optionStyle"]; label: string }[] = [
  { value: "paren-both", label: "(A)" },
  { value: "dot", label: "A." },
  { value: "paren-right", label: "A)" },
  { value: "spaced-paren", label: "( A )" },
];
const MCQ_LABELS: { value: Cfg["numbering"]["mcqOptionLabels"]; label: string }[] = [
  { value: "bn-letter", label: "ক, খ, গ, ঘ" },
  { value: "en-lower", label: "a, b, c, d" },
  { value: "en-upper", label: "A, B, C, D" },
  { value: "roman", label: "i, ii, iii, iv" },
  { value: "bn-digit", label: "১, ২, ৩, ৪" },
];

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="accent-brand-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-slate-400">{children}</p>;
}

function Radio<T extends string>({
  name,
  options,
  value,
  onChange,
  inline,
}: {
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  inline?: boolean;
}) {
  return (
    <div className={`${inline ? "flex flex-wrap gap-x-4 gap-y-1" : "flex flex-col gap-1"} text-sm text-slate-700`}>
      {options.map((o) => (
        <label key={o.value} className="flex items-center gap-2">
          <input
            type="radio"
            name={name}
            className="accent-brand-600"
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  open,
  onToggle,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 py-1 text-left">
        <Icon className="h-4 w-4 shrink-0 text-slate-500" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</span>
        <ChevronDown className={`ml-auto h-4 w-4 text-slate-400 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open ? <div className="mt-2 flex flex-col gap-3">{children}</div> : null}
    </div>
  );
}

const EXAM_FIELDS: [keyof Cfg["header"], string][] = [
  ["programName", "Program / Exam Name"],
  ["subject", "Subject"],
  ["className", "Class"],
  ["chapter", "Chapter"],
  ["board", "Board"],
  ["year", "Year"],
  ["totalMarks", "Total Marks"],
  ["totalTime", "Total Time"],
];

export default function DesignTab({ view, controller }: { view: DesignView; controller: DesignController }) {
  const cfg = controller.value;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({
    basic: false,
    header: true,
    exam: true,
    student: false,
    instructions: false,
    codes: false,
    heading: false,
    layout: true,
    numbering: true,
    font: false,
    paper: false,
    booklet: false,
    advanced: cfg.advanced.watermark || cfg.advanced.headerBand || cfg.advanced.footerBand,
  }));
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  function set<K extends keyof Cfg>(key: K, value: Cfg[K]) {
    controller.onChange({ ...cfg, [key]: value });
  }
  function patch<K extends keyof Cfg>(key: K, part: Partial<Cfg[K]>) {
    controller.onChange({ ...cfg, [key]: { ...(cfg[key] as object), ...part } });
  }

  async function save() {
    setBusy(true);
    setError("");
    const r = await apiFetch(`/api/papers/${view.paperId}/design`, { method: "PATCH", json: cfg });
    setBusy(false);
    if (!r.success) {
      setError(r.error.message);
      return;
    }
    controller.onSaved();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">Paper design</p>
        {controller.dirty ? (
          <Badge tone="amber">Unsaved changes</Badge>
        ) : (
          <Badge tone="green">
            <span className="inline-flex items-center gap-1">
              <CheckIcon className="h-3 w-3" /> Saved
            </span>
          </Badge>
        )}
      </div>
      <p className="text-xs text-slate-500">Every change updates the paper on the left instantly. Nothing is saved until you press Save Design.</p>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {/* Basic settings */}
      <Section icon={Settings2} title="Basic Settings" open={open.basic ?? false} onToggle={() => toggle("basic")}>
        <Field label="Template">
          {({ id }) => (
            <Select id={id} value={cfg.template} onChange={(e) => set("template", e.target.value)}>
              <option value="none">None</option>
            </Select>
          )}
        </Field>
        <div>
          <FieldLabel>Output</FieldLabel>
          <div className="mt-1.5 flex flex-col gap-1">
            <Check label="Question paper" checked={cfg.output.question} onChange={(v) => patch("output", { question: v })} />
            <Check label="Answer sheet" checked={cfg.output.sheet} onChange={(v) => patch("output", { sheet: v })} />
            <Check label="Downloadable file" checked={cfg.output.downloadFile} onChange={(v) => patch("output", { downloadFile: v })} />
            <Check label="Answer key" checked={cfg.output.answer} onChange={(v) => patch("output", { answer: v })} />
            <Check label="Solution" checked={cfg.output.solution} onChange={(v) => patch("output", { solution: v })} />
            <Check label="Explanation" checked={cfg.output.explanation} onChange={(v) => patch("output", { explanation: v })} />
          </div>
        </div>
      </Section>

      {/* Header & organization */}
      <Section icon={Building2} title="Header & Organization" open={open.header ?? false} onToggle={() => toggle("header")}>
        <Check label="Show organization logo" checked={cfg.header.showLogo} onChange={(v) => patch("header", { showLogo: v })} />
        <div>
          <FieldLabel>Logo / header position</FieldLabel>
          <Radio
            name="logoPosition"
            inline
            value={cfg.header.logoPosition}
            onChange={(v) => patch("header", { logoPosition: v })}
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ]}
          />
        </div>
        <Field label="Header style">
          {({ id }) => (
            <Select
              id={id}
              value={cfg.header.headerStyle}
              onChange={(e) => patch("header", { headerStyle: e.target.value as Cfg["header"]["headerStyle"] })}
            >
              <option value="standard">Standard</option>
              <option value="compact">Compact</option>
              <option value="formal">Formal</option>
            </Select>
          )}
        </Field>
        <Check
          label="Show organization name"
          checked={cfg.header.showOrganizationName}
          onChange={(v) => patch("header", { showOrganizationName: v })}
        />
        <Field label="Organization Name">
          {({ id }) => (
            <TextInput id={id} value={cfg.header.organizationName} onChange={(e) => patch("header", { organizationName: e.target.value })} />
          )}
        </Field>
        <Check
          label="Show organization address"
          checked={cfg.header.showOrganizationAddress}
          onChange={(v) => patch("header", { showOrganizationAddress: v })}
        />
        <Field label="Organization Address">
          {({ id }) => (
            <TextInput
              id={id}
              value={cfg.header.organizationAddress}
              onChange={(e) => patch("header", { organizationAddress: e.target.value })}
            />
          )}
        </Field>
      </Section>

      {/* Exam information */}
      <Section icon={FileText} title="Exam Information" open={open.exam ?? false} onToggle={() => toggle("exam")}>
        {EXAM_FIELDS.map(([k, label]) => (
          <Field key={k} label={label}>
            {({ id }) => (
              <TextInput
                id={id}
                value={cfg.header[k] as string}
                onChange={(e) => patch("header", { [k]: e.target.value } as Partial<Cfg["header"]>)}
              />
            )}
          </Field>
        ))}
      </Section>

      {/* Instructions */}
      <Section icon={ClipboardList} title="Instructions" open={open.instructions ?? false} onToggle={() => toggle("instructions")}>
        <textarea
          rows={3}
          value={cfg.header.instructions}
          onChange={(e) => patch("header", { instructions: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Answer all questions…"
        />
      </Section>

      {/* Student information */}
      <Section icon={User} title="Student Information" open={open.student ?? false} onToggle={() => toggle("student")}>
        <Check label="Student name" checked={cfg.studentInfo.name} onChange={(v) => patch("studentInfo", { name: v })} />
        <Check label="Roll number" checked={cfg.studentInfo.roll} onChange={(v) => patch("studentInfo", { roll: v })} />
        <Check
          label="Registration number"
          checked={cfg.studentInfo.registration}
          onChange={(v) => patch("studentInfo", { registration: v })}
        />
        <Check label="Section" checked={cfg.studentInfo.section} onChange={(v) => patch("studentInfo", { section: v })} />
        <Check
          label="Obtained marks"
          checked={cfg.studentInfo.obtainedMarks}
          onChange={(v) => patch("studentInfo", { obtainedMarks: v })}
        />
        <Check label="Date" checked={cfg.studentInfo.date} onChange={(v) => patch("studentInfo", { date: v })} />
        <div className="pl-6">
          <FieldLabel>Date value</FieldLabel>
          <Radio
            name="dateMode"
            inline
            value={cfg.studentInfo.dateMode}
            onChange={(v) => patch("studentInfo", { dateMode: v })}
            options={[
              { value: "blank", label: "Blank" },
              { value: "today", label: "Today" },
              { value: "custom", label: "Custom" },
            ]}
          />
          {cfg.studentInfo.dateMode === "custom" ? (
            <TextInput
              className="mt-1"
              type="date"
              value={cfg.studentInfo.customDate}
              onChange={(e) => patch("studentInfo", { customDate: e.target.value })}
            />
          ) : null}
        </div>
      </Section>

      {/* Codes */}
      <Section icon={Barcode} title="Codes" open={open.codes ?? false} onToggle={() => toggle("codes")}>
        <Check
          label="Show subject code"
          checked={cfg.codes.showSubjectCode}
          onChange={(v) => patch("codes", { showSubjectCode: v })}
        />
        <Check
          label="Show question set code"
          checked={cfg.codes.showQuestionSetCode}
          onChange={(v) => patch("codes", { showQuestionSetCode: v })}
        />
      </Section>

      {/* Heading language & style */}
      <Section icon={Languages} title="Heading Language & Style" open={open.heading ?? false} onToggle={() => toggle("heading")}>
        <Field label="Heading language">
          {({ id }) => (
            <Select
              id={id}
              value={cfg.heading.language}
              onChange={(e) => patch("heading", { language: e.target.value as Cfg["heading"]["language"] })}
            >
              <option value="bn">বাংলা</option>
              <option value="en">English</option>
            </Select>
          )}
        </Field>
        <Field label="Heading style">
          {({ id }) => (
            <Select id={id} value={cfg.heading.style} onChange={(e) => patch("heading", { style: e.target.value })}>
              <option value="default">Default</option>
            </Select>
          )}
        </Field>
      </Section>

      {/* Question layout */}
      <Section icon={Columns3} title="Layout" open={open.layout ?? false} onToggle={() => toggle("layout")}>
        <Check
          label="Arrange by subject"
          checked={cfg.layout.arrangeBySubject}
          onChange={(v) => patch("layout", { arrangeBySubject: v })}
        />
        <Check
          label="Fill available space"
          checked={cfg.layout.fillAvailableSpace}
          onChange={(v) => patch("layout", { fillAvailableSpace: v })}
        />
        <Check label="Justify text" checked={cfg.layout.justify} onChange={(v) => patch("layout", { justify: v })} />
        <Field label="Column count">
          {({ id }) => (
            <Select
              id={id}
              value={String(cfg.layout.columnCount)}
              onChange={(e) => patch("layout", { columnCount: Number(e.target.value) })}
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Check
          label="Column divider"
          checked={cfg.layout.columnDivider}
          onChange={(v) => patch("layout", { columnDivider: v })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Column gap (mm)">
            {({ id }) => (
              <TextInput
                id={id}
                type="number"
                min={0}
                value={String(cfg.layout.columnGapMm)}
                onChange={(e) => patch("layout", { columnGapMm: Number(e.target.value) })}
              />
            )}
          </Field>
          <Field label="Row gap (mm)">
            {({ id }) => (
              <TextInput
                id={id}
                type="number"
                min={0}
                value={String(cfg.layout.rowGapMm)}
                onChange={(e) => patch("layout", { rowGapMm: Number(e.target.value) })}
              />
            )}
          </Field>
        </div>
      </Section>

      {/* Numbering & options */}
      <Section icon={ListOrdered} title="Numbering & Options" open={open.numbering ?? false} onToggle={() => toggle("numbering")}>
        <Check
          label="Show question number"
          checked={cfg.numbering.showQuestionNumber}
          onChange={(v) => patch("numbering", { showQuestionNumber: v })}
        />
        <div>
          <FieldLabel>Question numbering</FieldLabel>
          <Radio
            name="qnum"
            value={cfg.numbering.questionNumbering}
            onChange={(v) => patch("numbering", { questionNumbering: v })}
            options={QNUM_OPTS}
          />
        </div>
        <div>
          <FieldLabel>Option style</FieldLabel>
          <Radio
            name="optstyle"
            inline
            value={cfg.numbering.optionStyle}
            onChange={(v) => patch("numbering", { optionStyle: v })}
            options={OPT_STYLE}
          />
        </div>
        <div>
          <FieldLabel>MCQ option labels</FieldLabel>
          <Radio
            name="mcqlabels"
            value={cfg.numbering.mcqOptionLabels}
            onChange={(v) => patch("numbering", { mcqOptionLabels: v })}
            options={MCQ_LABELS}
          />
        </div>
        <Check
          label="Show marks beside question"
          checked={cfg.numbering.showMarksBesideQuestion}
          onChange={(v) => patch("numbering", { showMarksBesideQuestion: v })}
        />
      </Section>

      {/* Font */}
      <Section icon={Type} title="Font" open={open.font ?? false} onToggle={() => toggle("font")}>
        <Field label="Font family">
          {({ id }) => (
            <Select
              id={id}
              value={cfg.font.family}
              onChange={(e) => patch("font", { family: e.target.value as Cfg["font"]["family"] })}
            >
              <option value="system">System</option>
              <option value="sans">Sans-serif</option>
              <option value="serif">Serif</option>
              <option value="mono">Monospace</option>
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["size", "Base size"],
              ["questionSize", "Question size"],
              ["optionSize", "Option size"],
              ["headerSize", "Header size"],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label}>
              {({ id }) => (
                <TextInput
                  id={id}
                  type="number"
                  min={6}
                  max={48}
                  value={String(cfg.font[k])}
                  onChange={(e) => patch("font", { [k]: Number(e.target.value) } as Partial<Cfg["font"]>)}
                />
              )}
            </Field>
          ))}
        </div>
      </Section>

      {/* Paper */}
      <Section icon={StickyNote} title="Paper" open={open.paper ?? false} onToggle={() => toggle("paper")}>
        <div>
          <FieldLabel>Paper size</FieldLabel>
          <Radio
            name="papersize"
            inline
            value={cfg.paper.size}
            onChange={(v) => patch("paper", { size: v })}
            options={[
              { value: "A4", label: "A4" },
              { value: "Letter", label: "Letter" },
              { value: "Legal", label: "Legal" },
              { value: "A5", label: "A5" },
            ]}
          />
        </div>
        <div>
          <FieldLabel>Orientation</FieldLabel>
          <Radio
            name="orient"
            inline
            value={cfg.paper.orientation}
            onChange={(v) => patch("paper", { orientation: v })}
            options={[
              { value: "portrait", label: "Portrait" },
              { value: "landscape", label: "Landscape" },
            ]}
          />
        </div>
        <Check
          label="2 copies per page"
          checked={cfg.paper.twoCopiesPerPage}
          onChange={(v) => patch("paper", { twoCopiesPerPage: v })}
        />
        <Field label="Page margin (mm)">
          {({ id }) => (
            <TextInput
              id={id}
              type="number"
              min={0}
              max={50}
              value={String(cfg.paper.marginMm)}
              onChange={(e) => patch("paper", { marginMm: Number(e.target.value) })}
            />
          )}
        </Field>
      </Section>

      {/* Booklet */}
      <Section icon={BookOpen} title="Booklet" open={open.booklet ?? false} onToggle={() => toggle("booklet")}>
        <Check
          label="Prepare for booklet printing"
          checked={cfg.booklet.enabled}
          onChange={(v) => patch("booklet", { enabled: v })}
        />
      </Section>

      {/* Advanced */}
      <Section icon={SlidersHorizontal} title="Advanced" open={open.advanced ?? false} onToggle={() => toggle("advanced")}>
        <Check label="Watermark" checked={cfg.advanced.watermark} onChange={(v) => patch("advanced", { watermark: v })} />
        {cfg.advanced.watermark ? (
          <div className="flex flex-col gap-2 pl-6">
            <TextInput
              value={cfg.advanced.watermarkText}
              onChange={(e) => patch("advanced", { watermarkText: e.target.value })}
              placeholder="Watermark text"
            />
            <Field label={`Opacity (${cfg.advanced.watermarkOpacity}%)`}>
              {({ id }) => (
                <input
                  id={id}
                  type="range"
                  min={2}
                  max={40}
                  value={cfg.advanced.watermarkOpacity}
                  onChange={(e) => patch("advanced", { watermarkOpacity: Number(e.target.value) })}
                  className="w-full accent-brand-600"
                />
              )}
            </Field>
            <Radio
              name="wmpos"
              inline
              value={cfg.advanced.watermarkPosition}
              onChange={(v) => patch("advanced", { watermarkPosition: v })}
              options={[
                { value: "diagonal", label: "Diagonal" },
                { value: "horizontal", label: "Horizontal" },
              ]}
            />
          </div>
        ) : null}
        <Check label="Header band" checked={cfg.advanced.headerBand} onChange={(v) => patch("advanced", { headerBand: v })} />
        {cfg.advanced.headerBand ? (
          <TextInput
            className="ml-6 w-[calc(100%-1.5rem)]"
            value={cfg.advanced.headerBandText}
            onChange={(e) => patch("advanced", { headerBandText: e.target.value })}
            placeholder="Header band text"
          />
        ) : null}
        <Check label="Footer band" checked={cfg.advanced.footerBand} onChange={(v) => patch("advanced", { footerBand: v })} />
        {cfg.advanced.footerBand ? (
          <TextInput
            className="ml-6 w-[calc(100%-1.5rem)]"
            value={cfg.advanced.footerBandText}
            onChange={(e) => patch("advanced", { footerBandText: e.target.value })}
            placeholder="Footer band text"
          />
        ) : null}
      </Section>

      {/* Save / reset */}
      {view.canSave ? (
        <div className="mt-1 border-t border-slate-200 pt-4">
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              disabled={!controller.dirty || busy}
              onClick={controller.onReset}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset Changes
            </Button>
            <Button className="flex-1" loading={busy} disabled={!controller.dirty} onClick={save}>
              <Save className="h-3.5 w-3.5" /> Save Design
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Save persists appearance only — it never regenerates questions or changes the version.
          </p>
        </div>
      ) : null}
    </div>
  );
}
