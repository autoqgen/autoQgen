"use client";

// ============================================================
// components/FooterActions.tsx
// ============================================================

interface FooterActionsProps {
  saving: boolean;
  onReset: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
}

export default function FooterActions({
  saving,
  onReset,
  onSaveDraft,
  onPublish,
}: FooterActionsProps) {
  return (
    <div className="flex flex-wrap gap-3 justify-end pb-10">
      <button
        type="button"
        onClick={onReset}
        disabled={saving}
        className="px-5 py-2.5 border border-gray-400 rounded-xl text-black hover:bg-gray-100 transition disabled:opacity-50"
      >
        Reset
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={onSaveDraft}
        className="px-5 py-2.5 border border-purple-500 text-purple-600 rounded-xl hover:bg-purple-50 transition disabled:opacity-50"
      >
        Save Draft
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={onPublish}
        className="bg-linear-to-r from-fuchsia-500 to-purple-600 text-white px-6 py-3 rounded-xl shadow-lg hover:scale-105 transition disabled:opacity-50"
      >
        {saving ? "Saving..." : "Generate Question Paper"}
      </button>
    </div>
  );
}
