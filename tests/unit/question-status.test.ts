import { describe, expect, it } from "vitest";

import { canTransition } from "@/types/question";

describe("question approval transitions", () => {
  it("allows direct approval from draft and pending", () => {
    expect(canTransition("DRAFT", "APPROVED")).toBe(true);
    expect(canTransition("PENDING", "APPROVED")).toBe(true);
  });
});
