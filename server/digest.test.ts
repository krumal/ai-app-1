import { mkdtemp, mkdir, rm, writeFile, utimes } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import type { ProjectConfig } from "../shared/types";
import { buildEstimate, ESTIMATE_FILE_NAME, writeEstimate } from "./estimate";

let lastRequestPayload: { messages: Array<Record<string, unknown>> } | null = null;

mock.module("./ai/openai", () => ({
  DIGEST_MODEL: "test-digest-model",
  createOpenAIClient: () => ({
    chat: {
      completions: {
        create: async (payload: { messages: Array<Record<string, unknown>> }) => {
          lastRequestPayload = payload;
          return {
            choices: [
              {
                message: {
                  content: "# AI digest: <period>\n\nSummary placeholder.",
                },
              },
            ],
          };
        },
      },
    },
  }),
}));

const { generateProjectDigest, previewProjectDigest } = await import("./digest");

type TestProject = {
  root: string;
  project: ProjectConfig;
};

async function createProjectContext(): Promise<TestProject> {
  const root = await mkdtemp(path.join(os.tmpdir(), "localtasks-digest-"));
  const project: ProjectConfig = {
    id: "project-digest",
    name: "Digest Project",
    repoPath: root,
    taskDirName: ".tasks",
    listOrder: ["tasks", "notes"],
  };

  await mkdir(path.join(root, ".tasks"), { recursive: true });
  return { root, project };
}

beforeAll(() => {
  process.env.OPENAI_API_KEY = "integration-test-key";
});

describe("digest preview and file selection", () => {
  let projectCtx: TestProject;

  beforeEach(async () => {
    projectCtx = await createProjectContext();
    lastRequestPayload = null;
  });

  afterEach(async () => {
    await rm(projectCtx.root, { recursive: true, force: true });
  });

  test("does not include a task when only estimate.json changed", async () => {
    const cardPath = path.join(projectCtx.root, ".tasks", "task-200");
    await mkdir(cardPath, { recursive: true });

    await writeFile(path.join(cardPath, "draft.md"), "Draft text");
    await writeFile(path.join(cardPath, "plan.md"), "Plan text");
    const old = new Date("2026-01-01T00:00:00.000Z");
    const future = new Date("2026-01-10T00:00:00.000Z");
    await utimes(path.join(cardPath, "draft.md"), old, old);
    await utimes(path.join(cardPath, "plan.md"), old, old);

    await writeEstimate(
      { taskRootPath: path.join(projectCtx.root, ".tasks"), cardRelativePath: "task-200" },
      buildEstimate(
        [
          {
            role: "backend engineer",
            storyPoints: 3,
            reason: "Backend work remains simple.",
          },
          {
            role: "frontend engineer",
            storyPoints: 2,
            reason: "Frontend work remains simple.",
          },
          {
            role: "QA engineer",
            storyPoints: 1,
            reason: "QA checks are quick.",
          },
        ],
        ["draft.md", "plan.md"],
      ),
    );
    await utimes(path.join(cardPath, ESTIMATE_FILE_NAME), future, future);

    const preview = await previewProjectDigest(projectCtx.project, {
      from: "2026-01-09",
      to: "2026-01-11",
    });

    expect(preview.cards).toHaveLength(0);
  });

  test("includes a task when regular card content changed", async () => {
    const cardPath = path.join(projectCtx.root, ".tasks", "task-201");
    await mkdir(cardPath, { recursive: true });

    const old = new Date("2026-01-01T00:00:00.000Z");
    const changed = new Date("2026-01-05T00:00:00.000Z");
    await writeFile(path.join(cardPath, "draft.md"), "Draft text");
    await writeFile(path.join(cardPath, "plan.md"), "Plan text");
    await utimes(path.join(cardPath, "draft.md"), old, old);
    await utimes(path.join(cardPath, "plan.md"), changed, changed);

    const preview = await previewProjectDigest(projectCtx.project, {
      from: "2026-01-04",
      to: "2026-01-06",
    });

    expect(preview.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: "task-201",
        }),
      ]),
    );
  });

  test("excludes estimate.json from included digest file paths", async () => {
    const noteRoot = path.join(projectCtx.root, ".tasks", "notes", "inner");
    await mkdir(noteRoot, { recursive: true });
    await writeFile(path.join(noteRoot, "summary.txt"), "Task notes");
    await writeFile(path.join(noteRoot, ESTIMATE_FILE_NAME), "ignored estimate payload");

    const change = new Date("2026-01-02T10:00:00.000Z");
    await utimes(path.join(noteRoot, "summary.txt"), change, change);
    await utimes(path.join(noteRoot, ESTIMATE_FILE_NAME), change, change);

    const preview = await previewProjectDigest(projectCtx.project, {
      from: "2026-01-01",
      to: "2026-01-03",
    });

    const digestCard = preview.cards.find((card) => card.relativePath === "notes/inner");
    expect(digestCard).toBeDefined();
    expect(digestCard!.includedFilePaths).toEqual(
      expect.not.arrayContaining([path.join("notes", "inner", ESTIMATE_FILE_NAME)]),
    );
  });
});

describe("digest generation prompt context", () => {
  let projectCtx: TestProject;

  beforeEach(async () => {
    projectCtx = await createProjectContext();
    lastRequestPayload = null;
  });

  afterEach(async () => {
    await rm(projectCtx.root, { recursive: true, force: true });
  });

  test("does not include estimate.json content in prompt context", async () => {
    const cardPath = path.join(projectCtx.root, ".tasks", "task-202");
    await mkdir(cardPath, { recursive: true });
    await writeFile(path.join(cardPath, "draft.md"), "Draft text");
    await writeFile(path.join(cardPath, "plan.md"), "Plan text");
    await writeFile(path.join(cardPath, "implementation_progress.md"), "Implementation progress");

    await writeEstimate(
      { taskRootPath: path.join(projectCtx.root, ".tasks"), cardRelativePath: "task-202" },
      buildEstimate(
        [
          {
            role: "backend engineer",
            storyPoints: 5,
            reason: "Backend scope is medium. private estimate payload",
          },
          {
            role: "frontend engineer",
            storyPoints: 5,
            reason: "Frontend scope is medium.",
          },
          {
            role: "QA engineer",
            storyPoints: 8,
            reason: "QA scope is bigger.",
          },
        ],
        ["draft.md", "plan.md"],
      ),
    );

    const taskChanged = new Date("2026-01-05T12:00:00.000Z");
    await utimes(path.join(cardPath, "draft.md"), taskChanged, taskChanged);
    await utimes(path.join(cardPath, "plan.md"), taskChanged, taskChanged);
    await utimes(path.join(cardPath, "implementation_progress.md"), taskChanged, taskChanged);

    await generateProjectDigest(projectCtx.project, {
      from: "2026-01-04",
      to: "2026-01-06",
    });

    expect(lastRequestPayload).not.toBeNull();
    const userMessage = lastRequestPayload!.messages.at(-1);
    const userPrompt = typeof userMessage?.content === "string" ? userMessage.content : "";

    expect(userPrompt).toContain("task-202");
    expect(userPrompt).toContain("<file path=\"task-202/plan.md\">");
    expect(userPrompt).not.toContain("private estimate payload");
    expect(userPrompt).not.toContain(`${ESTIMATE_FILE_NAME}`);
  });
});
