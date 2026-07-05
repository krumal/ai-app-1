import { mkdir, mkdtemp, rm, stat, utimes, writeFile } from "node:fs/promises";
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
  buildBoard,
  getCardEstimateEligibility,
  readProjectFile,
  writeProjectFile,
} from "./board";
import type { FileTreeNode, ProjectConfig } from "../shared/types";
import { ESTIMATE_FILE_NAME } from "./estimate";
import { buildEstimate, writeEstimate } from "./estimate";

type TestProject = {
  root: string;
  project: ProjectConfig;
};

async function createProjectContext(): Promise<TestProject> {
  const root = await mkdtemp(path.join(os.tmpdir(), "localtasks-board-"));
  const project: ProjectConfig = {
    id: "project-1",
    name: "Project 1",
    repoPath: root,
    taskDirName: ".tasks",
    listOrder: ["tasks"],
  };

  await mkdir(path.join(root, ".tasks"), { recursive: true });
  return { root, project };
}

function flattenFilePaths(nodes: FileTreeNode[]) {
  const paths: string[] = [];

  for (const node of nodes) {
    paths.push(node.relativePath);
    if (node.nodeType === "directory") {
      paths.push(...flattenFilePaths(node.children ?? []));
    }
  }

  return paths;
}

function countFileNodes(nodes: FileTreeNode[]): number {
  return nodes.reduce((count, node) => {
    if (node.nodeType === "file") {
      return count + 1;
    }

    return count + countFileNodes(node.children ?? []);
  }, 0);
}

