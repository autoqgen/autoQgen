import Groq from "groq-sdk";

/**
 * Single shared Groq client instance.
 * Official groq-sdk only — no OpenAI SDK, no LangChain, no AI SDK wrappers.
 */

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error("Please define the GROQ_API_KEY environment variable inside .env.local");
}

export const GROQ_MODEL = process.env.MODEL || "llama-3.3-70b-versatile";

export const groq = new Groq({
  apiKey,
});

export default groq;
