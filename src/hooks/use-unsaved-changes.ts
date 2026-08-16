"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseUnsavedChangesOptions {
  isDirty: boolean;
  onSave?: () => Promise<boolean> | boolean;
  onDiscard?: () => void;
}

export function useUnsavedChanges({ isDirty, onSave, onDiscard }: UseUnsavedChangesOptions) {
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const isNavigatingRef = useRef(false);

  // 1. Listen for browser window / tab unload
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

  // 2. Listen for link clicks & history popstate
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

    window.history.pushState({ isDirtyGuard: true }, "", window.location.href);

    function handlePopState() {
      if (isNavigatingRef.current) return;
      window.history.pushState({ isDirtyGuard: true }, "", window.location.href);
      setPendingHref(document.referrer || "/dashboard");
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

  const confirmSaveAndLeave = useCallback(async () => {
    if (onSave) {
      const saved = await onSave();
      if (saved) {
        isNavigatingRef.current = true;
        setShowLeaveModal(false);
        if (pendingHref) {
          window.location.href = pendingHref;
        }
      }
    }
  }, [onSave, pendingHref]);

  const confirmDiscardAndLeave = useCallback(() => {
    if (onDiscard) onDiscard();
    isNavigatingRef.current = true;
    setShowLeaveModal(false);
    if (pendingHref) {
      window.location.href = pendingHref;
    }
  }, [onDiscard, pendingHref]);

  const cancelLeave = useCallback(() => {
    setShowLeaveModal(false);
    setPendingHref(null);
  }, []);

  return {
    showLeaveModal,
    confirmSaveAndLeave,
    confirmDiscardAndLeave,
    cancelLeave,
  };
}
