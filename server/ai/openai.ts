import OpenAI from "openai";

export const DIGEST_MODEL = "gpt-oss-120b";

export function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to use AI features.");
  }

  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_API_BASE_URL,
  });
}
