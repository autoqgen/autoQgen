"use client";

import { AlertTriangle, Save, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button, Card, Field, Select, Spinner, TextInput, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";

const DEFAULT_SETTINGS = {
  siteName: "AutoQgen",
  defaultLanguage: "bn",
  maxQuestionsPerPaper: "100",
  defaultPaperQuestions: "10",
  allowSelfRegistration: "true",
  maintenanceMode: "false",
};

export default function AdminSettingsPage() {
  const toast = useToast();
  const [initialSettings, setInitialSettings] = useState(DEFAULT_SETTINGS);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    async function loadSettings() {
      setLoadingSettings(true);
      const result = await apiFetch<typeof DEFAULT_SETTINGS>("/api/admin/settings");
      setLoadingSettings(false);
      if (result.success && result.data) {
        setInitialSettings(result.data);
        setSettings(result.data);
      }
    }
    void loadSettings();
  }, []);

  // Validation: Check if all required fields are valid & provided
  const isValid = useMemo(() => {
    if (!settings.siteName || settings.siteName.trim().length < 2) return false;
    if (!settings.defaultPaperQuestions || Number(settings.defaultPaperQuestions) <= 0) return false;
    if (!settings.maxQuestionsPerPaper || Number(settings.maxQuestionsPerPaper) <= 0) return false;
    return true;
  }, [settings]);

  // Check if form has unsaved changes
  const isDirty = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(initialSettings);
  }, [settings, initialSettings]);

  // Button active state: Active whenever all required fields are valid & provided
  const canSave = isValid && !saving;

  // Handle browser tab/window close warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isNavigatingRef.current) return;
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Intercept internal page links & navigation when form is dirty
  useEffect(() => {
    if (!isDirty) return;

    function handleGlobalClick(e: MouseEvent) {
      if (isNavigatingRef.current) return;

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");

      if (anchor) {
        const href = anchor.getAttribute("href");
        if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
          try {
            const targetUrl = new URL(href, window.location.origin);
            if (targetUrl.pathname !== window.location.pathname) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              setPendingHref(targetUrl.href);
              setShowLeaveModal(true);
            }
          } catch {
            // Ignore invalid URLs
          }
        }
      }
    }

    // Push history state to intercept browser back button
    window.history.pushState({ isDirtyGuard: true }, "", window.location.href);

    function handlePopState() {
      if (isNavigatingRef.current) return;
      window.history.pushState({ isDirtyGuard: true }, "", window.location.href);
      setPendingHref(document.referrer || "/admin");
      setShowLeaveModal(true);
    }

    window.addEventListener("click", handleGlobalClick, true);
    document.addEventListener("click", handleGlobalClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("click", handleGlobalClick, true);
      document.removeEventListener("click", handleGlobalClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isDirty]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSave) return false;

    setSaving(true);
    const result = await apiFetch<typeof DEFAULT_SETTINGS>("/api/admin/settings", {
      method: "PUT",
      json: settings,
    });
    setSaving(false);

    if (!result.success) {
      toast.error(result.error.message);
      return false;
    }

    setInitialSettings(result.data);
    setSettings(result.data);
    toast.success("System configuration saved successfully!");
    return true;
  };

  const _handleDiscard = useCallback(() => {
    setSettings(initialSettings);
    toast.info("Unsaved changes discarded.");
  }, [initialSettings, toast]);

  const handleConfirmSaveAndLeave = async () => {
    const saved = await handleSave();
    if (saved) {
      isNavigatingRef.current = true;
      setShowLeaveModal(false);
      if (pendingHref) {
        window.location.href = pendingHref;
      }
    }
  };

  const handleConfirmDiscardAndLeave = () => {
    isNavigatingRef.current = true;
    setShowLeaveModal(false);
    toast.info("Changes discarded.");
    if (pendingHref) {
      window.location.href = pendingHref;
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">System Configuration</h1>
        <p className="mt-1 text-xs text-slate-500">
          Global platform settings, paper limits, and system controls.
        </p>
      </header>

      <Card className="p-6">
        {loadingSettings ? (
          <Spinner label="Loading settings…" />
        ) : (
          <form onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Site Name" required>
              {({ id }) => (
                <TextInput
                  id={id}
                  value={settings.siteName}
                  onChange={(e) => setSettings((s) => ({ ...s, siteName: e.target.value }))}
                />
              )}
            </Field>

            <Field label="Default Question Language">
              {({ id }) => (
                <Select
                  id={id}
                  value={settings.defaultLanguage}
                  onChange={(e) => setSettings((s) => ({ ...s, defaultLanguage: e.target.value }))}
                >
                  <option value="bn">Bengali (bn)</option>
                  <option value="en">English (en)</option>
                </Select>
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default Questions Per Paper" required>
              {({ id }) => (
                <TextInput
                  id={id}
                  type="number"
                  value={settings.defaultPaperQuestions}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, defaultPaperQuestions: e.target.value }))
                  }
                />
              )}
            </Field>

            <Field label="Max Questions Per Paper" required>
              {({ id }) => (
                <TextInput
                  id={id}
                  type="number"
                  value={settings.maxQuestionsPerPaper}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, maxQuestionsPerPaper: e.target.value }))
                  }
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Public Account Registration">
              {({ id }) => (
                <Select
                  id={id}
                  value={settings.allowSelfRegistration}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, allowSelfRegistration: e.target.value }))
                  }
                >
                  <option value="true">Enabled (Open Registration)</option>
                  <option value="false">Disabled (Admin Created Only)</option>
                </Select>
              )}
            </Field>

            <Field label="Maintenance Mode">
              {({ id }) => (
                <Select
                  id={id}
                  value={settings.maintenanceMode}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, maintenanceMode: e.target.value }))
                  }
                >
                  <option value="false">Disabled (Normal Operations)</option>
                  <option value="true">Enabled (Maintenance Banner)</option>
                </Select>
              )}
            </Field>
          </div>

          {/* Action Toolbar */}
          <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
            <Button
              type="submit"
              disabled={!canSave}
              loading={saving}
              className={`transition-all ${
                canSave
                  ? "bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20"
                  : "opacity-50 cursor-not-allowed bg-slate-200 text-slate-500"
              }`}
            >
              <Save className="h-4 w-4 mr-1" /> Save Settings
            </Button>
          </div>
        </form>
        )}
      </Card>

      {/* Unsaved Changes Leaving Modal Popup */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="max-w-md w-full rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Unsaved Changes</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    You have modified settings that haven&apos;t been saved yet.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowLeaveModal(false);
                  setPendingHref(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
              Would you like to save your configuration or discard your changes before leaving this page?
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowLeaveModal(false);
                  setPendingHref(null);
                }}
                className="w-full sm:w-auto text-xs"
              >
                Stay on Page
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={handleConfirmDiscardAndLeave}
                className="w-full sm:w-auto text-xs text-red-600 hover:bg-red-50 border-red-200"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Discard & Leave
              </Button>

              <Button
                type="button"
                disabled={!isValid || saving}
                onClick={() => void handleConfirmSaveAndLeave()}
                className="w-full sm:w-auto text-xs bg-brand-600 hover:bg-brand-700 text-white"
              >
                <Save className="h-3.5 w-3.5 mr-1" /> Save & Leave
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
