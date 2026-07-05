import path from "node:path";
import {
  createResearchFolderFiles,
  createSparseTaskFiles,
  createTaskFiles,
  createWorld,
  markdown,
  taskFolder,
  text,
  type GeneratedFile,
  type GeneratedWorld,
  type TaskContentOptions,
} from "./factories";
import { createRandom } from "./random";

export const PRESET_NAMES = ["smoke", "rich", "edge", "large"] as const;

export type PresetName = (typeof PRESET_NAMES)[number];

const TOPICS = [
  "board filtering",
  "markdown preview",
  "project settings",
  "filesystem sync",
  "task search",
  "AI digest",
  "modal keyboard flow",
  "performance profiling",
  "content parser",
  "list ordering",
] as const;

const OWNERS = ["Timur", "Frontend Agent", "Backend Agent", "Reviewer Agent"] as const;
const STATUSES = ["draft", "planned", "in-progress", "blocked", "review"] as const;
const COMPLEXITIES = ["S", "M", "L", "XL"] as const;

export function buildPreset(input: {
  preset: PresetName;
  name: string;
  repoPath: string;
  seed: number;
}): GeneratedWorld {
  const random = createRandom(input.seed);

  switch (input.preset) {
    case "smoke":
      return buildSmokePreset(input.name, input.repoPath, random);
    case "rich":
      return buildRichPreset(input.name, input.repoPath, random);
    case "edge":
      return buildEdgePreset(input.name, input.repoPath, random);
    case "large":
      return buildLargePreset(input.name, input.repoPath, random);
  }
}

export function isPresetName(value: string): value is PresetName {
  return PRESET_NAMES.includes(value as PresetName);
}

function buildSmokePreset(
  name: string,
  repoPath: string,
  random: ReturnType<typeof createRandom>,
) {
  const files: GeneratedFile[] = [
    ...createTaskFiles(taskFolder(1, "project-onboarding"), taskOptions(random, "Project onboarding")),
    ...createTaskFiles(taskFolder(2, "modal-preview"), taskOptions(random, "Modal preview")),
    markdown(
      path.join("incidents", "2026-05-04-api-timeout.md"),
      "# API Timeout\n\nA compact incident report for smoke-testing non-task lists.\n",
    ),
  ];

  return createWorld({
    name,
    repoPath,
    listOrder: ["tasks", "incidents"],
    files,
  });
}

function buildRichPreset(
  name: string,
  repoPath: string,
  random: ReturnType<typeof createRandom>,
) {
  const files: GeneratedFile[] = [];

  for (let index = 1; index <= 9; index += 1) {
    const topic = random.pick(TOPICS);
    files.push(
      ...createTaskFiles(
        taskFolder(index, slugify(topic)),
        taskOptions(random, titleCase(topic), {
          includeCode: index % 3 === 0,
          includeTable: index % 2 === 0,
        }),
      ),
    );
  }

  files.push(
    markdown(
      path.join("incidents", "2026-05-04-stale-config.md"),
      "# Stale Config Investigation\n\n- Impact: active project points to a missing `.tasks` folder.\n- Mitigation: switch project and reload board.\n",
    ),
    markdown(
      path.join("reports", "weekly-ai-coding-review.md"),
      "# Weekly AI Coding Review\n\n| Signal | Value |\n| --- | --- |\n| Completed | 7 |\n| Needs review | 3 |\n",
    ),
    ...createResearchFolderFiles(
      path.join("experiments", "agent-generated-summary"),
      taskOptions(random, "Agent generated summary", { includeCode: true }),
    ),
    text(path.join("misc-notes.txt"), "Root-level file to exercise the Misc list.\n"),
  );

  return createWorld({
    name,
    repoPath,
    listOrder: ["tasks", "incidents", "reports", "experiments"],
    files,
  });
}

function buildEdgePreset(
  name: string,
  repoPath: string,
  random: ReturnType<typeof createRandom>,
) {
  const files: GeneratedFile[] = [
    ...createSparseTaskFiles(
      taskFolder(1, "missing-plan-file"),
      taskOptions(random, "Missing plan file"),
    ),
    ...createTaskFiles(
      taskFolder(2, "very-long-card-title-for-overflow-testing-in-board-columns"),
      taskOptions(random, "Very long card title for overflow testing in board columns", {
        includeTable: true,
      }),
    ),
    markdown(
      path.join("incidents", "2026-05-04-empty-response.md"),
      "# Empty Response\n\nThis file checks single-file cards in custom lists.\n",
    ),
    text(path.join("reports", "raw-export.json"), JSON.stringify({ ok: true, rows: 3 }, null, 2)),
    markdown(
      path.join("deep-research", "agent", "trace", "analysis.md"),
      "# Deeply Nested Analysis\n\nNested content should stay accessible through the modal file tree.\n",
    ),
  ];

  return createWorld({
    name,
    repoPath,
    listOrder: ["tasks", "incidents", "reports", "deep-research", "empty-list"],
    directories: ["empty-list"],
    files,
  });
}

function buildLargePreset(
  name: string,
  repoPath: string,
  random: ReturnType<typeof createRandom>,
) {
  const files: GeneratedFile[] = [];

  for (let index = 1; index <= 75; index += 1) {
    const topic = `${titleCase(random.pick(TOPICS))} ${index}`;
    files.push(
      ...createTaskFiles(
        taskFolder(index, slugify(topic)),
        taskOptions(random, topic, {
          includeCode: index % 10 === 0,
          includeTable: index % 7 === 0,
        }),
      ),
    );
  }

  for (let index = 1; index <= 20; index += 1) {
    files.push(
      markdown(
        path.join("incidents", `2026-05-${String(index).padStart(2, "0")}-load-test.md`),
        `# Load Test Incident ${index}\n\nSynthetic incident for column and scroll testing.\n`,
      ),
    );
  }

  return createWorld({
    name,
    repoPath,
    listOrder: ["tasks", "incidents"],
    files,
  });
}

function taskOptions(
  random: ReturnType<typeof createRandom>,
  title: string,
  overrides: Partial<Pick<TaskContentOptions, "includeCode" | "includeTable">> = {},
): TaskContentOptions {
  return {
    title,
    kind: random.pick(["feature", "bugfix", "research", "refactor"]),
    owner: random.pick(OWNERS),
    status: random.pick(STATUSES),
    complexity: random.pick(COMPLEXITIES),
    tags: [random.pick(["frontend", "backend", "shared"]), random.pick(["ai-coding", "ux", "data"])],
    sections: [
      `${title} needs enough realistic content to make the board useful during development.`,
      `The important part is keeping generated artifacts close to the real .tasks conventions.`,
      `Current progress is synthetic but intentionally shaped like real implementation notes.`,
    ],
    includeCode: overrides.includeCode,
    includeTable: overrides.includeTable,
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCase(value: string) {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
