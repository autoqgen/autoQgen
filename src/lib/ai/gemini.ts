import { env, geminiEnabled } from "@/lib/config/env";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger";

/**
 * Minimal server-side Google Gemini client.
 *
 * Talks to the Generative Language REST API directly with `fetch` — no SDK, no
 * extra dependency, no paid infrastructure. The free-tier model is chosen by
 * `GEMINI_MODEL` (see src/lib/config/env.ts), which defaults to a currently
 * available free model.
 *
 * The API key lives only in `env` (server) and is only ever placed in the
 * request to Google from this module. It is never returned to a caller, never
 * logged, and never reaches the browser.
 */

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta";

/** Surfaced to the client as 503 — the feature is a dependency that can be down. */
export class AiUnavailableError extends AppError {
  constructor(message = "AI question generation is not available right now.") {
    super("INTERNAL_ERROR", 503, message);
  }
}

interface GeminiCandidate {
  content?: { parts?: { text?: string }[] };
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
}

interface GeminiBatchEmbedResponse {
  embeddings?: { values?: number[] }[];
}

/** Google caps `batchEmbedContents` at 100 requests per call. */
const EMBED_BATCH_SIZE = 100;

export interface GenerateJsonOptions {
  /** High-level instruction that frames the whole request. */
  system: string;
  /** The concrete task. */
  prompt: string;
  /** 0 = deterministic. Kept low so output stays on-spec. */
  temperature?: number;
  /** Hard cap on output size. */
  maxOutputTokens?: number;
  /** Abort the upstream call after this many ms. */
  timeoutMs?: number;
}

export const geminiClient = {
  get enabled(): boolean {
    return geminiEnabled;
  },

  get model(): string {
    return env.GEMINI_MODEL;
  },

  /** The embedding model used for semantic similarity (separate from `model`). */
  get embeddingModel(): string {
    return env.GEMINI_EMBEDDING_MODEL;
  },

  /**
   * Embeds a batch of texts with the Gemini embedding model.
   *
   * Reuses the exact same API key, endpoint host, header auth and error
   * mapping as `generateJson` — no second client, no second key. Used only by
   * the per-paper semantic similarity check; the generation flow above is
   * untouched. Returns one vector per input, in order.
   */
  async embedTexts(texts: string[]): Promise<number[][]> {
    if (!geminiEnabled || !env.GEMINI_API_KEY) {
      throw new AiUnavailableError(
        "Semantic similarity is disabled. Set GEMINI_API_KEY in the environment configuration.",
      );
    }
    if (texts.length === 0) return [];

    const modelPath = `models/${env.GEMINI_EMBEDDING_MODEL}`;
    const url = `${API_ROOT}/${modelPath}:batchEmbedContents`;
    const out: number[][] = [];

    for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
      const chunk = texts.slice(start, start + EMBED_BATCH_SIZE);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            requests: chunk.map((text) => ({
              model: modelPath,
              content: { parts: [{ text }] },
              // gemini-embedding-001 tunes the vector space to the use case;
              // this is a symmetric "how alike are these two texts" comparison.
              taskType: "SEMANTIC_SIMILARITY",
            })),
          }),
          signal: controller.signal,
        });
      } catch (error) {
        logger.error("Gemini embedding request failed", { model: env.GEMINI_EMBEDDING_MODEL, error });
        throw new AiUnavailableError("Could not reach the AI service. Try again in a moment.");
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        logger.error("Gemini embedding responded with an error", {
          model: env.GEMINI_EMBEDDING_MODEL,
          status: response.status,
          detail: detail.slice(0, 500),
        });
        if (response.status === 429) {
          throw new AiUnavailableError("The AI free-tier quota is exhausted. Try again later.");
        }
        if (response.status === 503 || response.status === 500) {
          throw new AiUnavailableError("The AI service is busy right now. Try again in a moment.");
        }
        throw new AiUnavailableError("The AI service rejected the embedding request.");
      }

      const payload = (await response.json().catch(() => null)) as GeminiBatchEmbedResponse | null;
      const embeddings = payload?.embeddings ?? [];
      if (embeddings.length !== chunk.length) {
        throw new AiUnavailableError("The AI service returned an unexpected embedding response.");
      }
      for (const embedding of embeddings) {
        const values = embedding.values;
        if (!Array.isArray(values) || values.length === 0) {
          throw new AiUnavailableError("The AI service returned an empty embedding.");
        }
        out.push(values);
      }
    }

    return out;
  },

  /**
   * Calls Gemini and returns the parsed JSON object from its reply.
   *
   * `responseMimeType: "application/json"` asks Gemini to emit a bare JSON
   * document; we still defensively strip a ```json fence if one appears.
   * Throws `AiUnavailableError` for any transport/permission/parse failure so
   * the route maps it to a clean 503 rather than leaking upstream detail.
   */
  async generateJson<T = unknown>(options: GenerateJsonOptions): Promise<T> {
    if (!geminiEnabled || !env.GEMINI_API_KEY) {
      throw new AiUnavailableError(
        "AI question generation is disabled. Set GEMINI_API_KEY in the environment configuration.",
      );
    }

    const {
      system,
      prompt,
      temperature = 0.4,
      maxOutputTokens = 8192,
      // Current flash models "think" before answering; a 10-question batch can
      // take 20-40s, and the free tier can be slower under load.
      timeoutMs = 90_000,
    } = options;

    const url = `${API_ROOT}/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Header auth keeps the key out of the URL / access logs.
          "x-goog-api-key": env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens,
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      logger.error("Gemini request failed", { model: env.GEMINI_MODEL, error });
      throw new AiUnavailableError("Could not reach the AI service. Try again in a moment.");
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // Body may carry Google's error detail; log it server-side only.
      const detail = await response.text().catch(() => "");
      logger.error("Gemini responded with an error", {
        model: env.GEMINI_MODEL,
        status: response.status,
        detail: detail.slice(0, 500),
      });
      if (response.status === 429) {
        throw new AiUnavailableError("The AI free-tier quota is exhausted. Try again later.");
      }
      if (response.status === 503 || response.status === 500) {
        throw new AiUnavailableError("The AI service is busy right now. Try again in a moment.");
      }
      throw new AiUnavailableError("The AI service rejected the request.");
    }

    const payload = (await response.json().catch(() => null)) as GeminiResponse | null;

    if (payload?.promptFeedback?.blockReason) {
      throw new AiUnavailableError("The AI service blocked this prompt. Adjust the instruction and retry.");
    }

    const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!text.trim()) {
      throw new AiUnavailableError("The AI service returned an empty response.");
    }

    return parseJsonReply<T>(text);
  },
};

/** Tolerant JSON extraction: handles a bare document or a fenced ```json block. */
export function parseJsonReply<T>(raw: string): T {
  const trimmed = raw.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(unfenced) as T;
  } catch {
    // Last resort: grab the outermost {...} span.
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(unfenced.slice(start, end + 1)) as T;
      } catch {
        /* fall through */
      }
    }
    throw new AiUnavailableError("The AI service returned malformed JSON.");
  }
}
