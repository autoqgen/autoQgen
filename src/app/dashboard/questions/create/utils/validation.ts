// ============================================================
// utils/validation.ts
// Form validation for the Question Paper Builder
// ============================================================

import type {
  BasicInfoState,
  DistributionRow,
  PaperSettingsState,
  ValidationErrors,
} from "../types";

interface ValidateArgs {
  basicInfo: BasicInfoState;
  selectedChapterIds: string[];
  distribution: DistributionRow[];
  settings: PaperSettingsState;
}

/**
 * Validates the full question-paper form.
 * Returns an object keyed by field name; empty object === valid.
 */
export function validateQuestionPaper({
  basicInfo,
  selectedChapterIds,
  distribution,
  settings,
}: ValidateArgs): ValidationErrors {
  const errors: ValidationErrors = {};

  // ---------- Basic Information ----------
  if (!basicInfo.title.trim()) {
    errors.title = "প্রশ্নপত্রের শিরোনাম দিন";
  }
  if (!basicInfo.categoryId) {
    errors.categoryId = "Category select করুন";
  }
  if (!basicInfo.subjectId) {
    errors.subjectId = "Subject select করুন";
  }

  // ---------- Chapters ----------
  if (selectedChapterIds.length === 0) {
    errors.chapters = "কমপক্ষে ১টি Chapter select করুন";
  }

  // ---------- Distribution ----------
  if (distribution.length === 0) {
    errors.distribution = "কমপক্ষে ১টি Question Distribution row যোগ করুন";
  } else {
    const invalidRow = distribution.find(
      (row) =>
        !row.chapterId ||
        row.count <= 0 ||
        row.marksPerQuestion <= 0 ||
        !Number.isFinite(row.count) ||
        !Number.isFinite(row.marksPerQuestion),
    );
    if (invalidRow) {
      errors.distribution =
        "প্রতিটি row-এ Chapter, Question Count (>0) এবং Marks (>0) থাকতে হবে";
    }

    const pendingRow = distribution.find(
      (row) => row.status === "loading" || row.status === "idle",
    );
    if (!errors.distribution && pendingRow) {
      errors.distribution =
        "Question bank থেকে questions auto-pull হওয়া পর্যন্ত অপেক্ষা করুন";
    }

    const insufficientRow = distribution.find(
      (row) => row.status === "insufficient",
    );
    if (!errors.distribution && insufficientRow) {
      errors.distribution = `একটি row-এ পর্যাপ্ত question পাওয়া যায়নি (${insufficientRow.fetchedCount}/${insufficientRow.count} পাওয়া গেছে)। Count কমান অথবা question bank-এ আরও question যোগ করুন`;
    }

    const errorRow = distribution.find((row) => row.status === "error");
    if (!errors.distribution && errorRow) {
      errors.distribution =
        errorRow.errorMessage ||
        "Question bank থেকে question আনতে সমস্যা হয়েছে";
    }

    const chaptersWithoutDistribution = selectedChapterIds.filter(
      (chapterId) => !distribution.some((row) => row.chapterId === chapterId),
    );
    if (chaptersWithoutDistribution.length > 0) {
      errors.distribution =
        "প্রতিটি selected Chapter-এর জন্য কমপক্ষে ১টি distribution row দিন";
    }
  }

  // ---------- Settings ----------
  if (!settings.totalMarks || settings.totalMarks <= 0) {
    errors.totalMarks = "সঠিক Total Marks দিন";
  }
  if (!settings.durationMinutes || settings.durationMinutes <= 0) {
    errors.durationMinutes = "সঠিক Duration দিন";
  }
  if (settings.negativeMarking && settings.negativeMarkValue <= 0) {
    errors.negativeMarkValue = "সঠিক Negative Mark Value দিন";
  }

  // ---------- Marks consistency ----------
  const calculatedMarks = distribution.reduce(
    (sum, row) => sum + row.count * row.marksPerQuestion,
    0,
  );
  if (
    !errors.distribution &&
    !errors.totalMarks &&
    calculatedMarks !== settings.totalMarks
  ) {
    errors.marksMismatch = `Distribution অনুযায়ী মোট Marks ${calculatedMarks}, কিন্তু Total Marks সেট করা আছে ${settings.totalMarks}`;
  }

  return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function firstErrorMessage(errors: ValidationErrors): string {
  const keys = Object.keys(errors);
  return keys.length ? errors[keys[0]] : "";
}
