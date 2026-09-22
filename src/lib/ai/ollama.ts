import { env, ollamaEnabled } from "@/lib/config/env";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger";
import {
  SIMILARITY_VALIDATION_SYSTEM_PROMPT,
  buildSimilarityValidationPrompt,
  parseValidationVerdicts,
  type SimilarityCandidatePair,
  type SimilarityVerdict,
} from "@/lib/similarity/validation-prompt";

const OLLAMA_API_URL = "https://ollama.com/v1/chat/completions";
const MAX_PROMPT_CHARS = 120_000;
const REQUEST_TIMEOUT_MS = 90_000;

export class OllamaUnavailableError extends AppError {
  constructor(message = "The similarity validation AI is not available right now.") {
    super("INTERNAL_ERROR", 503, message);
  }
}

interface OllamaResponse {
  choices?: { message?: { content?: string } }[];
}

function responseText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const content = (payload as OllamaResponse).choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content : null;
}

function extractVerdictList(raw: unknown): unknown[] | null {
  if (raw && typeof raw === "object" && Array.isArray((raw as { verdicts?: unknown[] }).verdicts)) {
    return (raw as { verdicts: unknown[] }).verdicts;
  }
  return Array.isArray(raw) ? raw : null;
}

async function validateBatch(pairs: readonly SimilarityCandidatePair[], startIndex: number): Promise<SimilarityVerdict[]> {
  const prompt = buildSimilarityValidationPrompt(pairs, startIndex);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(OLLAMA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OLLAMA_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL,
        messages: [
          { role: "system", content: SIMILARITY_VALIDATION_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        max_tokens: 8192,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    logger.error("Ollama similarity request failed", { model: env.OLLAMA_MODEL, error });
    throw new OllamaUnavailableError("Could not reach the similarity validation AI. Try again in a moment.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    logger.error("Ollama similarity request returned an error", {
      model: env.OLLAMA_MODEL,
      status: response.status,
      detail: detail.slice(0, 500),
    });
    if (response.status === 429) {
      throw new OllamaUnavailableError("The similarity validation AI rate limit was reached. Try again later.");
    }
    if (response.status === 400 || response.status === 413) {
      throw new OllamaUnavailableError("The similarity validation request was too large for the AI service.");
    }
    throw new OllamaUnavailableError("The similarity validation AI rejected the request.");
  }

  const payload = (await response.json().catch(() => null)) as OllamaResponse | null;
  const text = responseText(payload);
  if (!text) throw new OllamaUnavailableError("The similarity validation AI returned an empty response.");

  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
  } catch {
    throw new OllamaUnavailableError("The similarity validation AI returned invalid JSON.");
  }

  const list = extractVerdictList(raw);
  if (!list || list.length !== pairs.length) {
    throw new OllamaUnavailableError("The similarity validation AI returned an incomplete response.");
  }

  const verdicts = parseValidationVerdicts(raw, pairs.length, startIndex);
  if (verdicts.some((verdict) => verdict.reason === "no verdict returned")) {
    throw new OllamaUnavailableError("The similarity validation AI omitted a verdict.");
  }
  return verdicts;
}

export const ollamaClient = {
  async validateSimilarity(pairs: readonly SimilarityCandidatePair[]): Promise<SimilarityVerdict[]> {
    if (pairs.length === 0) return [];
    if (!ollamaEnabled || !env.OLLAMA_API_KEY) {
      throw new OllamaUnavailableError(
        "Semantic similarity is disabled. Set OLLAMA_API_KEY in the environment configuration.",
      );
    }

    const batches: SimilarityCandidatePair[][] = [];
    let current: SimilarityCandidatePair[] = [];
    let currentLength = 0;
    for (const pair of pairs) {
      const pairLength = buildSimilarityValidationPrompt([pair], 0).length;
      if (current.length > 0 && currentLength + pairLength > MAX_PROMPT_CHARS) {
        batches.push(current);
        current = [];
        currentLength = 0;
      }
      current.push(pair);
      currentLength += pairLength;
    }
    if (current.length > 0) batches.push(current);

    const verdicts: SimilarityVerdict[] = [];
    let offset = 0;
    for (const batch of batches) {
      verdicts.push(...(await validateBatch(batch, offset)));
      offset += batch.length;
    }
    return verdicts;
  },
};
