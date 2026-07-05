import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  BoardCard,
  BoardList,
  DigestCardPreview,
  DigestPeriod,
  FileTreeNode,
  GenerateDigestResponse,
  ProjectConfig,
} from "../shared/types";
import { buildBoard } from "./board";
import { ESTIMATE_FILE_NAME } from "./estimate";
import { DIGEST_MODEL, createOpenAIClient } from "./ai/openai";
import { getTaskRootPath, isTaskDirectory, resolveTaskPath } from "./task-paths";

type DigestCardContext = {
  card: BoardCard;
  list: BoardList;
  preview: DigestCardPreview;
};

type DigestFile = {
  relativePath: string;
  content: string;
};

const TEXT_FILE_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".csv",
  ".tsv",
]);

export async function previewProjectDigest(
  project: ProjectConfig,
  input: DigestPeriod,
) {
  const period = normalizeDigestPeriod(input);
  const board = await buildBoard(project);
  const cards = collectDigestCardContexts(board.lists, period);

  return {
    period,
    cards: cards.map((card) => card.preview),
  };
}

export async function generateProjectDigest(
  project: ProjectConfig,
  input: DigestPeriod,
): Promise<GenerateDigestResponse> {
  const period = normalizeDigestPeriod(input);
  const board = await buildBoard(project);
  const cardContexts = collectDigestCardContexts(board.lists, period);

  if (cardContexts.length === 0) {
    return {
      period,
      includedCards: [],
      digest: "No tasks were updated in this period.",
    };
  }

  const taskRootPath = getTaskRootPath(project);
  const tasks = await Promise.all(
    cardContexts.map(async (context) => ({
      context,
      files: await readDigestFiles(taskRootPath, context.preview.includedFilePaths),
    })),
  );

  const client = createOpenAIClient();
  const completion = await client.chat.completions.create({
    model: DIGEST_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You generate concise project work digests from local task tracker files.",
          "Write in Russian.",
          "Use only the provided files and task metadata.",
          "Do not invent facts.",
          "For each task, summarize what was worked on, progress, problems or risks, current stopping point, and likely next step.",
          "Return markdown.",
        ].join("\n"),
      },
      {
        role: "user",
        content: buildDigestUserPrompt(period, tasks),
      },
    ],
    temperature: 0.2,
  });

  const digest = completion.choices[0]?.message.content?.trim();

  if (!digest) {
    throw new Error("OpenAI returned an empty digest.");
  }

  return {
    period,
    includedCards: cardContexts.map((context) => context.preview),
    digest,
  };
}

function normalizeDigestPeriod(input: DigestPeriod): DigestPeriod {
  const from = parseLocalDateStart(input.from, "from");
  const to = parseLocalDateEnd(input.to, "to");

  if (from.getTime() > to.getTime()) {
    throw new Error("Digest start date must be before or equal to end date.");
  }

  return {
    from: formatLocalDate(from),
    to: formatLocalDate(to),
  };
}

function collectDigestCardContexts(lists: BoardList[], period: DigestPeriod): DigestCardContext[] {
  const from = parseLocalDateStart(period.from, "from");
  const to = parseLocalDateEnd(period.to, "to");
  const contexts: DigestCardContext[] = [];

  for (const list of lists) {
    for (const card of list.cards) {
      if (!card.updatedAt) {
        continue;
      }

      const updatedAt = new Date(card.updatedAt);
      if (Number.isNaN(updatedAt.getTime())) {
        continue;
      }

      if (updatedAt < from || updatedAt > to) {
        continue;
      }

      const includedFilePaths = collectDigestFilePaths(card, list);
      contexts.push({
        card,
        list,
        preview: {
          id: card.id,
          title: card.title,
          listId: list.id,
          listTitle: list.title,
          relativePath: card.relativePath,
          updatedAt: card.updatedAt,
          labels: card.labels,
          fileCount: includedFilePaths.length,
          includedFilePaths,
        },
      });
    }
  }

  return contexts;
}

function collectDigestFilePaths(card: BoardCard, list: BoardList) {
  if (list.id === "tasks" && card.kind === "folder" && isTaskDirectory(card.sourceName)) {
    const availablePaths = new Set(flattenFileNodes(card.files).map((node) => node.relativePath));
    return ["plan.md", "implementation_progress.md"]
      .map((fileName) => path.join(card.relativePath, fileName))
      .filter((relativePath) => availablePaths.has(relativePath))
      .filter((relativePath) => path.basename(relativePath) !== ESTIMATE_FILE_NAME);
  }

  return flattenFileNodes(card.files)
    .map((node) => node.relativePath)
    .filter((relativePath) => isTextDigestFile(relativePath) && path.basename(relativePath) !== ESTIMATE_FILE_NAME);
}

function flattenFileNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  const files: FileTreeNode[] = [];

  for (const node of nodes) {
    if (node.nodeType === "file") {
      files.push(node);
      continue;
    }

    files.push(...flattenFileNodes(node.children ?? []));
  }

  return files;
}

async function readDigestFiles(taskRootPath: string, relativePaths: string[]) {
  const files: DigestFile[] = [];

  for (const relativePath of relativePaths) {
    const absolutePath = resolveTaskPath(
      taskRootPath,
      relativePath,
      "Digest file is outside of the project task root.",
    );
    const content = await readFile(absolutePath, "utf8");
    files.push({ relativePath, content });
  }

  return files;
}

function buildDigestUserPrompt(
  period: DigestPeriod,
  tasks: Array<{ context: DigestCardContext; files: DigestFile[] }>,
) {
  const blocks = tasks.map(({ context, files }) => {
    const labels = context.card.labels.map((label) => label.name).join(", ") || "none";
    const fileBlocks = files.map(
      (file) => `<file path="${escapeAttribute(file.relativePath)}">\n${file.content}\n</file>`,
    );

    return [
      `<task id="${escapeAttribute(context.card.id)}" title="${escapeAttribute(context.card.title)}" list="${escapeAttribute(context.list.title)}">`,
      `<metadata updatedAt="${context.card.updatedAt ?? ""}" labels="${escapeAttribute(labels)}" relativePath="${escapeAttribute(context.card.relativePath)}" />`,
      ...fileBlocks,
      "</task>",
    ].join("\n");
  });

  return [
    `Период: ${period.from}..${period.to}`,
    "",
    "Есть список задач и файлов, над которыми работали в этот период.",
    "Нужно описать summary по каждой задаче, общий прогресс, проблемы, на чем остановились и следующие шаги.",
    "",
    "Верни markdown в формате:",
    "# AI digest: <period>",
    "## Summary",
    "## Tasks",
    "## Problems and risks",
    "## Where we stopped",
    "## Next steps",
    "",
    "Задачи и файлы:",
    ...blocks,
  ].join("\n");
}

function parseLocalDateStart(value: string, fieldName: string) {
  const parts = parseDateParts(value, fieldName);
  return new Date(parts.year, parts.monthIndex, parts.day, 0, 0, 0, 0);
}

function parseLocalDateEnd(value: string, fieldName: string) {
  const parts = parseDateParts(value, fieldName);
  return new Date(parts.year, parts.monthIndex, parts.day, 23, 59, 59, 999);
}

function parseDateParts(value: string, fieldName: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    throw new Error(`Digest ${fieldName} date must use YYYY-MM-DD format.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new Error(`Digest ${fieldName} date is invalid.`);
  }

  return {
    year,
    monthIndex: month - 1,
    day,
  };
}

function formatLocalDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isTextDigestFile(relativePath: string) {
  return TEXT_FILE_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
