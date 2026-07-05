import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  BoardLabel,
  BoardCard,
  BoardList,
  CreateTaskInput,
  FileContentResponse,
  FileTreeNode,
  ProjectBoard,
  ProjectConfig,
} from "../shared/types";
import {
  LABELS_FILE_NAME,
  readProjectLabels,
  resolveLabels,
} from "./labels";
import { ESTIMATE_FILE_NAME, readEstimate } from "./estimate";
import {
  getTaskRootPath,
  isRootTaskCardPath,
  isRootTaskFilePath,
  isTaskDirectory,
  resolveTaskPath,
} from "./task-paths";
import {
  parseFrontmatterLabelIds,
  preserveMarkdownFrontmatter,
  stripMarkdownFrontmatter,
} from "./markdown-frontmatter";

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const ACRONYMS = new Map([
  ["api", "API"],
  ["db", "DB"],
  ["oom", "OOM"],
  ["pr", "PR"],
  ["ui", "UI"],
  ["ux", "UX"],
]);

type DirectoryEntry = {
  name: string;
  isDirectory(): boolean;
  isFile(): boolean;
};

type CardTimestamps = {
  createdAt: string | null;
  updatedAt: string | null;
};

export type CardEstimateEligibility = {
  eligible: boolean;
  reason: string | null;
};

export async function buildBoard(project: ProjectConfig): Promise<ProjectBoard> {
  const taskRootPath = getTaskRootPath(project);
  let rootEntries: DirectoryEntry[];

  try {
    rootEntries = await readdir(taskRootPath, { withFileTypes: true });
  } catch {
    return {
      taskRootExists: false,
      taskRootPath,
      labels: [],
      lists: [],
    };
  }

  const labels = await readProjectLabels(project);
  const taskCards: BoardCard[] = [];
  const groupLists: BoardList[] = [];
  const miscCards: BoardCard[] = [];

  for (const entry of sortEntries(rootEntries)) {
    const entryRelativePath = entry.name;

    if (entry.isFile() && entry.name === LABELS_FILE_NAME) {
      continue;
    }

    if (entry.isDirectory() && isTaskDirectory(entry.name)) {
      taskCards.push(
        await buildFolderCard(taskRootPath, entryRelativePath, labels, "tasks"),
      );
      continue;
    }

    if (entry.isDirectory()) {
      groupLists.push(await buildGroupList(taskRootPath, entry.name, labels));
      continue;
    }

    if (entry.isFile()) {
      miscCards.push(await buildFileCard(taskRootPath, entryRelativePath, labels));
    }
  }

  const lists: BoardList[] = [];

  if (taskCards.length > 0) {
    lists.push({
      id: "tasks",
      title: "Tasks",
      sourceName: "tasks",
      kind: "tasks",
      cards: taskCards,
    });
  }

  const orderedGroups = sortLists(groupLists, project.listOrder);
  lists.push(...orderedGroups);

  if (miscCards.length > 0) {
    lists.push({
      id: "misc",
      title: "Misc",
      sourceName: "misc",
      kind: "misc",
      cards: miscCards,
    });
  }

  return {
    taskRootExists: true,
    taskRootPath,
    labels,
    lists,
  };
}

export async function readProjectFile(
  project: ProjectConfig,
  relativePath: string,
): Promise<FileContentResponse> {
  ensureNotSystemFile(relativePath);
  const taskRootPath = getTaskRootPath(project);
  const absolutePath = resolveTaskPath(taskRootPath, relativePath);
  const [content, fileStats] = await Promise.all([
    readFile(absolutePath, "utf8"),
    stat(absolutePath),
  ]);

  return {
    projectId: project.id,
    relativePath,
    content: isMarkdownFile(relativePath) ? stripMarkdownFrontmatter(content) : content,
    format: isMarkdownFile(relativePath) ? "markdown" : "text",
    createdAt: fileStats.birthtime.toISOString(),
    updatedAt: fileStats.mtime.toISOString(),
  };
}

