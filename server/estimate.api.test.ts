import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
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
import { addProject, getConfigPath } from "./config";
import { buildEstimate, estimateFileExists, readEstimate, writeEstimate } from "./estimate";
import type { EstimateVote } from "../shared/types";

type MockedVote = string | { storyPoints: number; reason: string } | Error;

process.env.LOCALTASKS_SKIP_SERVER = "1";

let apiHandler: ((request: Request) => Promise<Response>) | null = null;
let projectId = "";
let taskRootPath = "";
let projectPath = "";
let tempConfigDir = "";
let originalHome = process.env.HOME;
let originalApiKey = process.env.OPENAI_API_KEY;
let mockedResponses: MockedVote[] = [];

const BASE_VOTES: EstimateVote[] = [
  {
    role: "backend engineer",
    storyPoints: 2,
    reason: "Backend scope is limited.",
  },
  {
    role: "frontend engineer",
    storyPoints: 5,
    reason: "Frontend changes are focused.",
  },
  {
    role: "QA engineer",
    storyPoints: 8,
    reason: "QA checks are straightforward.",
  },
  {
    role: "tech lead",
    storyPoints: 13,
    reason: "There are known edge cases.",
  },
  {
    role: "product-minded implementation reviewer",
    storyPoints: 3,
    reason: "Implementation stays compact.",
  },
];

mock.module("./ai/openai", () => ({
  DIGEST_MODEL: "test-estimate-model",
  createOpenAIClient: () => ({
    chat: {
      completions: {
        create: async () => {
          const value = mockedResponses.shift();
          if (!value) {
            throw new Error("No mocked AI responses are configured.");
          }

          if (value instanceof Error) {
            throw value;
          }

          return {
            choices: [
              {
                message: {
                  content: typeof value === "string" ? value : JSON.stringify(value),
                },
              },
            ],
          };
        },
      },
    },
  }),
}));

beforeAll(async () => {
  const indexModule = await import("./index");
  apiHandler = indexModule.apiHandler;
});

beforeEach(async () => {
  mockedResponses = [];
  originalHome = process.env.HOME;
  originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "estimate-test-key";

  tempConfigDir = await mkdtemp(path.join(os.tmpdir(), "localtasks-estimate-api-config-"));
  process.env.HOME = tempConfigDir;

  projectPath = await mkdtemp(path.join(os.tmpdir(), "localtasks-estimate-api-repo-"));
  taskRootPath = path.join(projectPath, ".tasks");
  await mkdir(taskRootPath, { recursive: true });

  const config = await addProject({
    name: "Estimate API Project",
    repoPath: projectPath,
  });
  expect(getConfigPath()).toBe(path.join(tempConfigDir, ".config", "localtasks", "config.json"));
  if (!config.activeProjectId) {
    throw new Error("Expected activeProjectId to be set for created project.");
  }

  projectId = config.activeProjectId;
});

afterEach(async () => {
  process.env.HOME = originalHome;
  if (originalApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalApiKey;
  }

  await rm(projectPath, { recursive: true, force: true });
  await rm(tempConfigDir, { recursive: true, force: true });
});

async function createTaskCard(cardName: string, includeProgress = false) {
  const taskPath = path.join(taskRootPath, cardName);
  await mkdir(taskPath, { recursive: true });
  await writeFile(path.join(taskPath, "draft.md"), `# Draft for ${cardName}\n`);
  await writeFile(path.join(taskPath, "plan.md"), `# Plan for ${cardName}\n`);

  if (includeProgress) {
    await writeFile(path.join(taskPath, "implementation_progress.md"), `# Progress for ${cardName}\n`);
  }

  return taskPath;
}

async function expectEstimateRejected(cardRelativePath: string, expectedError: string) {
  const response = await callEstimate(cardRelativePath);
  expect(response.status).toBe(400);

  const payload = (await response.json()) as { error: string };
  expect(payload.error).toBe(expectedError);
}

