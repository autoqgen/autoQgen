"use client";

// ============================================================
// hooks/useQuestionPaper.ts
// Central state + orchestration for the Question Paper Builder.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchBoards,
  fetchCategories,
  fetchChapters,
  fetchExams,
  fetchSubjects,
  fetchRandomQuestions,
  createQuestionPaper,
  ApiError,
} from "../service/questionPaper.service";
import { validateQuestionPaper, hasErrors } from "../utils/validation";
import {
  type BasicInfoState,
  type Board,
  type Category,
  type Chapter,
  type Difficulty,
  type DistributionRow,
  type Exam,
  type PaperSettingsState,
  type QuestionPaperPayload,
  type QuestionType,
  type Subject,
  type ValidationErrors,
  initialBasicInfo,
  initialPaperSettings,
} from "../types";

// How long to wait after the last edit (e.g. typing a count) before
// auto-pulling matching questions from the question bank.
const AUTO_PULL_DEBOUNCE_MS = 500;

function rowSignature(row: DistributionRow): string {
  return `${row.chapterId}|${row.difficulty}|${row.questionType}|${row.count}`;
}

function makeRowId(): string {
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useQuestionPaper() {
  const router = useRouter();

  // ---------- Dropdown data ----------
  const [categories, setCategories] = useState<Category[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingChapters, setLoadingChapters] = useState(false);

  // ---------- Form state ----------
  const [basicInfo, setBasicInfo] = useState<BasicInfoState>(initialBasicInfo);
  const [settings, setSettings] =
    useState<PaperSettingsState>(initialPaperSettings);
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [distribution, setDistribution] = useState<DistributionRow[]>([]);

  // ---------- UI state ----------
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  // ================= Initial reference data =================
  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
    fetchBoards()
      .then(setBoards)
      .catch(() => setBoards([]));
    fetchExams()
      .then(setExams)
      .catch(() => setExams([]));
  }, []);

  // ================= Subjects (category change) =================
  useEffect(() => {
    setSubjects([]);
    setBasicInfo((prev) => ({ ...prev, subjectId: "" }));
    setChapters([]);
    setSelectedChapterIds([]);
    setDistribution([]);

    if (!basicInfo.categoryId) return;

    setLoadingSubjects(true);
    fetchSubjects(basicInfo.categoryId)
      .then(setSubjects)
      .catch(() => setSubjects([]))
      .finally(() => setLoadingSubjects(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basicInfo.categoryId]);

  // ================= Chapters (subject change) =================
  useEffect(() => {
    setChapters([]);
    setSelectedChapterIds([]);
    setDistribution([]);

    if (!basicInfo.subjectId) return;

    setLoadingChapters(true);
    fetchChapters(basicInfo.subjectId)
      .then(setChapters)
      .catch(() => setChapters([]))
      .finally(() => setLoadingChapters(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basicInfo.subjectId]);

  // ================= Basic info setter helper =================
  const updateBasicInfo = useCallback(
    <K extends keyof BasicInfoState>(key: K, value: BasicInfoState[K]) => {
      setBasicInfo((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const updateSettings = useCallback(
    <K extends keyof PaperSettingsState>(
      key: K,
      value: PaperSettingsState[K],
    ) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // ================= Chapter selection =================
  const toggleChapter = useCallback((chapterId: string) => {
    setSelectedChapterIds((prev) =>
      prev.includes(chapterId)
        ? prev.filter((id) => id !== chapterId)
        : [...prev, chapterId],
    );
  }, []);

  // Remove distribution rows tied to chapters that got unselected
  useEffect(() => {
    setDistribution((prev) =>
      prev.filter((row) => selectedChapterIds.includes(row.chapterId)),
    );
  }, [selectedChapterIds]);

  // ================= Distribution rows =================
  const addDistributionRow = useCallback((chapterId: string) => {
    if (!chapterId) return;
    setDistribution((prev) => [
      ...prev,
      {
        id: makeRowId(),
        chapterId,
        difficulty: "MEDIUM" as Difficulty,
        questionType: "MCQ" as QuestionType,
        count: 1,
        marksPerQuestion: 1,
        questionIds: [],
        fetchedCount: 0,
        status: "idle",
      },
    ]);
  }, []);

  const updateDistributionRow = useCallback(
    (rowId: string, patch: Partial<DistributionRow>) => {
      setDistribution((prev) =>
        prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
      );
    },
    [],
  );

  const removeDistributionRow = useCallback((rowId: string) => {
    setDistribution((prev) => prev.filter((row) => row.id !== rowId));
    delete autoPullTimers.current[rowId];
    delete lastSignatures.current[rowId];
  }, []);

  // ================= Auto-pull questions from question bank =================
  // Whenever a row's chapter/difficulty/type/count changes, debounce a
  // fetch to the question bank and fill in matching question ids.
  const autoPullTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const lastSignatures = useRef<Record<string, string>>({});

  const pullQuestionsForRow = useCallback(async (row: DistributionRow) => {
    if (!row.chapterId || !row.count || row.count <= 0) return;

    setDistribution((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? { ...r, status: "loading", errorMessage: undefined }
          : r,
      ),
    );

    try {
      const questions = await fetchRandomQuestions({
        chapter: row.chapterId,
        difficulty: row.difficulty,
        type: row.questionType,
        count: row.count,
      });

      setDistribution((prev) =>
        prev.map((r) => {
          if (r.id !== row.id) return r;
          const fetchedCount = questions.length;
          return {
            ...r,
            questionIds: questions.map((q) => q._id),
            fetchedCount,
            status: fetchedCount >= row.count ? "ok" : "insufficient",
          };
        }),
      );
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Question bank থেকে question আনতে সমস্যা হয়েছে";
      setDistribution((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                status: "error",
                errorMessage: message,
                questionIds: [],
                fetchedCount: 0,
              }
            : r,
        ),
      );
    }
  }, []);

  const refreshRowQuestions = useCallback(
    (rowId: string) => {
      const row = distribution.find((r) => r.id === rowId);
      if (row) pullQuestionsForRow(row);
    },
    [distribution, pullQuestionsForRow],
  );

  useEffect(() => {
    distribution.forEach((row) => {
      const signature = rowSignature(row);
      if (lastSignatures.current[row.id] === signature) return;
      lastSignatures.current[row.id] = signature;

      if (autoPullTimers.current[row.id]) {
        clearTimeout(autoPullTimers.current[row.id]);
      }
      autoPullTimers.current[row.id] = setTimeout(() => {
        pullQuestionsForRow(row);
      }, AUTO_PULL_DEBOUNCE_MS);
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distribution]);

  useEffect(() => {
    const timers = autoPullTimers.current;
    return () => {
      Object.values(timers).forEach((t) => clearTimeout(t));
    };
  }, []);

  // ================= Derived totals =================
  const totals = useMemo(() => {
    const totalQuestions = distribution.reduce(
      (sum, row) => sum + (Number(row.count) || 0),
      0,
    );
    const totalMarks = distribution.reduce(
      (sum, row) =>
        sum + (Number(row.count) || 0) * (Number(row.marksPerQuestion) || 0),
      0,
    );
    return { totalQuestions, totalMarks };
  }, [distribution]);

  const selectedChapters = useMemo(
    () => chapters.filter((c) => selectedChapterIds.includes(c._id)),
    [chapters, selectedChapterIds],
  );

  // ================= Payload builder =================
  const buildPayload = useCallback(
    (status: "DRAFT" | "PUBLISHED"): QuestionPaperPayload => ({
      title: basicInfo.title.trim(),
      category: basicInfo.categoryId,
      subject: basicInfo.subjectId,
      board: basicInfo.boardId || undefined,
      exam: basicInfo.examId || undefined,
      classLevel: basicInfo.classLevel || undefined,
      language: basicInfo.language,
      session: basicInfo.session || undefined,
      settings: {
        totalMarks: Number(settings.totalMarks),
        durationMinutes: Number(settings.durationMinutes),
        negativeMarking: settings.negativeMarking,
        negativeMarkValue: Number(settings.negativeMarkValue),
        instructions: settings.instructions,
        shuffleQuestions: settings.shuffleQuestions,
        showAnswerKey: settings.showAnswerKey,
      },
      chapters: selectedChapterIds,
      distribution: distribution.map((row) => ({
        chapter: row.chapterId,
        difficulty: row.difficulty,
        type: row.questionType,
        count: Number(row.count),
        marksPerQuestion: Number(row.marksPerQuestion),
        questionIds: row.questionIds,
      })),
      questions: distribution.flatMap((row) => row.questionIds),
      status,
    }),
    [basicInfo, settings, selectedChapterIds, distribution],
  );

  // ================= Submit =================
  const submit = useCallback(
    async (status: "DRAFT" | "PUBLISHED") => {
      const validationErrors = validateQuestionPaper({
        basicInfo,
        selectedChapterIds,
        distribution,
        settings,
      });
      setErrors(validationErrors);

      if (hasErrors(validationErrors)) {
        setSubmitError("ফর্মে কিছু ভুল রয়েছে, অনুগ্রহ করে সবকিছু চেক করুন।");
        return;
      }

      setSubmitError("");
      setSaving(true);
      try {
        await createQuestionPaper(buildPayload(status));
        router.push("/dashboard/questions");
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "প্রশ্নপত্র তৈরি ব্যর্থ হয়েছে, আবার চেষ্টা করুন";
        setSubmitError(message);
      } finally {
        setSaving(false);
      }
    },
    [
      basicInfo,
      settings,
      selectedChapterIds,
      distribution,
      buildPayload,
      router,
    ],
  );

  // ================= Reset =================
  const reset = useCallback(() => {
    setBasicInfo(initialBasicInfo);
    setSettings(initialPaperSettings);
    setSelectedChapterIds([]);
    setDistribution([]);
    setErrors({});
    setSubmitError("");
  }, []);

  return {
    // dropdown data
    categories,
    subjects,
    chapters,
    boards,
    exams,
    loadingSubjects,
    loadingChapters,

    // form state
    basicInfo,
    updateBasicInfo,
    settings,
    updateSettings,
    selectedChapterIds,
    selectedChapters,
    toggleChapter,
    distribution,
    addDistributionRow,
    updateDistributionRow,
    removeDistributionRow,
    refreshRowQuestions,

    // derived
    totals,

    // submit lifecycle
    errors,
    submitError,
    saving,
    submit,
    reset,
  };
}

export type UseQuestionPaperReturn = ReturnType<typeof useQuestionPaper>;
