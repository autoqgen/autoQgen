/**
 * Theme constants + the tiny inline script that applies the persisted theme
 * before the first paint (no flash of the wrong theme).
 *
 * Kept dependency-free and framework-agnostic so it can be stringified straight
 * into a <script> tag in the root layout.
 */

export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "autoqgen-theme";
export const THEMES: Theme[] = ["light", "dark", "system"];

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/** Resolve a stored preference to the concrete theme that should be shown. */
export function resolveTheme(theme: Theme, systemPrefersDark: boolean): "light" | "dark" {
  if (theme === "system") return systemPrefersDark ? "dark" : "light";
  return theme;
}

/**
 * Runs synchronously in <head>. Reads localStorage, falls back to the OS
 * preference, and toggles the `.dark` class + `color-scheme` on <html> so the
 * very first paint is already correct.
 */
export const themeInitScript = `(function(){try{var k="${THEME_STORAGE_KEY}";var t=localStorage.getItem(k);var m=window.matchMedia("(prefers-color-scheme: dark)").matches;var dark=t==="dark"||((t===null||t==="system")&&m);var e=document.documentElement;e.classList.toggle("dark",dark);e.style.colorScheme=dark?"dark":"light";}catch(e){}})();`;
