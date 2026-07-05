import path from "node:path";
import type { ProjectConfig } from "../shared/types";

export function getTaskRootPath(project: ProjectConfig) {
  return path.join(project.repoPath, project.taskDirName);
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

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error(errorMessage);
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