export async function writeProjectFile(
  project: ProjectConfig,
  relativePath: string,
  newContent: string,
): Promise<void> {
  ensureNotSystemFile(relativePath);
  const taskRootPath = getTaskRootPath(project);
  const absolutePath = resolveTaskPath(taskRootPath, relativePath);

  let finalContent = newContent;
  if (isMarkdownFile(relativePath)) {
    try {
      const originalContent = await readFile(absolutePath, "utf8");
      finalContent = preserveMarkdownFrontmatter(originalContent, newContent);
    } catch {
      // If the file doesn't exist or we can't read it, we'll write newContent as-is
    }
  }

  await writeFile(absolutePath, finalContent, "utf8");
}

export async function createProjectTask(project: ProjectConfig, input: CreateTaskInput) {
  const taskRootPath = getTaskRootPath(project);
  const folderName = normalizePathPart(input.folderName, "Folder name is required.");
  const files = normalizeTaskFiles(input.files);
  const folderRelativePath =
    input.listId === "tasks" || input.listId === "misc"
      ? folderName
      : path.join(normalizePathPart(input.listId, "List is required."), folderName);
  const folderPath = resolveTaskPath(taskRootPath, folderRelativePath);

  await mkdir(folderPath, { recursive: false });

  for (const file of files) {
    const filePath = resolveTaskPath(folderPath, file.name);
    await writeFile(filePath, file.content, { encoding: "utf8", flag: "wx" });
  }
}

async function buildGroupList(
  taskRootPath: string,
  groupName: string,
  labels: BoardLabel[],
): Promise<BoardList> {
  const groupAbsolutePath = path.join(taskRootPath, groupName);
  const entries = await readdir(groupAbsolutePath, { withFileTypes: true });
  const cards: BoardCard[] = [];

  for (const entry of sortEntries(entries)) {
    const childRelativePath = path.join(groupName, entry.name);

    if (entry.isDirectory()) {
      cards.push(await buildFolderCard(taskRootPath, childRelativePath, labels, groupName));
      continue;
    }

    if (entry.isFile()) {
      cards.push(await buildFileCard(taskRootPath, childRelativePath, labels));
    }
  }

  return {
    id: groupName,
    title: humanizeName(groupName),
    sourceName: groupName,
    kind: "group",
    cards,
  };
}

async function buildFolderCard(
  taskRootPath: string,
  folderRelativePath: string,
  labels: BoardLabel[],
  listId: string,
): Promise<BoardCard> {
  const folderName = path.basename(folderRelativePath);
  const fileTree = await buildFileTree(taskRootPath, folderRelativePath, estimateIgnoredPaths(folderRelativePath));
  const estimateEligibility = await getCardEstimateEligibility(
    taskRootPath,
    listId,
    folderRelativePath,
    "folder",
    folderName,
  );
  const estimate = await readCardEstimate(taskRootPath, folderRelativePath);
  const defaultOpenFilePath = findFirstMarkdownPath(fileTree);
  const labelIds = await readCardLabelIds(taskRootPath, defaultOpenFilePath);
  const timestamps = summarizeCardTimestamps(fileTree);

  return {
    id: folderRelativePath,
    title: humanizeName(folderName),
    sourceName: folderName,
    kind: "folder",
    relativePath: folderRelativePath,
    estimate,
    estimateEligible: estimateEligibility.eligible,
    estimateIneligibleReason: estimateEligibility.eligible ? null : estimateEligibility.reason,
    ...timestamps,
    labelIds,
    labels: resolveLabels(labelIds, labels),
    files: fileTree,
    defaultOpenFilePath,
  };
}

async function buildFileCard(
  taskRootPath: string,
  fileRelativePath: string,
  labels: BoardLabel[],
): Promise<BoardCard> {
  const fileName = path.basename(fileRelativePath);
  const node = await buildFileTree(taskRootPath, fileRelativePath);
  const defaultOpenFilePath = isMarkdownFile(fileRelativePath) ? fileRelativePath : null;
  const labelIds = await readCardLabelIds(taskRootPath, defaultOpenFilePath);
  const timestamps = summarizeCardTimestamps(node);

  return {
    id: fileRelativePath,
    title: humanizeName(fileName.replace(/\.[^.]+$/, "")),
    sourceName: fileName,
    kind: "file",
    relativePath: fileRelativePath,
    estimate: null,
    estimateEligible: false,
    estimateIneligibleReason: "Only task folders can be estimated.",
    ...timestamps,
    labelIds,
    labels: resolveLabels(labelIds, labels),
    files: node,
    defaultOpenFilePath,
  };
}

