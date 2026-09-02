"use client";

import { AlertTriangle, Save, Trash2, X } from "lucide-react";
import { Button } from "./index";

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onStay: () => void;
  onDiscard: () => void;
  onSave?: () => void;
  canSave?: boolean;
  saving?: boolean;
  title?: string;
  description?: string;
}

export function UnsavedChangesModal({
  isOpen,
  onStay,
  onDiscard,
  onSave,
  canSave = true,
  saving = false,
  title = "Unsaved Changes",
  description = "You have modified content that hasn't been saved yet. Would you like to save your work or discard your changes before leaving this page?",
}: UnsavedChangesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="max-w-md w-full rounded-2xl bg-card p-6 shadow-2xl border border-slate-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Unsaved modifications detected.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onStay}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
          {description}
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="ghost" onClick={onStay} className="w-full sm:w-auto text-xs">
            Stay on Page
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={onDiscard}
            className="w-full sm:w-auto text-xs text-red-600 hover:bg-red-50 border-red-200"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Discard & Leave
          </Button>

          {onSave && (
            <Button
              type="button"
              disabled={!canSave || saving}
              loading={saving}
              onClick={onSave}
              className="w-full sm:w-auto text-xs bg-brand-600 hover:bg-brand-700 text-white"
            >
              <Save className="h-3.5 w-3.5 mr-1" /> Save & Leave
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
