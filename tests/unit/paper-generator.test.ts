import { describe, expect, it } from "vitest";

import { buildSlotPlan } from "@/lib/services/paper-generator.service";
import type { Difficulty, QuestionType } from "@/types/question";

/**
 * The slot planner turns two independent marginal distributions into a joint
 * plan. This is the arithmetic most likely to be subtly wrong, and it is pure,
 * so it is tested directly rather than through the database.
 */

const d = (difficulty: Difficulty, count: number) => ({ difficulty, count });
const t = (type: QuestionType, count: number) => ({ type, count });

function totalOf(slots: { count: number }[]): number {
  return slots.reduce((sum, slot) => sum + slot.count, 0);
}

describe("buildSlotPlan", () => {
  it("produces exactly totalQuestions slots when no quotas are given", () => {
    const slots = buildSlotPlan({
      totalQuestions: 12,
      difficultyDistribution: [],
      typeDistribution: [],
    });

    expect(totalOf(slots)).toBe(12);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ type: null, difficulty: null, count: 12 });
  });

  it("honours a difficulty-only distribution", () => {
    const slots = buildSlotPlan({
      totalQuestions: 10,
      difficultyDistribution: [d("EASY", 6), d("HARD", 4)],
      typeDistribution: [],
    });

    expect(totalOf(slots)).toBe(10);
    expect(slots.find((slot) => slot.difficulty === "EASY")?.count).toBe(6);
    expect(slots.find((slot) => slot.difficulty === "HARD")?.count).toBe(4);
  });

  it("crosses type quotas with difficulty quotas proportionally", () => {
    const slots = buildSlotPlan({
      totalQuestions: 10,
      difficultyDistribution: [d("EASY", 6), d("HARD", 4)],
      typeDistribution: [t("MCQ", 10)],
    });

    expect(totalOf(slots)).toBe(10);
    expect(slots.every((slot) => slot.type === "MCQ")).toBe(true);
    expect(slots.find((slot) => slot.difficulty === "EASY")?.count).toBe(6);
    expect(slots.find((slot) => slot.difficulty === "HARD")?.count).toBe(4);
  });

  it("never allocates more than a difficulty quota allows", () => {
    const slots = buildSlotPlan({
      totalQuestions: 10,
      difficultyDistribution: [d("EASY", 2)],
      typeDistribution: [t("MCQ", 6)],
    });

    const easyMcq = slots.find((slot) => slot.type === "MCQ" && slot.difficulty === "EASY");
    expect(easyMcq?.count).toBe(2);

    // The remaining 4 MCQs are unconstrained by difficulty.
    const looseMcq = slots.find((slot) => slot.type === "MCQ" && slot.difficulty === null);
    expect(looseMcq?.count).toBe(4);
    expect(totalOf(slots)).toBe(10);
  });

  it("sums exactly even when the proportional split does not divide evenly", () => {
    const slots = buildSlotPlan({
      totalQuestions: 7,
      difficultyDistribution: [d("EASY", 3), d("MEDIUM", 2), d("HARD", 2)],
      typeDistribution: [t("MCQ", 7)],
    });

    // Largest-remainder allocation must not lose or invent a slot.
    expect(totalOf(slots)).toBe(7);
  });

  it("fills the remainder when quotas cover only part of the paper", () => {
    const slots = buildSlotPlan({
      totalQuestions: 20,
      difficultyDistribution: [d("EASY", 5)],
      typeDistribution: [t("MCQ", 5)],
    });

    expect(totalOf(slots)).toBe(20);
    const unconstrained = slots.find((slot) => slot.type === null && slot.difficulty === null);
    expect(unconstrained?.count).toBe(15);
  });

  it("drops zero-count quotas rather than emitting empty buckets", () => {
    const slots = buildSlotPlan({
      totalQuestions: 5,
      difficultyDistribution: [d("EASY", 0), d("HARD", 5)],
      typeDistribution: [t("MCQ", 0)],
    });

    expect(slots.every((slot) => slot.count > 0)).toBe(true);
    expect(totalOf(slots)).toBe(5);
  });

  it("handles multiple type quotas without exceeding the total", () => {
    const slots = buildSlotPlan({
      totalQuestions: 12,
      difficultyDistribution: [d("EASY", 6), d("MEDIUM", 6)],
      typeDistribution: [t("MCQ", 8), t("TRUE_FALSE", 4)],
    });

    expect(totalOf(slots)).toBe(12);
    const mcq = slots.filter((slot) => slot.type === "MCQ");
    const tf = slots.filter((slot) => slot.type === "TRUE_FALSE");
    expect(totalOf(mcq)).toBe(8);
    expect(totalOf(tf)).toBe(4);
  });
});
