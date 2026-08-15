import { describe, expect, it } from "vitest";

import { escapeRegExp, safeNameRegExp } from "@/lib/security/regex";
import { normaliseQuestionText, questionContentHash, sha256 } from "@/lib/security/hash";
import { redact } from "@/lib/logger";
import { checkPasswordPolicy } from "@/lib/auth/password";

describe("regex safety", () => {
  it("escapes every metacharacter", () => {
    expect(escapeRegExp("(a+)+$")).toBe("\\(a\\+\\)\\+\\$");
    expect(escapeRegExp("a.b*c")).toBe("a\\.b\\*c");
  });

  it("treats a catastrophic-backtracking payload as a literal", () => {
    const pattern = safeNameRegExp("(a+)+$");
    const hostile = `${"a".repeat(40)}!`;

    const started = Date.now();
    expect(pattern.test(hostile)).toBe(false);
    expect(Date.now() - started).toBeLessThan(200);
  });

  it("matches the literal text it was built from", () => {
    expect(safeNameRegExp("Physics").test("physics")).toBe(true);
    expect(safeNameRegExp("Physics").test("Physiology")).toBe(false);
  });
});

describe("question content hashing", () => {
  it("normalises case and whitespace", () => {
    expect(normaliseQuestionText("  What   is   FORCE? ")).toBe("what is force?");
  });

  it("produces the same fingerprint for cosmetically different duplicates", () => {
    const a = questionContentHash("chapter1", "What is force?");
    const b = questionContentHash("chapter1", "  what IS   force? ");
    expect(a).toBe(b);
  });

  it("scopes the fingerprint to the chapter", () => {
    expect(questionContentHash("chapter1", "What is force?")).not.toBe(
      questionContentHash("chapter2", "What is force?"),
    );
  });

  it("returns a stable sha256 hex digest", () => {
    expect(sha256("abc")).toHaveLength(64);
  });
});

describe("log redaction", () => {
  it("removes secrets, tokens and answer keys", () => {
    const output = redact({
      email: "user@example.com",
      password: "hunter2",
      NEXTAUTH_SECRET: "super-secret",
      authorization: "Bearer abc",
      answer: { correctOptions: ["B"] },
      nested: { token: "abc123" },
    }) as Record<string, unknown>;

    expect(output.email).toBe("user@example.com");
    expect(output.password).toBe("[redacted]");
    expect(output.NEXTAUTH_SECRET).toBe("[redacted]");
    expect(output.authorization).toBe("[redacted]");
    expect(output.answer).toBe("[redacted]");
    expect((output.nested as Record<string, unknown>).token).toBe("[redacted]");
  });

  it("caps long strings and large arrays", () => {
    const long = redact({ text: "x".repeat(2000) }) as { text: string };
    expect(long.text.length).toBeLessThan(600);

    const big = redact({ items: Array.from({ length: 100 }, (_, index) => index) }) as {
      items: unknown[];
    };
    expect(big.items.length).toBeLessThanOrEqual(21);
  });
});

describe("password policy", () => {
  it("rejects short, repeated and common passwords", () => {
    expect(checkPasswordPolicy("short").length).toBeGreaterThan(0);
    expect(checkPasswordPolicy("aaaaaaaaaaaaaaa").length).toBeGreaterThan(0);
    expect(checkPasswordPolicy("mypassword12345").length).toBeGreaterThan(0);
  });

  it("accepts a reasonable passphrase", () => {
    expect(checkPasswordPolicy("correct horse battery staple")).toEqual([]);
  });
});