describe("estimate eligibility helper", () => {
  let projectCtx: TestProject;

  beforeEach(async () => {
    projectCtx = await createProjectContext();
  });

  afterEach(async () => {
    await rm(projectCtx.root, { recursive: true, force: true });
  });

  test("returns eligible for root task folder with required files", async () => {
    const cardPath = path.join(projectCtx.root, ".tasks", "task-001");
    await mkdir(cardPath, { recursive: true });
    await writeFile(path.join(cardPath, "draft.md"), "Draft text");
    await writeFile(path.join(cardPath, "plan.md"), "Plan text");

    const result = await getCardEstimateEligibility(
      path.join(projectCtx.root, ".tasks"),
      "tasks",
      "task-001",
      "folder",
      "task-001",
    );

    expect(result).toEqual({ eligible: true, reason: null });
  });

  test("rejects task cards missing draft or plan", async () => {
    const cardPath = path.join(projectCtx.root, ".tasks", "task-002");
    await mkdir(cardPath, { recursive: true });
    await writeFile(path.join(cardPath, "draft.md"), "Draft text");

    const missingPlan = await getCardEstimateEligibility(
      path.join(projectCtx.root, ".tasks"),
      "tasks",
      "task-002",
      "folder",
      "task-002",
    );
    expect(missingPlan.reason).toBe("Task estimate requires plan.md.");
    expect(missingPlan.eligible).toBe(false);
  });

  test("rejects non-task folders even when list is Tasks", async () => {
    const cardPath = path.join(projectCtx.root, ".tasks", "incident-1");
    await mkdir(cardPath, { recursive: true });
    await writeFile(path.join(cardPath, "draft.md"), "Draft text");
    await writeFile(path.join(cardPath, "plan.md"), "Plan text");

    const result = await getCardEstimateEligibility(
      path.join(projectCtx.root, ".tasks"),
      "tasks",
      "incident-1",
      "folder",
      "incident-1",
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("Task estimate requires task-* folder naming.");
  });
});

describe("board estimate integration", () => {
  let projectCtx: TestProject;

  beforeEach(async () => {
    projectCtx = await createProjectContext();
  });

  afterEach(async () => {
    await rm(projectCtx.root, { recursive: true, force: true });
  });

  test("reads existing estimate.json as card.estimate", async () => {
    const cardPath = path.join(projectCtx.root, ".tasks", "task-010");
    await mkdir(cardPath, { recursive: true });
    await writeFile(path.join(cardPath, "draft.md"), "Draft");
    await writeFile(path.join(cardPath, "plan.md"), "Plan");

    await writeEstimate(
      {
        taskRootPath: path.join(projectCtx.root, ".tasks"),
        cardRelativePath: "task-010",
      },
      buildEstimate(
        [
          {
            role: "backend engineer",
            storyPoints: 3,
            reason: "Backend work is straightforward.",
          },
          {
            role: "frontend engineer",
            storyPoints: 5,
            reason: "Frontend impact is small.",
          },
          {
            role: "QA engineer",
            storyPoints: 2,
            reason: "QA tasks are small.",
          },
        ],
        ["draft.md", "plan.md"],
      ),
    );

    const board = await buildBoard(projectCtx.project);
    const card = board.lists.find((item) => item.id === "tasks")?.cards[0];

    expect(card).toBeDefined();
    expect(card!.estimate).not.toBeNull();
    expect(card!.estimate?.storyPoints).toBe(3);
  });

  test("hides estimate.json from file tree and default open path", async () => {
    const cardPath = path.join(projectCtx.root, ".tasks", "task-011");
    await mkdir(cardPath, { recursive: true });
    await writeFile(path.join(cardPath, "draft.md"), "Draft");
    await writeFile(path.join(cardPath, "plan.md"), "Plan");

    await writeEstimate(
      {
        taskRootPath: path.join(projectCtx.root, ".tasks"),
        cardRelativePath: "task-011",
      },
      buildEstimate(
        [
          {
            role: "backend engineer",
            storyPoints: 2,
            reason: "Backend checks are simple.",
          },
          {
            role: "frontend engineer",
            storyPoints: 2,
            reason: "Frontend checks are small.",
          },
          {
            role: "QA engineer",
            storyPoints: 2,
            reason: "QA surface is tiny.",
          },
        ],
        ["draft.md", "plan.md"],
      ),
    );

    const board = await buildBoard(projectCtx.project);
    const card = board.lists.find((item) => item.id === "tasks")?.cards[0];
    const paths = flattenFilePaths(card!.files);

    expect(paths).not.toContain("task-011/estimate.json");
    expect(card!.defaultOpenFilePath).toBe("task-011/draft.md");
  });

  test("keeps nested estimate.json files as regular user-authored files", async () => {
    const cardPath = path.join(projectCtx.root, ".tasks", "task-900");
    await mkdir(path.join(cardPath, "nested"), { recursive: true });
    await writeFile(path.join(cardPath, "draft.md"), "Draft");
    await writeFile(path.join(cardPath, "plan.md"), "Plan");
    await writeFile(path.join(cardPath, "nested", "estimate.json"), "system data");
    await writeFile(path.join(cardPath, "nested", "notes.md"), "Notes");

    const board = await buildBoard(projectCtx.project);
    const card = board.lists.find((item) => item.id === "tasks")?.cards[0];
    const paths = flattenFilePaths(card!.files);

    expect(paths).toContain("task-900/nested/estimate.json");
    expect(paths).toContain("task-900/nested/notes.md");
    expect(countFileNodes(card!.files)).toBe(4);
  });

  test("keeps non-task estimate.json files visible on the board", async () => {
    await writeFile(path.join(projectCtx.root, ".tasks", "estimate.json"), "Root user file");
    await mkdir(path.join(projectCtx.root, ".tasks", "reports"), { recursive: true });
    await writeFile(path.join(projectCtx.root, ".tasks", "reports", "estimate.json"), "Report user file");

    const board = await buildBoard(projectCtx.project);
    const miscCard = board.lists.find((item) => item.id === "misc")?.cards.find((card) => card.relativePath === "estimate.json");
    const reportCard = board.lists.find((item) => item.id === "reports")?.cards.find((card) => card.relativePath === path.join("reports", "estimate.json"));

    expect(miscCard).toBeDefined();
    expect(reportCard).toBeDefined();
  });

  test("does not use estimate.json mtime for card timestamps", async () => {
    const cardPath = path.join(projectCtx.root, ".tasks", "task-012");
    const old = new Date("2026-01-01T00:00:00.000Z");
    const future = new Date("2026-01-05T00:00:00.000Z");

    await mkdir(cardPath, { recursive: true });
    await writeFile(path.join(cardPath, "draft.md"), "Draft");
    await writeFile(path.join(cardPath, "plan.md"), "Plan");
    await utimes(path.join(cardPath, "draft.md"), old, old);
    await utimes(path.join(cardPath, "plan.md"), old, old);

    await writeEstimate(
      {
        taskRootPath: path.join(projectCtx.root, ".tasks"),
        cardRelativePath: "task-012",
      },
      buildEstimate(
        [
          {
            role: "backend engineer",
            storyPoints: 1,
            reason: "Smallest scope.",
          },
          {
            role: "frontend engineer",
            storyPoints: 3,
            reason: "Small UI scope.",
          },
          {
            role: "QA engineer",
            storyPoints: 5,
            reason: "Simple checks.",
          },
        ],
        ["draft.md", "plan.md"],
      ),
    );

    const estimatePath = path.join(cardPath, ESTIMATE_FILE_NAME);
    await utimes(estimatePath, future, future);

    const board = await buildBoard(projectCtx.project);
    const card = board.lists.find((item) => item.id === "tasks")?.cards[0];
    const estimateStats = await stat(estimatePath);

    expect(card).toBeDefined();
    expect(card!.updatedAt).not.toBeNull();
    expect(Date.parse(card!.updatedAt!)).toBeLessThan(estimateStats.mtime.getTime());
  });

  test("rejects estimate.json for editor read/write routes", async () => {
    await mkdir(path.join(projectCtx.root, ".tasks", "task-013"), { recursive: true });
    await writeFile(path.join(projectCtx.root, ".tasks", "task-013", "draft.md"), "Draft");
    await writeFile(path.join(projectCtx.root, ".tasks", "task-013", "plan.md"), "Plan");

    await expect(
      readProjectFile(projectCtx.project, path.join("task-013", "estimate.json")),
    ).rejects.toThrow("estimate.json is managed by the system and cannot be edited directly.");

    await expect(
      writeProjectFile(projectCtx.project, path.join("task-013", "estimate.json"), "bad data"),
    ).rejects.toThrow("estimate.json is managed by the system and cannot be edited directly.");
  });

  test("allows nested estimate.json for editor read/write routes", async () => {
    await mkdir(path.join(projectCtx.root, ".tasks", "task-014", "nested"), { recursive: true });
    await writeFile(path.join(projectCtx.root, ".tasks", "task-014", "draft.md"), "Draft");
    await writeFile(path.join(projectCtx.root, ".tasks", "task-014", "plan.md"), "Plan");
    await writeFile(path.join(projectCtx.root, ".tasks", "task-014", "nested", "estimate.json"), "bad data");

    const payload = await readProjectFile(projectCtx.project, path.join("task-014", "nested", "estimate.json"));
    expect(payload.content).toBe("bad data");

    await writeProjectFile(projectCtx.project, path.join("task-014", "nested", "estimate.json"), "new data");
    const updated = await readProjectFile(projectCtx.project, path.join("task-014", "nested", "estimate.json"));
    expect(updated.content).toBe("new data");
  });

  test("allows non-task estimate.json files for editor read/write routes", async () => {
    await mkdir(path.join(projectCtx.root, ".tasks", "reports"), { recursive: true });
    await writeFile(path.join(projectCtx.root, ".tasks", "estimate.json"), "Root user file");
    await writeFile(path.join(projectCtx.root, ".tasks", "reports", "estimate.json"), "Report user file");

    const rootPayload = await readProjectFile(projectCtx.project, "estimate.json");
    expect(rootPayload.content).toBe("Root user file");

    await writeProjectFile(projectCtx.project, path.join("reports", "estimate.json"), "Updated report file");
    const reportPayload = await readProjectFile(projectCtx.project, path.join("reports", "estimate.json"));
    expect(reportPayload.content).toBe("Updated report file");
  });
});