export async function getCardEstimateEligibility(
  taskRootPath: string,
  listId: string,
  relativePath: string,
  kind: BoardCard["kind"],
  sourceName: string,
): Promise<CardEstimateEligibility> {
  if (kind !== "folder") {
    return {
      eligible: false,
      reason: "Only task folders can be estimated.",
    };
  }

  if (listId !== "tasks") {
    return {
      eligible: false,
      reason: "Only Tasks list cards can be estimated.",
    };
  }

  if (/[\\/]/.test(relativePath)) {
    return {
      eligible: false,
      reason: "Only root task cards can be estimated.",
    };
  }

  if (!isTaskDirectory(sourceName)) {
    return {
      eligible: false,
      reason: "Task estimate requires task-* folder naming.",
    };
  }

  if (!(await isCardFilePresent(taskRootPath, relativePath, "draft.md"))) {
    return {
      eligible: false,
      reason: "Task estimate requires draft.md.",
    };
  }

  if (!(await isCardFilePresent(taskRootPath, relativePath, "plan.md"))) {
    return {
      eligible: false,
      reason: "Task estimate requires plan.md.",
    };
  }

  return { eligible: true, reason: null };
}

function isCardFilePresent(taskRootPath: string, cardRelativePath: string, fileName: string) {
  const filePath = path.join(taskRootPath, cardRelativePath, fileName);
  return readFile(filePath, "utf8")
    .then(() => true)
    .catch(() => false);
}

function estimateIgnoredPaths(folderRelativePath: string) {
  if (!isRootTaskCardPath(folderRelativePath)) {
    return new Set<string>();
  }

  return new Set([path.join(folderRelativePath, ESTIMATE_FILE_NAME)]);
}

function ensureNotSystemFile(relativePath: string) {
  if (isRootTaskFilePath(relativePath, ESTIMATE_FILE_NAME)) {
    throw new Error("estimate.json is managed by the system and cannot be edited directly.");
  }
}

async function readCardEstimate(taskRootPath: string, cardRelativePath: string) {
  if (!isRootTaskCardPath(cardRelativePath)) {
    return null;
  }

  try {
    return await readEstimate({ taskRootPath, cardRelativePath });
  } catch {
    return null;
  }
}

async function readCardLabelIds(taskRootPath: string, defaultOpenFilePath: string | null) {
  if (!defaultOpenFilePath) {
    return [];
  }

  const content = await readFile(path.join(taskRootPath, defaultOpenFilePath), "utf8");
  return parseFrontmatterLabelIds(content);
}

