import { describe, expect, it } from "vitest";
import { ToastProvider, useToast } from "@/components/ui/toast";

describe("Toast Notification Module", () => {
  it("exports ToastProvider and useToast hook", () => {
    expect(ToastProvider).toBeDefined();
    expect(useToast).toBeDefined();
    expect(typeof ToastProvider).toBe("function");
    expect(typeof useToast).toBe("function");
  });
});
