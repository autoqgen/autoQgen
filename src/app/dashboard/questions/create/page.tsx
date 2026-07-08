"use client";

// ============================================================
// page.tsx
// Question Paper Builder — /dashboard/questions/create
// ============================================================

import { useQuestionPaper } from "./hooks/useQuestionPaper";
import BasicInformation from "./components/BasicInformation";
import ChapterSelector from "./components/ChapterSelector";
import PaperSettings from "./components/PaperSettings";
import QuestionDistribution from "./components/QuestionDistribution";
import PreviewCard from "./components/PreviewCard";
import FooterActions from "./components/FooterActions";

export default function QuestionPaperCreatePage() {
  const {
    categories,
    subjects,
    chapters,
    boards,
    exams,
    loadingSubjects,
    loadingChapters,

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

    totals,

    errors,
    submitError,
    saving,
    submit,
    reset,
  } = useQuestionPaper();

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold text-black">Question Paper Builder</h1>

      {submitError && (
        <div className="bg-red-100 text-red-700 px-4 py-3 rounded-xl">
          {submitError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left / main column */}
        <div className="lg:col-span-2 space-y-8">
          <BasicInformation
            basicInfo={basicInfo}
            updateBasicInfo={updateBasicInfo}
            categories={categories}
            subjects={subjects}
            boards={boards}
            exams={exams}
            loadingSubjects={loadingSubjects}
            errors={errors}
          />

          <ChapterSelector
            chapters={chapters}
            selectedChapterIds={selectedChapterIds}
            toggleChapter={toggleChapter}
            loadingChapters={loadingChapters}
            subjectSelected={!!basicInfo.subjectId}
            errors={errors}
          />

          <QuestionDistribution
            selectedChapters={selectedChapters}
            distribution={distribution}
            addDistributionRow={addDistributionRow}
            updateDistributionRow={updateDistributionRow}
            removeDistributionRow={removeDistributionRow}
            refreshRowQuestions={refreshRowQuestions}
            errors={errors}
          />

          <PaperSettings
            settings={settings}
            updateSettings={updateSettings}
            errors={errors}
          />
        </div>

        {/* Right / preview column */}
        <div className="lg:col-span-1">
          <PreviewCard
            basicInfo={basicInfo}
            settings={settings}
            selectedChapters={selectedChapters}
            distribution={distribution}
            categories={categories}
            subjects={subjects}
            boards={boards}
            exams={exams}
            totals={totals}
          />
        </div>
      </div>

      <FooterActions
        saving={saving}
        onReset={reset}
        onSaveDraft={() => submit("DRAFT")}
        onPublish={() => submit("PUBLISHED")}
      />
    </div>
  );
}
