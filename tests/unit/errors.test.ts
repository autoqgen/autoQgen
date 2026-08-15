import { describe, expect, it } from "vitest";
import { z } from "zod";

import { normaliseError } from "@/lib/errors/handler";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors/app-error";

describe("error normalisation", () => {
  it("passes AppErrors through unchanged", () => {
    expect(normaliseError(new ForbiddenError()).status).toBe(403);
    expect(normaliseError(new NotFoundError("Question")).status).toBe(404);
    expect(normaliseError(new ValidationError()).status).toBe(400);
  });

  it("maps a ZodError to a 400 with field details", () => {
    const result = z.object({ email: z.string().email() }).safeParse({ email: "nope" });
    if (result.success) throw new Error("expected a parse failure");

    const normalised = normaliseError(result.error);
    expect(normalised.status).toBe(400);
    expect(normalised.code).toBe("VALIDATION_ERROR");
    expect(normalised.details?.[0]?.path).toBe("email");
  });

  it("maps a duplicate-key error to 409", () => {
    const normalised = normaliseError({ code: 11000, keyPattern: { slug: 1 } });
    expect(normalised.status).toBe(409);
    expect(normalised.details?.[0]?.path).toBe("slug");
  });

  it("never leaks an internal message to the client", () => {
    const internal = new Error(
      'E11000 duplicate key error collection: autoqgen.questions index: chapter_1_contentHash_1',
    );
    const normalised = normaliseError(internal);

    expect(normalised.status).toBe(500);
    expect(normalised.message).not.toContain("autoqgen.questions");
    expect(normalised.message).toBe("Something went wrong. Please try again.");
  });

  it("maps a Mongoose CastError to 400, not 500", () => {
    const castError = Object.assign(new Error("Cast to ObjectId failed"), {
      name: "CastError",
      path: "chapter",
    });
    expect(normaliseError(castError).status).toBe(400);
  });
});
