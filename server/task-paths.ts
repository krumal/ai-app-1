import path from "node:path";
import { lstatSync } from "node:fs";
import type { ProjectConfig } from "../shared/types";

export function getTaskRootPath(project: Pick<ProjectConfig, "repoPath" | "taskDirName">) {
  if (!project.taskDirName || project.taskDirName === "." || project.taskDirName === ".."
    || /[/\\]/.test(project.taskDirName)) {
    throw new Error("Task directory must be a single directory name.");
  }
  return resolveTaskPath(project.repoPath, project.taskDirName);
}

export function normalizeTaskRelativePath(value: string) {
  return value.replace(/^[/\\]+/, "").trim();
}

export function resolveTaskPath(
  taskRootPath: string,
  relativePath: string,
  errorMessage = "Requested file is outside of the project task root.",
) {
  const normalizedRootPath = path.resolve(taskRootPath);
  const normalizedRelativePath = normalizeTaskRelativePath(relativePath);
  const resolvedPath = path.resolve(normalizedRootPath, normalizedRelativePath);
  const relativeToRoot = path.relative(normalizedRootPath, resolvedPath);

  if (relativeToRoot === ".." || relativeToRoot.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToRoot)) {
    throw new Error(errorMessage);
  }

  // Never follow a task-root, directory, file, or dangling symbolic link.
  // Missing suffixes are allowed so normal task/file creation still works.
  let current = normalizedRootPath;
  const parts = relativeToRoot ? relativeToRoot.split(path.sep) : [];
  for (let index = 0; index <= parts.length; index += 1) {
    if (index > 0) current = path.join(current, parts[index - 1]!);
    try {
      if (lstatSync(current).isSymbolicLink()) {
        throw new Error("Symbolic links are not allowed in task paths.");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") break;
      throw error;
    }
  }

  return resolvedPath;
}

export function isTaskDirectory(name: string) {
  return /^task-\d+([_-].+)?$/i.test(name);
}

export function isRootTaskCardPath(relativePath: string) {
  const parts = getRelativePathParts(relativePath);
  return parts.length === 1 && isTaskDirectory(parts[0]!);
}

export function isRootTaskFilePath(relativePath: string, fileName: string) {
  const parts = getRelativePathParts(relativePath);
  return parts.length === 2 && isTaskDirectory(parts[0]!) && parts[1] === fileName;
}

function getRelativePathParts(relativePath: string) {
  return relativePath
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);
}