async function callEstimate(cardRelativePath: string) {
  return apiHandler!(
    new Request(`http://127.0.0.1/api/projects/${projectId}/estimate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ cardRelativePath }),
    }),
  );
}

describe("estimate API endpoint", () => {
  test("saves estimate on successful generation with all valid votes", async () => {
    await createTaskCard("task-100", true);
    mockedResponses = BASE_VOTES.slice(0, 5).map((vote) => ({
      storyPoints: vote.storyPoints,
      reason: `Reason for ${vote.role}.`,
    }));

    const response = await callEstimate("task-100");
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      ok: true;
      estimate: {
        storyPoints: number;
        sources: string[];
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.estimate.storyPoints).toBe(5);
    expect(payload.estimate.sources).toEqual(["draft.md", "plan.md", "implementation_progress.md"]);

    const estimate = await readEstimate({ taskRootPath, cardRelativePath: "task-100" });
    expect(estimate).not.toBeNull();
    expect(estimate?.storyPoints).toBe(5);
  });

  test("succeeds with 3 valid votes when 2 participants fail", async () => {
    await createTaskCard("task-101", true);
    mockedResponses = [
      {
        storyPoints: 2,
        reason: "Backend is minimal.",
      },
      "invalid json",
      {
        storyPoints: 8,
        reason: "Frontend is focused.",
      },
      '{"storyPoints": 4, "reason": "bad scale"}',
      {
        storyPoints: 13,
        reason: "QA is straightforward.",
      },
    ];

    const response = await callEstimate("task-101");
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      ok: true;
      estimate: {
        storyPoints: number;
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.estimate.storyPoints).toBe(8);
  });

  test("fails when fewer than 3 valid votes remain", async () => {
    await createTaskCard("task-102", true);
    mockedResponses = [
      "not a json",
      '{"storyPoints":4, "reason":"out of scale"}',
      {
        storyPoints: 2,
        reason: "",
      },
      { storyPoints: 13, reason: "Invalid reason? maybe yes." },
      { storyPoints: 3, reason: "Invalid reason? no." },
    ];

    const response = await callEstimate("task-102");
    expect(response.status).toBe(400);

    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain("At least 3 valid votes are required.");

    const estimateExists = await estimateFileExists({ taskRootPath, cardRelativePath: "task-102" });
    expect(estimateExists).toBe(false);
  });

  test("does not overwrite existing estimate when regeneration fails", async () => {
    await createTaskCard("task-103", true);
    const previous = buildEstimate(BASE_VOTES.slice(0, 3), ["draft.md", "plan.md"]);
    await writeEstimate({ taskRootPath, cardRelativePath: "task-103" }, previous);

    mockedResponses = [
      "not a json",
      '{"storyPoints":9, "reason":"bad story points"}',
      "another invalid payload",
      '{"storyPoints":4,"reason":"invalid scale"}',
      '{"storyPoints":2}',
    ];

    const response = await callEstimate("task-103");
    expect(response.status).toBe(400);

    const next = await readEstimate({ taskRootPath, cardRelativePath: "task-103" });
    expect(next).not.toBeNull();
    expect(next?.storyPoints).toBe(previous.storyPoints);
  });

  test("rejects path traversal card paths before generation", async () => {
    await createTaskCard("task-104", true);
    mockedResponses = [
      {
        storyPoints: 2,
        reason: "Safe response",
      },
      {
        storyPoints: 3,
        reason: "Safe response",
      },
      {
        storyPoints: 5,
        reason: "Safe response",
      },
      {
        storyPoints: 8,
        reason: "Safe response",
      },
      {
        storyPoints: 13,
        reason: "Safe response",
      },
    ];

    const response = await callEstimate("../task-104");
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBe("Task path is outside of project task root.");
  });

  test("rejects task cards missing required plan.md", async () => {
    const taskPath = path.join(taskRootPath, "task-105");
    await mkdir(taskPath, { recursive: true });
    await writeFile(path.join(taskPath, "draft.md"), "Draft only");

    await expectEstimateRejected("task-105", "Task estimate requires plan.md.");
    expect(mockedResponses).toHaveLength(0);
  });

  test("rejects misc file cards", async () => {
    await writeFile(path.join(taskRootPath, "notes.md"), "Notes");

    await expectEstimateRejected("notes.md", "Only task folders can be estimated.");
    expect(mockedResponses).toHaveLength(0);
  });

  test("rejects grouped task folders", async () => {
    const taskPath = path.join(taskRootPath, "reports", "task-106");
    await mkdir(taskPath, { recursive: true });
    await writeFile(path.join(taskPath, "draft.md"), "Draft");
    await writeFile(path.join(taskPath, "plan.md"), "Plan");

    await expectEstimateRejected(path.join("reports", "task-106"), "Only Tasks list cards can be estimated.");
    expect(mockedResponses).toHaveLength(0);
  });
});
