import { afterEach, describe, expect, test } from "bun:test";
import { createOpenAIClient } from "./ai/openai";

describe("OpenAI client configuration", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  });

  test("uses feature-neutral missing API key error", () => {
    delete process.env.OPENAI_API_KEY;

    expect(() => createOpenAIClient()).toThrow("OPENAI_API_KEY is required to use AI features.");
  });
});
