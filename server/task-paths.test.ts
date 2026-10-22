import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "bun:test";
import { withFixture } from "../test/fixture";
import { getTaskRootPath, resolveTaskPath } from "./task-paths";
import { readProjectFile, writeProjectFile } from "./board";
import { addProjectLabel, readProjectLabels } from "./labels";
import { readEstimate, writeEstimate } from "./estimate";
import type { ProjectConfig } from "../shared/types";

const project = (repoPath: string): ProjectConfig => ({
  id: "demo", name: "Demo", repoPath, taskDirName: ".tasks", listOrder: ["tasks"],
});

test("task paths reject both file and directory symbolic links without touching their targets", () =>
  withFixture(async root => {
    const repo = path.join(root, "repo"), outside = path.join(root, "outside");
    const tasks = path.join(repo, ".tasks");
    await mkdir(tasks, { recursive: true });
    await mkdir(outside);
    await writeFile(path.join(outside, "note.txt"), "untouched");
    await symlink(path.join(outside, "note.txt"), path.join(tasks, "linked.txt"));
    await symlink(outside, path.join(tasks, "linked"), "dir");
    for (const relative of ["linked.txt", "linked/note.txt", "linked/new.txt"]) {
      expect(() => resolveTaskPath(tasks, relative)).toThrow(/symbolic link/i);
      await expect(readProjectFile(project(repo), relative)).rejects.toThrow(/symbolic link/i);
      await expect(writeProjectFile(project(repo), relative, "replacement")).rejects.toThrow(/symbolic link/i);
    }
    expect(await readFile(path.join(outside, "note.txt"), "utf8")).toBe("untouched");
  }));

test("task roots cannot themselves be links or traverse outside the selected repository", () =>
  withFixture(async root => {
    const repo = path.join(root, "repo"), outside = path.join(root, "outside");
    await mkdir(repo); await mkdir(outside);
    await symlink(outside, path.join(repo, ".tasks"), "dir");
    expect(() => getTaskRootPath(project(repo))).toThrow(/symbolic link/i);
    for (const taskDirName of ["..", "../outside", "nested/tasks", "nested\\tasks"]) {
      expect(() => getTaskRootPath({ ...project(repo), taskDirName })).toThrow(/task directory/i);
    }
  }));

test("labels cannot read or overwrite a linked registry", () =>
  withFixture(async root => {
    const repo = path.join(root, "repo"), tasks = path.join(repo, ".tasks");
    await mkdir(tasks, { recursive: true });
    const outside = path.join(root, "registry.json");
    const original = JSON.stringify({ version: 1, labels: [] });
    await writeFile(outside, original);
    await symlink(outside, path.join(tasks, "labels.json"));
    await expect(readProjectLabels(project(repo))).rejects.toThrow(/symbolic link/i);
    await expect(addProjectLabel(project(repo), { name: "New", color: "blue" })).rejects.toThrow(/symbolic link/i);
    expect(await readFile(outside, "utf8")).toBe(original);
  }));

test("an estimate file link is rejected before read or replacement", () =>
  withFixture(async root => {
    const tasks = path.join(root, ".tasks"), card = path.join(tasks, "task-001");
    await mkdir(card, { recursive: true });
    const outside = path.join(root, "outside.json");
    await writeFile(outside, "untouched");
    await symlink(outside, path.join(card, "estimate.json"));
    const context = { taskRootPath: tasks, cardRelativePath: "task-001" };
    await expect(readEstimate(context)).rejects.toThrow(/symbolic link/i);
    await expect(writeEstimate(context, {
      version: 1, storyPoints: 3, averageStoryPoints: 3, scale: "fibonacci",
      generatedAt: "2026-10-22T00:00:00.000Z", sources: ["draft.md", "plan.md"],
      votes: ["backend engineer", "frontend engineer", "QA engineer"].map(role => ({
        role: role as "backend engineer", storyPoints: 3, reason: "Small change.",
      })), explanation: "Small change.",
    })).rejects.toThrow(/symbolic link/i);
    expect(await readFile(outside, "utf8")).toBe("untouched");
  }));

test("normal task paths still support reading and creating files", () =>
  withFixture(async root => {
    const tasks = path.join(root, ".tasks");
    await mkdir(path.join(tasks, "task-001"), { recursive: true });
    await writeProjectFile(project(root), "task-001/notes.txt", "hello");
    expect((await readProjectFile(project(root), "task-001/notes.txt")).content).toBe("hello");
    expect(resolveTaskPath(tasks, "..notes.txt")).toBe(path.join(tasks, "..notes.txt"));
    expect(() => resolveTaskPath(tasks, "../outside.txt")).toThrow(/outside/i);
  }));

test("dangling symbolic links are rejected for new-file writes", () =>
  withFixture(async root => {
    const tasks = path.join(root, ".tasks");
    await mkdir(tasks);
    const outside = path.join(root, "not-created.txt");
    await symlink(outside, path.join(tasks, "dangling.txt"));
    await expect(writeProjectFile(project(root), "dangling.txt", "replacement"))
      .rejects.toThrow(/symbolic link/i);
    await expect(readFile(outside)).rejects.toMatchObject({ code: "ENOENT" });
  }));
