import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import {
  ALLOWED_STORY_POINTS,
  averageStoryPoints,
  buildEstimate,
  buildEstimateExplanation,
  ensureMinimumValidVotes,
  estimateFileExists,
  medianStoryPoints,
  parseSettledVotes,
  readEstimate,
  validateVote,
  writeEstimate,
} from "./estimate";
import { resolveTaskPath } from "./task-paths";
import type { EstimateVote } from "../shared/types";

type TempProject = {
  taskRootPath: string;
};

const BASE_VOTES: EstimateVote[] = [
  {
    role: "backend engineer",
    storyPoints: 1,
    reason: "Backend work is straightforward.",
  },
  {
    role: "frontend engineer",
    storyPoints: 3,
    reason: "Only one modal and one badge.",
  },
  {
    role: "QA engineer",
    storyPoints: 2,
    reason: "Testing surface is small.",
  },
  {
    role: "tech lead",
    storyPoints: 5,
    reason: "Need to keep persistence and safety boundaries clear.",
  },
];

describe("estimate vote validation", () => {
  test("accepts valid vote", () => {
    const vote = validateVote({
      role: "backend engineer",
      storyPoints: 3,
      reason: "Needs moderate API work.",
    });

    expect(vote).toEqual({
      role: "backend engineer",
      storyPoints: 3,
      reason: "Needs moderate API work.",
    });
  });

  test("rejects unsupported story point value", () => {
    expect(() =>
      validateVote({
        role: "backend engineer",
        storyPoints: 4,
        reason: "This value is not on the scale.",
      }),
    ).toThrow("Story points must use 0, 1, 2, 3, 5, 8, 13, 21 scale.");
  });

  test("rejects unsupported role", () => {
    expect(() =>
      validateVote({
        role: "architect",
        storyPoints: 3,
        reason: "Out of scope.",
      }),
    ).toThrow("Vote role is not supported.");
  });

  test("accepts only supported story point scale", () => {
    const allowedPoints = [...ALLOWED_STORY_POINTS];
    expect(allowedPoints).toEqual([0, 1, 2, 3, 5, 8, 13, 21]);
  });
});

describe("estimate participant normalization", () => {
  test("keeps only fulfilled and valid settled results", () => {
    const results: Array<PromiseSettledResult<unknown>> = [
      { status: "fulfilled", value: JSON.stringify(BASE_VOTES[0]) as unknown },
      { status: "rejected", reason: "timeout" },
      { status: "fulfilled", value: JSON.stringify(BASE_VOTES[1]) as unknown },
      { status: "fulfilled", value: { role: "backend engineer", storyPoints: 34, reason: "Too big." } as unknown },
      { status: "fulfilled", value: "not-json" as unknown },
    ];

    expect(parseSettledVotes(results)).toEqual([BASE_VOTES[0], BASE_VOTES[1]]);
  });
});

describe("estimate math", () => {
  test("computes median correctly for odd and even counts", () => {
    const odd = medianStoryPoints([BASE_VOTES[0], BASE_VOTES[1], BASE_VOTES[2]]);
    const even = medianStoryPoints([BASE_VOTES[0], BASE_VOTES[1], BASE_VOTES[2], BASE_VOTES[3]]);

    expect(odd).toBe(2);
    expect(even).toBe(3);
  });

  test("computes average rounded to one decimal place", () => {
    const average = averageStoryPoints([
      { role: "backend engineer", storyPoints: 1, reason: "a" },
      { role: "frontend engineer", storyPoints: 2, reason: "b" },
      { role: "QA engineer", storyPoints: 2, reason: "c" },
    ]);

    expect(average).toBe(1.7);
  });
});

describe("estimate composition", () => {
  test("builds deterministic explanation", () => {
    const votes = [BASE_VOTES[0], BASE_VOTES[1], BASE_VOTES[2], BASE_VOTES[3]];
    const estimate = buildEstimate(votes, ["draft.md", "plan.md"]);

    expect(estimate.storyPoints).toBe(3);
    expect(estimate.averageStoryPoints).toBe(2.8);
    expect(buildEstimateExplanation(estimate.storyPoints, estimate.averageStoryPoints, votes)).toContain(
      `final estimate is ${estimate.storyPoints} points`,
    );
  });

  test("requires at least three valid votes", () => {
    const votes = [BASE_VOTES[0], BASE_VOTES[1]];
    expect(() => ensureMinimumValidVotes(votes)).toThrow("At least 3 valid votes are required.");
    expect(() => buildEstimate(votes, ["draft.md", "plan.md"])).toThrow("At least 3 valid votes are required.");
  });
});

describe("estimate file helpers", () => {
  let project: TempProject;

  beforeEach(async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "localtasks-estimate-"));
    await mkdir(tempDir, { recursive: true });
    project = { taskRootPath: tempDir };
  });

  afterEach(async () => {
    await rm(project.taskRootPath, { recursive: true, force: true });
  });

  test("reads null when estimate file is missing", async () => {
    const estimate = await readEstimate({ taskRootPath: project.taskRootPath, cardRelativePath: "task-001" });
    expect(estimate).toBeNull();
    expect(await estimateFileExists({ taskRootPath: project.taskRootPath, cardRelativePath: "task-001" })).toBe(
      false,
    );
  });

  test("reads and writes estimate file with safe path handling", async () => {
    const taskRelativePath = "task-001";
    await mkdir(path.join(project.taskRootPath, taskRelativePath), { recursive: true });

    await writeEstimate(
      {
        taskRootPath: project.taskRootPath,
        cardRelativePath: taskRelativePath,
      },
      buildEstimate(BASE_VOTES, ["draft.md", "plan.md", "implementation_progress.md"]),
    );

    const estimate = await readEstimate({
      taskRootPath: project.taskRootPath,
      cardRelativePath: taskRelativePath,
    });

    expect(estimate).not.toBeNull();
    expect(estimate?.storyPoints).toBe(3);
    expect(await estimateFileExists({ taskRootPath: project.taskRootPath, cardRelativePath: taskRelativePath })).toBe(true);
  });

  test("rejects path traversal outside task root", () => {
    expect(() => resolveTaskPath(
      project.taskRootPath,
      "../outside",
      "Task path is outside of project task root.",
    )).toThrow(
      "Task path is outside of project task root.",
    );
  });

  test("parses files from filesystem and ignores non-estimate files", async () => {
    await mkdir(path.join(project.taskRootPath, "task-002"), { recursive: true });
    await writeFile(
      path.join(project.taskRootPath, "task-002", "plan.md"),
      "Plan text",
      "utf8",
    );
    await writeEstimate(
      {
        taskRootPath: project.taskRootPath,
        cardRelativePath: "task-002",
      },
      buildEstimate(BASE_VOTES, ["draft.md", "plan.md"]),
    );

    const rawPlan = await readFile(path.join(project.taskRootPath, "task-002", "plan.md"), "utf8");
    expect(rawPlan).toBe("Plan text");
  });
});
