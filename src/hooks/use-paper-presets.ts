"use client";

import { useCallback, useEffect, useState } from "react";

export interface PaperPresetSpec {
  category?: string;
  subject?: string;
  board?: string;
  exam?: string;
  language?: string;
  totalQuestions: number;
  totalMarks?: string;
  difficultyQuota?: Record<string, string>;
  typeQuota?: Record<string, string>;
  difficulty?: string;
  type?: string;
  scope?: "builder" | "regenerate" | "all";
}

export interface PaperPreset {
  id: string;
  name: string;
  isBuiltIn?: boolean;
  scope?: "builder" | "regenerate" | "all";
  spec: PaperPresetSpec;
}

const STORAGE_KEY = "autoqgen_paper_presets";

export const BUILT_IN_PRESETS: PaperPreset[] = [
  // Quick Builder Presets (10 Questions)
  {
    id: "builtin-quick-mcq",
    name: "Quick MCQ Quiz (10 Questions)",
    isBuiltIn: true,
    scope: "builder",
    spec: {
      totalQuestions: 10,
      type: "MCQ",
      typeQuota: { MCQ: "10" },
      scope: "builder",
    },
  },
  {
    id: "builtin-quick-easy",
    name: "Easy Practice Paper (10 Questions)",
    isBuiltIn: true,
    scope: "builder",
    spec: {
      totalQuestions: 10,
      difficulty: "EASY",
      difficultyQuota: { EASY: "10" },
      scope: "builder",
    },
  },
  {
    id: "builtin-quick-hard",
    name: "Hard Challenge Paper (10 Questions)",
    isBuiltIn: true,
    scope: "builder",
    spec: {
      totalQuestions: 10,
      difficulty: "HARD",
      difficultyQuota: { HARD: "10" },
      scope: "builder",
    },
  },
  {
    id: "builtin-quick-mixed",
    name: "Standard Quick Quiz (10 Questions)",
    isBuiltIn: true,
    scope: "builder",
    spec: {
      totalQuestions: 10,
      scope: "builder",
    },
  },

  // Full Paper Regenerate Presets
  {
    id: "builtin-standard-exam",
    name: "Standard Board Test (25 Questions)",
    isBuiltIn: true,
    scope: "regenerate",
    spec: {
      totalQuestions: 25,
      totalMarks: "25",
      difficultyQuota: { EASY: "10", MEDIUM: "10", HARD: "5" },
      typeQuota: { MCQ: "20", SHORT: "5" },
      scope: "regenerate",
    },
  },
  {
    id: "builtin-comprehensive-final",
    name: "Comprehensive Assessment (50 Questions)",
    isBuiltIn: true,
    scope: "regenerate",
    spec: {
      totalQuestions: 50,
      totalMarks: "50",
      difficultyQuota: { EASY: "15", MEDIUM: "20", HARD: "10", EXPERT: "5" },
      typeQuota: { MCQ: "35", SHORT: "10", WRITTEN: "5" },
      scope: "regenerate",
    },
  },
];

export function usePaperPresets(scope?: "builder" | "regenerate") {
  const [userPresets, setUserPresets] = useState<PaperPreset[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          queueMicrotask(() => {
            setUserPresets(parsed);
          });
        }
      }
    } catch {
      // Ignore localStorage parse errors
    }
  }, []);

  const savePreset = useCallback((name: string, spec: PaperPresetSpec): PaperPreset => {
    const newPreset: PaperPreset = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      isBuiltIn: false,
      scope: spec.scope || scope || "all",
      spec,
    };

    setUserPresets((prev) => {
      const next = [newPreset, ...prev];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore localStorage write errors
      }
      return next;
    });

    return newPreset;
  }, [scope]);

  const updatePreset = useCallback((id: string, name: string, spec?: PaperPresetSpec): PaperPreset | null => {
    let updated: PaperPreset | null = null;
    setUserPresets((prev) => {
      const next = prev.map((p) => {
        if (p.id === id) {
          updated = {
            ...p,
            name: name.trim(),
            spec: spec ? spec : p.spec,
          };
          return updated;
        }
        return p;
      });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore localStorage write errors
      }
      return next;
    });
    return updated;
  }, []);

  const deletePreset = useCallback((id: string) => {
    setUserPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore localStorage write errors
      }
      return next;
    });
  }, []);

  const allPresets = [...userPresets, ...BUILT_IN_PRESETS];

  const presets = scope
    ? allPresets.filter(
        (p) =>
          !p.scope ||
          p.scope === "all" ||
          p.scope === scope ||
          p.spec.scope === scope ||
          p.spec.scope === "all",
      )
    : allPresets;

  return {
    presets,
    userPresets,
    savePreset,
    updatePreset,
    deletePreset,
  };
}
