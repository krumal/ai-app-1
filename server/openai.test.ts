import { describe, expect, test } from "bun:test";
import path from "node:path";

describe("OpenAI client configuration", () => {
  test("uses feature-neutral missing API key error", () => {
    // Other files mock this module for model-free tests. A fresh process tests
    // the real missing-key branch without importing their shared module mock.
    const child = Bun.spawnSync([process.execPath, "--eval", `
      import { createOpenAIClient } from './server/ai/openai.ts';
      try { createOpenAIClient(); process.exit(1); }
      catch (error) { console.log(error.message); }
    `], {
      cwd: path.resolve(import.meta.dir, ".."),
      env: { ...process.env, OPENAI_API_KEY: "" },
      stdout: "pipe", stderr: "pipe",
    });
    expect(child.exitCode).toBe(0);
    expect(child.stdout.toString().trim()).toBe("OPENAI_API_KEY is required to use AI features.");
    expect(child.stderr.toString()).toBe("");
  });
});
