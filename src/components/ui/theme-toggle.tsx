"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useTheme } from "@/lib/theme/theme-context";
import type { Theme } from "@/lib/theme/theme-script";

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "system", label: "System", Icon: Monitor },
  { value: "dark", label: "Dark", Icon: Moon },
];

/**
 * Collapsed theme switcher: a single icon button that opens a Light / System /
 * Dark menu. The button shows the current preference; server and first client
 * render both resolve to "system" (see theme-context), then reconcile with no
 * hydration warning.
 */
export function ThemeToggle({
  className = "",
  menuPlacement = "bottom",
}: {
  className?: string;
  menuPlacement?: "top" | "bottom";
}) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const current =
    OPTIONS.find((o) => o.value === theme) ??
    ({ value: "system", label: "System", Icon: Monitor } as (typeof OPTIONS)[number]);
  const CurrentIcon = current.Icon;

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Theme: ${current.label}`}
        title={`Theme: ${current.label}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-card text-slate-600 shadow-xs transition hover:bg-slate-100 hover:text-slate-900"
      >
        <CurrentIcon className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Colour theme"
          className={`absolute right-0 z-50 w-36 rounded-xl border border-slate-200 bg-popover p-1 shadow-xl ${
            menuPlacement === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {OPTIONS.map(({ value, label, Icon }) => {
            const active = theme === value;
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setTheme(value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="flex-1 text-left">{label}</span>
                {active ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
