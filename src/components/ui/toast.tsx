"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  type?: ToastType;
  description?: ReactNode;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface Toast extends ToastOptions {
  id: string;
  title: string;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (title: string, options?: ToastOptions) => string;
  dismissToast: (id?: string) => void;
  success: (title: string, options?: Omit<ToastOptions, "type">) => string;
  error: (title: string, options?: Omit<ToastOptions, "type">) => string;
  warning: (title: string, options?: Omit<ToastOptions, "type">) => string;
  info: (title: string, options?: Omit<ToastOptions, "type">) => string;
  flash: (title: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id?: string) => {
    if (id) {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    } else {
      setToasts([]);
    }
  }, []);

  const showToast = useCallback(
    (title: string, options?: ToastOptions): string => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = {
        id,
        title,
        type: options?.type ?? "info",
        description: options?.description,
        duration: options?.duration ?? 4000,
        action: options?.action,
      };

      setToasts((prev) => [...prev, newToast]);
      return id;
    },
    []
  );

  const success = useCallback(
    (title: string, options?: Omit<ToastOptions, "type">) =>
      showToast(title, { ...options, type: "success" }),
    [showToast]
  );

  const error = useCallback(
    (title: string, options?: Omit<ToastOptions, "type">) =>
      showToast(title, { ...options, type: "error" }),
    [showToast]
  );

  const warning = useCallback(
    (title: string, options?: Omit<ToastOptions, "type">) =>
      showToast(title, { ...options, type: "warning" }),
    [showToast]
  );

  const info = useCallback(
    (title: string, options?: Omit<ToastOptions, "type">) =>
      showToast(title, { ...options, type: "info" }),
    [showToast]
  );

  const flash = useCallback(
    (title: string, options?: ToastOptions) => {
      try {
        sessionStorage.setItem(
          "autoqgen_flash_toast",
          JSON.stringify({ title, options })
        );
      } catch {
        // Fallback to immediate toast if sessionStorage fails
        showToast(title, options);
      }
    },
    [showToast]
  );

  // Read and trigger flash toast across page redirects/reloads
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("autoqgen_flash_toast");
      if (stored) {
        sessionStorage.removeItem("autoqgen_flash_toast");
        const parsed = JSON.parse(stored);
        if (parsed && parsed.title) {
          queueMicrotask(() => {
            showToast(parsed.title, parsed.options);
          });
        }
      }
    } catch {
      // Ignore sessionStorage read errors
    }
  }, [pathname, showToast]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        dismissToast,
        success,
        error,
        warning,
        info,
        flash,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

const ICON_MAP: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />,
  error: <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />,
  info: <Info className="h-4 w-4 text-sky-400 flex-shrink-0" />,
};

const _DOT_MAP: Record<ToastType, string> = {
  success: "bg-emerald-400 shadow-emerald-400/50",
  error: "bg-rose-400 shadow-rose-400/50",
  warning: "bg-amber-400 shadow-amber-400/50",
  info: "bg-sky-400 shadow-sky-400/50",
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [paused, setPaused] = useState(false);
  const type = toast.type || "info";
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (toast.duration === 0 || paused) return;

    timerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration || 4000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, toast.duration, paused, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="toast-surface pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border p-3.5 px-4 shadow-2xl backdrop-blur-md"
      role={type === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <div className="flex items-center justify-center">
        {ICON_MAP[type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white leading-tight tracking-wide">{toast.title}</p>
        {toast.description && (
          <div className="mt-0.5 text-[11px] text-white/70 leading-snug">{toast.description}</div>
        )}
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="mt-1.5 text-[11px] font-semibold text-sky-400 hover:text-sky-300 underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white transition"
        aria-label="Dismiss toast"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      <AnimatePresence mode="sync">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