async function buildFileTree(
  taskRootPath: string,
  relativePath: string,
  excludePaths: Set<string> = new Set(),
): Promise<FileTreeNode[]> {
  const absolutePath = path.join(taskRootPath, relativePath);
  const parts = relativePath.split(path.sep);
  const name = parts.at(-1) ?? relativePath;

  try {
    const entries = await readdir(absolutePath, { withFileTypes: true });
    const children: FileTreeNode[] = [];

    for (const entry of sortEntries(entries)) {
      const childRelativePath = path.join(relativePath, entry.name);
      if (entry.isFile() && excludePaths.has(childRelativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        children.push({
          id: childRelativePath,
          name: entry.name,
          relativePath: childRelativePath,
          nodeType: "directory",
          children: await buildFileTree(taskRootPath, childRelativePath, excludePaths),
        });
        continue;
      }

      if (entry.isFile()) {
        const fileStats = await stat(path.join(taskRootPath, childRelativePath));
        children.push({
          id: childRelativePath,
          name: entry.name,
          relativePath: childRelativePath,
          nodeType: "file",
          isMarkdown: isMarkdownFile(entry.name),
          createdAt: fileStats.birthtime.toISOString(),
          updatedAt: fileStats.mtime.toISOString(),
        });
      }
    }

    return [
      {
        id: relativePath,
        name,
        relativePath,
        nodeType: "directory",
        children,
      },
    ];
  } catch {
    const fileStats = await stat(absolutePath);
    return [
      {
        id: relativePath,
        name,
        relativePath,
        nodeType: "file",
        isMarkdown: isMarkdownFile(relativePath),
        createdAt: fileStats.birthtime.toISOString(),
        updatedAt: fileStats.mtime.toISOString(),
      },
    ];
  }
}

function summarizeCardTimestamps(nodes: FileTreeNode[]): CardTimestamps {
  let createdAt: string | null = null;
  let updatedAt: string | null = null;

  for (const node of nodes) {
    if (node.nodeType === "file") {
      if (node.createdAt && (!createdAt || node.createdAt < createdAt)) {
        createdAt = node.createdAt;
      }

      if (node.updatedAt && (!updatedAt || node.updatedAt > updatedAt)) {
        updatedAt = node.updatedAt;
      }

      continue;
    }

    const childTimestamps = summarizeCardTimestamps(node.children ?? []);

    if (childTimestamps.createdAt && (!createdAt || childTimestamps.createdAt < createdAt)) {
      createdAt = childTimestamps.createdAt;
    }

    if (childTimestamps.updatedAt && (!updatedAt || childTimestamps.updatedAt > updatedAt)) {
      updatedAt = childTimestamps.updatedAt;
    }
  }

  return { createdAt, updatedAt };
}

function findFirstMarkdownPath(nodes: FileTreeNode[]): string | null {
  for (const node of nodes) {
    if (node.nodeType === "file" && node.isMarkdown) {
      return node.relativePath;
    }

    if (node.nodeType === "directory" && node.children) {
      const nested = findFirstMarkdownPath(node.children);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

function isMarkdownFile(name: string) {
  return /\.md$/i.test(name);
}

function sortEntries<T extends { name: string; isDirectory(): boolean }>(entries: T[]) {
  return [...entries].sort((left, right) => {
    if (left.isDirectory() && !right.isDirectory()) {
      return -1;
    }

    if (!left.isDirectory() && right.isDirectory()) {
      return 1;
    }

    return collator.compare(left.name, right.name);
  });
}

function sortLists(lists: BoardList[], configuredOrder: string[]) {
  const orderIndex = new Map(configuredOrder.map((value, index) => [value, index]));

  return [...lists].sort((left, right) => {
    const leftIndex = orderIndex.get(left.id);
    const rightIndex = orderIndex.get(right.id);

    if (leftIndex !== undefined && rightIndex !== undefined) {
      return leftIndex - rightIndex;
    }

    if (leftIndex !== undefined) {
      return -1;
    }

    if (rightIndex !== undefined) {
      return 1;
    }

    return collator.compare(left.sourceName, right.sourceName);
  });
}

function humanizeName(value: string) {
  const taskMatch = value.match(/^task-(\d+)(?:[-_](.+))?$/i);
  if (taskMatch) {
    const [, taskNumber, tail] = taskMatch;
    return tail ? `Task ${taskNumber}: ${humanizeSlug(tail)}` : `Task ${taskNumber}`;
  }

  return humanizeSlug(value);
}

function humanizeSlug(value: string) {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => {
      if (/^\d+$/.test(part)) {
        return part;
      }

      const normalized = part.toLowerCase();
      const acronym = ACRONYMS.get(normalized);
      if (acronym) {
        return acronym;
      }

      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join(" ");
}

function normalizeTaskFiles(files: CreateTaskInput["files"]) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("At least one file is required.");
  }

  const seen = new Set<string>();

  return files.map((file) => {
    const name = normalizePathPart(file.name, "File name is required.");

    if (seen.has(name)) {
      throw new Error(`Duplicate file name: ${name}.`);
    }

    seen.add(name);
    return {
      name,
      content: typeof file.content === "string" ? file.content : "",
    };
  });
}

function normalizePathPart(value: unknown, message: string) {
  if (typeof value !== "string") {
    throw new Error(message);
  }

  const normalized = value.trim().replace(/^\/+|\/+$/g, "");

  if (
    !normalized ||
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized === "." ||
    normalized === ".."
  ) {
    throw new Error(message);
  }

  return normalized;
}
