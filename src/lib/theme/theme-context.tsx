"use client";

import {
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  isTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme/theme-script";

interface ThemeContextValue {
  /** The user's stored preference. */
  theme: Theme;
  /** The concrete theme currently applied ("light" | "dark"). */
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const DARK_QUERY = "(prefers-color-scheme: dark)";
/** Fired on this tab after we write localStorage (`storage` only fires cross-tab). */
const LOCAL_EVENT = "autoqgen:theme-change";

/* ------------------------------------------------------------------ *
 * The DOM (`<html class="dark">` + `color-scheme`) is the source of
 * truth for what's on screen. `setTheme` mutates it synchronously in
 * the same tick as the click, so the switch is a single repaint with
 * no React round-trip. Only components that call `useTheme()` (the
 * toggle) re-render on change — never the whole app.
 * ------------------------------------------------------------------ */

function getStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches;
}

/** Reflect a resolved theme onto <html> — mirrors the inline boot script. */
function applyResolvedTheme(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

/** Re-derive the DOM state from the persisted preference. */
function syncDomFromStorage() {
  applyResolvedTheme(resolveTheme(getStoredTheme(), systemPrefersDark()));
}

export function setTheme(next: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* ignore write failures (private mode, quota) */
  }
  // Apply now — do not wait for the store notification → render → effect.
  applyResolvedTheme(resolveTheme(next, systemPrefersDark()));
  window.dispatchEvent(new Event(LOCAL_EVENT));
}

/* ---- external store: powers `useTheme()` for the toggle's UI state ---- */

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(DARK_QUERY);
  window.addEventListener("storage", onChange);
  window.addEventListener(LOCAL_EVENT, onChange);
  mql.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOCAL_EVENT, onChange);
    mql.removeEventListener("change", onChange);
  };
}

let snapshot: { theme: Theme; resolved: "light" | "dark" } = {
  theme: "system",
  resolved: "light",
};

function getSnapshot() {
  const theme = getStoredTheme();
  const resolved = resolveTheme(theme, systemPrefersDark());
  if (theme !== snapshot.theme || resolved !== snapshot.resolved) {
    snapshot = { theme, resolved };
  }
  return snapshot;
}

const SERVER_SNAPSHOT = snapshot;
function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

/**
 * Holds the single app-wide listener that re-applies the theme when the OS
 * preference changes (only visible while the preference is "system") and when
 * another tab changes it. Renders no state of its own, so a theme change never
 * re-renders the tree through here.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    syncDomFromStorage();
    const mql = window.matchMedia(DARK_QUERY);
    const onChange = () => syncDomFromStorage();
    mql.addEventListener("change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return <>{children}</>;
}

export function useTheme(): ThemeContextValue {
  const { theme, resolved } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return { theme, resolvedTheme: resolved, setTheme };
}
