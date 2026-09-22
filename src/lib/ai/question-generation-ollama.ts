import { env } from "@/lib/config/env";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger";

export class QuestionGenerationUnavailableError extends AppError {
  constructor(message = "AI question generation is not available right now.") {
    super("INTERNAL_ERROR", 503, message);
  }
}

interface OllamaResponse {
  choices?: { message?: { content?: string } }[];
}

export interface QuestionGenerationOptions {
  system: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

function parseJsonReply<T>(raw: string): T {
  const unfenced = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(unfenced) as T;
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(unfenced.slice(start, end + 1)) as T;
      } catch {
        /* fall through */
      }
    }
    throw new QuestionGenerationUnavailableError("The AI service returned malformed JSON.");
  }
}

export const questionGenerationOllamaClient = {
  get enabled(): boolean {
    return Boolean(env.OLLAMA_QUESTION_GENERATION_API_KEY);
  },

  get model(): string {
    return env.OLLAMA_QUESTION_GENERATION_MODEL;
  },

  async generateJson<T = unknown>(options: QuestionGenerationOptions): Promise<T> {
    if (!env.OLLAMA_QUESTION_GENERATION_API_KEY) {
      throw new QuestionGenerationUnavailableError(
        "AI question generation is disabled. Set OLLAMA_QUESTION_GENERATION_API_KEY in the environment configuration.",
      );
    }

    const {
      system,
      prompt,
      temperature = 0.4,
      maxOutputTokens = 8192,
      timeoutMs = 90_000,
    } = options;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(env.OLLAMA_QUESTION_GENERATION_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OLLAMA_QUESTION_GENERATION_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.OLLAMA_QUESTION_GENERATION_MODEL,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          temperature,
          max_tokens: maxOutputTokens,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      logger.error("Ollama question-generation request failed", {
        model: env.OLLAMA_QUESTION_GENERATION_MODEL,
        error,
      });
      throw new QuestionGenerationUnavailableError(
        "Could not reach the question-generation AI. Try again in a moment.",
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      logger.error("Ollama question-generation request returned an error", {
        model: env.OLLAMA_QUESTION_GENERATION_MODEL,
        status: response.status,
        detail: detail.slice(0, 500),
      });
      throw new QuestionGenerationUnavailableError(
        response.status === 429
          ? "The question-generation AI rate limit was reached. Try again later."
          : "The question-generation AI rejected the request.",
      );
    }

    const payload = (await response.json().catch(() => null)) as OllamaResponse | null;
    const text = payload?.choices?.[0]?.message?.content;
    if (!text?.trim()) {
      throw new QuestionGenerationUnavailableError(
        "The question-generation AI returned an empty response.",
      );
    }
    return parseJsonReply<T>(text);
  },
};
