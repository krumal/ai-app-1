import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  BoardLabel,
  CreateLabelInput,
  LabelColor,
  LabelRegistry,
  ProjectConfig,
  SetCardLabelsInput,
} from "../shared/types";
import { getTaskRootPath, resolveTaskPath } from "./task-paths";
import {
  parseFrontmatterLabelIds,
  updateFrontmatterLabelIds,
} from "./markdown-frontmatter";

export const LABELS_FILE_NAME = "labels.json";

const LABEL_COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "gray",
] as const satisfies readonly LabelColor[];

const LABEL_COLOR_SET = new Set<LabelColor>(LABEL_COLORS);

export async function readProjectLabels(project: ProjectConfig): Promise<BoardLabel[]> {
  const taskRootPath = getTaskRootPath(project);
  return readLabelsFile(taskRootPath);
}

export async function addProjectLabel(
  project: ProjectConfig,
  input: CreateLabelInput,
): Promise<BoardLabel[]> {
  const taskRootPath = getTaskRootPath(project);
  const labels = await readLabelsFile(taskRootPath);
  const name = input.name.trim();

  if (!name) {
    throw new Error("Label name is required.");
  }

  if (!isLabelColor(input.color)) {
    throw new Error(`Label color must be one of: ${LABEL_COLORS.join(", ")}.`);
  }

  const baseId = toLabelId(name);
  let id = baseId;
  let suffix = 2;

  while (labels.some((label) => label.id === id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const nextLabels = [...labels, { id, name, color: input.color }];
  await writeLabelsFile(taskRootPath, nextLabels);
  return nextLabels;
}

export async function setProjectFileLabelIds(
  project: ProjectConfig,
  fileRelativePath: string,
  input: Pick<SetCardLabelsInput, "labelIds">,
) {
  const taskRootPath = getTaskRootPath(project);
  const labels = await readLabelsFile(taskRootPath);
  const labelIds = normalizeLabelIds(input.labelIds);
  const knownLabelIds = new Set(labels.map((label) => label.id));
  const unknownLabelIds = labelIds.filter((labelId) => !knownLabelIds.has(labelId));

  if (unknownLabelIds.length > 0) {
    throw new Error(`Unknown labels: ${unknownLabelIds.join(", ")}.`);
  }

  const absolutePath = resolveTaskPath(taskRootPath, fileRelativePath);
  const content = await readFile(absolutePath, "utf8");
  await writeFile(absolutePath, updateFrontmatterLabelIds(content, labelIds), "utf8");
}

export function resolveLabels(labelIds: string[], labels: BoardLabel[]) {
  const labelById = new Map(labels.map((label) => [label.id, label]));
  return labelIds
    .map((labelId) => labelById.get(labelId))
    .filter((label): label is BoardLabel => Boolean(label));
}

async function readLabelsFile(taskRootPath: string): Promise<BoardLabel[]> {
  try {
    const raw = await readFile(path.join(taskRootPath, LABELS_FILE_NAME), "utf8");
    const parsed = JSON.parse(raw) as Partial<LabelRegistry>;

    if (parsed.version !== 1 || !Array.isArray(parsed.labels)) {
      throw new Error(`${LABELS_FILE_NAME} must contain version 1 and a labels array.`);
    }

    return parsed.labels.map(normalizeLabel);
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

async function writeLabelsFile(taskRootPath: string, labels: BoardLabel[]) {
  await mkdir(taskRootPath, { recursive: true });
  const registry: LabelRegistry = {
    version: 1,
    labels,
  };

  await writeFile(
    path.join(taskRootPath, LABELS_FILE_NAME),
    `${JSON.stringify(registry, null, 2)}\n`,
    "utf8",
  );
}

function normalizeLabel(label: BoardLabel): BoardLabel {
  if (!label.id || typeof label.id !== "string") {
    throw new Error("Every label must have a string id.");
  }

  if (!label.name || typeof label.name !== "string") {
    throw new Error(`Label "${label.id}" must have a string name.`);
  }

  if (!isLabelColor(label.color)) {
    throw new Error(`Label "${label.id}" has unsupported color "${label.color}".`);
  }

  return {
    id: label.id,
    name: label.name,
    color: label.color,
  };
}

function isLabelColor(value: unknown): value is LabelColor {
  return typeof value === "string" && LABEL_COLOR_SET.has(value as LabelColor);
}

function toLabelId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "label";
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function normalizeLabelIds(labelIds: unknown) {
  if (!Array.isArray(labelIds)) {
    throw new Error("labelIds must be an array.");
  }

  return unique(
    labelIds.map((labelId) => {
      if (typeof labelId !== "string") {
        throw new Error("labelIds must contain only strings.");
      }

      return labelId.trim();
    }).filter(Boolean),
  );
}

function isMissingFileError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
