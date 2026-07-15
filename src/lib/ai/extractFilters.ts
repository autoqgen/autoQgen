import { groq, GROQ_MODEL } from "./groqClient";
import { AI_ASSISTANT_SYSTEM_PROMPT, buildUserPrompt } from "./systemPrompt";
import {
  ALLOWED_FILTER_KEYS,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type ExtractedFilters,
  type ExtractFiltersResult,
} from "./types";

/**
 * Strips accidental markdown code fences some models add despite instructions.
 */
function stripCodeFences(raw: string): string {
  let text = raw.trim();

  if (text.startsWith("```")) {
    text = text.replace(/^```(json)?/i, "").trim();
  }
  if (text.endsWith("```")) {
    text = text.replace(/```$/, "").trim();
  }

  // In case the model wrapped the JSON with extra prose, grab the first {...} block.
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

/**
 * Validates and sanitizes the raw parsed JSON into a safe ExtractedFilters
 * object, dropping any key that isn't part of the allowed contract.
 */
function sanitizeFilters(parsed: unknown): ExtractedFilters {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  const input = parsed as Record<string, unknown>;
  const clean: ExtractedFilters = {};

  for (const key of ALLOWED_FILTER_KEYS) {
    const value = input[key];
    if (value === undefined || value === null) continue;

    switch (key) {
      case "aiGenerated":
        if (typeof value === "boolean") clean.aiGenerated = value;
        break;
      case "year":
        if (typeof value === "number" && Number.isFinite(value)) clean.year = value;
        break;
      case "limit": {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) {
          clean.limit = Math.min(Math.floor(n), MAX_LIMIT);
        }
        break;
      }
      case "tags":
        if (Array.isArray(value)) {
          const tags = value.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
          if (tags.length > 0) clean.tags = tags;
        }
        break;
      default:
        if (typeof value === "string" && value.trim().length > 0) {
          (clean as Record<string, unknown>)[key] = value.trim();
        }
        break;
    }
  }

  if (!clean.limit) clean.limit = DEFAULT_LIMIT;

  return clean;
}

async function callGroqForFilters(message: string): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0,
    max_tokens: 500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: AI_ASSISTANT_SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(message) },
    ],
  });

  return completion.choices?.[0]?.message?.content ?? "";
}

/**
 * extractFilters()
 *
 * Sends the teacher's natural-language message to Groq and returns a
 * strictly-validated ExtractedFilters object. Groq ONLY extracts filters —
 * it never builds a Mongo query and never answers from its own knowledge.
 *
 * On invalid/unparseable JSON, retries exactly once. If it still fails,
 * returns success: false with an error message.
 */
export async function extractFilters(message: string): Promise<ExtractFiltersResult> {
  if (!message || !message.trim()) {
    return { success: false, filters: null, error: "Empty message." };
  }

  let lastRaw = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callGroqForFilters(message);
      lastRaw = raw;
      const cleanedText = stripCodeFences(raw);
      const parsed = JSON.parse(cleanedText);
      const filters = sanitizeFilters(parsed);

      return { success: true, filters, rawModelOutput: raw };
    } catch {
      // fall through to retry
      continue;
    }
  }

  return {
    success: false,
    filters: null,
    rawModelOutput: lastRaw,
    error: "AI could not extract valid filters from your message. Please rephrase your request.",
  };
}

export default extractFilters;
