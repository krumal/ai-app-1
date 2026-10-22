import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import type {
  EstimateParticipantRole,
  EstimateVote,
  TaskEstimate,
} from "../shared/types";
import { DIGEST_MODEL, createOpenAIClient } from "./ai/openai";
import {
  normalizeTaskRelativePath,
  resolveTaskPath,
} from "./task-paths";

export const ESTIMATE_FILE_NAME = "estimate.json";
export const ALLOWED_STORY_POINTS = [0, 1, 2, 3, 5, 8, 13, 21] as const;
export const ESTIMATE_PARTICIPANTS = [
  "backend engineer",
  "frontend engineer",
  "QA engineer",
  "tech lead",
  "product-minded implementation reviewer",
] as const satisfies readonly EstimateParticipantRole[];

const STORY_POINT_SET = new Set<number>(ALLOWED_STORY_POINTS);
const ROLE_SET = new Set<EstimateParticipantRole>(ESTIMATE_PARTICIPANTS);
const BASE_ESTIMATE_SYSTEM_PROMPT =
  "You are a Scrum Poker participant. Return only strict JSON with fields {\"storyPoints\", \"reason\"}.";
const REQUIRED_SOURCE_FILES = ["draft.md", "plan.md"] as const;
const OPTIONAL_SOURCE_FILE = "implementation_progress.md";

type EstimateContext = {
  taskRootPath: string;
  cardRelativePath: string;
};

type EstimateSource = {
  path: string;
  content: string;
};

type EstimateSourceSelection = {
  sources: string[];
  files: EstimateSource[];
};

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

export function isAllowedStoryPoint(value: unknown): value is (typeof ALLOWED_STORY_POINTS)[number] {
  return typeof value === "number" && Number.isInteger(value) && STORY_POINT_SET.has(value);
}

function isValidRole(value: unknown): value is EstimateParticipantRole {
  return typeof value === "string" && ROLE_SET.has(value as EstimateParticipantRole);
}

export function validateVote(rawVote: unknown): EstimateVote {
  if (!rawVote || typeof rawVote !== "object") {
    throw new Error("Vote must be an object.");
  }

  const vote = rawVote as Partial<EstimateVote>;

  if (!isValidRole(vote.role)) {
    throw new Error("Vote role is not supported.");
  }

  if (!isAllowedStoryPoint(vote.storyPoints)) {
    throw new Error("Story points must use 0, 1, 2, 3, 5, 8, 13, 21 scale.");
  }

  if (typeof vote.reason !== "string" || vote.reason.trim() === "") {
    throw new Error("Vote reason must be a non-empty string.");
  }

  return {
    role: vote.role,
    storyPoints: vote.storyPoints,
    reason: vote.reason.trim(),
  };
}

function parseParticipantVote(rawValue: unknown, role: EstimateParticipantRole): EstimateVote {
  let parsed: { storyPoints?: unknown; reason?: unknown } | unknown = rawValue;

  if (typeof parsed === "string") {
    parsed = JSON.parse(parsed);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Vote payload must be an object.");
  }

  const value = parsed as { storyPoints?: unknown; reason?: unknown };
  return validateVote({
    role,
    storyPoints: value.storyPoints,
    reason: value.reason,
  });
}

export function parseSettledVotes(results: PromiseSettledResult<unknown>[]): EstimateVote[] {
  const votes: EstimateVote[] = [];

  for (const result of results) {
    if (result.status !== "fulfilled") {
      continue;
    }

    const value = result.value;
    try {
      if (typeof value === "string") {
        votes.push(validateVote(JSON.parse(value)));
        continue;
      }

      votes.push(validateVote(value));
    } catch {
      continue;
    }
  }

  return votes;
}

export function medianStoryPoints(votes: EstimateVote[]): number {
  if (votes.length === 0) {
    throw new Error("No votes available.");
  }

  const sorted = [...votes].map((vote) => vote.storyPoints).sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

export function averageStoryPoints(votes: EstimateVote[]): number {
  if (votes.length === 0) {
    throw new Error("No votes available.");
  }

  const sum = votes.reduce((acc, vote) => acc + vote.storyPoints, 0);
  return Number((sum / votes.length).toFixed(1));
}

export function ensureMinimumValidVotes(votes: EstimateVote[], minimum = 3) {
  if (votes.length < minimum) {
    throw new Error(`At least ${minimum} valid votes are required.`);
  }
}

export function buildEstimateExplanation(
  storyPoints: number,
  average: number,
  votes: EstimateVote[],
) {
  if (votes.length === 0) {
    throw new Error("Cannot explain without votes.");
  }

  const voteValues = votes.map((vote) => vote.storyPoints);
  const spread = Math.max(...voteValues) - Math.min(...voteValues);
  const spreadNote = spread > 8 ? " The votes are spread out." : "";

  return `The final estimate is ${storyPoints} points because the median vote is ${storyPoints}. The average vote is ${average}.${spreadNote}`;
}

function isEstimateRecord(value: unknown): value is TaskEstimate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<TaskEstimate>;

  if (candidate.version !== 1) {
    return false;
  }

  if (candidate.scale !== "fibonacci") {
    return false;
  }

  if (
    !isAllowedStoryPoint(candidate.storyPoints) ||
    typeof candidate.averageStoryPoints !== "number" ||
    Number.isNaN(candidate.averageStoryPoints)
  ) {
    return false;
  }

  if (typeof candidate.generatedAt !== "string" || typeof candidate.explanation !== "string") {
    return false;
  }

  if (!Array.isArray(candidate.sources) || candidate.sources.some((source) => typeof source !== "string")) {
    return false;
  }

  if (!Array.isArray(candidate.votes)) {
    return false;
  }

  try {
    candidate.votes.forEach(validateVote);
  } catch {
    return false;
  }

  return true;
}

export function buildEstimate(votes: EstimateVote[], sources: string[]) {
  ensureMinimumValidVotes(votes);
  const storyPoints = medianStoryPoints(votes);
  const average = averageStoryPoints(votes);

  return {
    version: 1 as const,
    storyPoints,
    averageStoryPoints: average,
    scale: "fibonacci" as const,
    generatedAt: new Date().toISOString(),
    sources,
    votes,
    explanation: buildEstimateExplanation(storyPoints, average, votes),
  };
}

export async function readEstimate(context: EstimateContext): Promise<TaskEstimate | null> {
  const estimatePath = resolveTaskPath(resolveEstimateTaskPath(context), ESTIMATE_FILE_NAME);

  try {
    const raw = await readFile(estimatePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!isEstimateRecord(parsed)) {
      throw new Error("Malformed estimate file.");
    }

    return parsed;
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function writeEstimate(context: EstimateContext, estimate: TaskEstimate) {
  if (!isEstimateRecord(estimate)) {
    throw new Error("Invalid estimate payload.");
  }

  const taskRoot = resolveEstimateTaskPath(context);
  await mkdir(taskRoot, { recursive: true });
  const estimatePath = resolveTaskPath(taskRoot, ESTIMATE_FILE_NAME);
  await writeFile(estimatePath, `${JSON.stringify(estimate, null, 2)}\n`, "utf8");
}

export async function estimateFileExists(context: EstimateContext) {
  const estimatePath = resolveTaskPath(resolveEstimateTaskPath(context), ESTIMATE_FILE_NAME);
  return access(estimatePath).then(() => true).catch(() => false);
}

async function readEstimateSources(context: EstimateContext): Promise<EstimateSourceSelection> {
  const resolvedRoot = resolveEstimateTaskPath(context);

  const requiredFiles = await Promise.all(
    REQUIRED_SOURCE_FILES.map(async (fileName) => ({
      path: fileName,
      content: await readFile(resolveTaskPath(resolvedRoot, fileName), "utf8"),
    })),
  );

  const sources: EstimateSource[] = [...requiredFiles];
  try {
    const implementationProgress = await readFile(
      resolveTaskPath(resolvedRoot, OPTIONAL_SOURCE_FILE),
      "utf8",
    );
    sources.push({
      path: OPTIONAL_SOURCE_FILE,
      content: implementationProgress,
    });
  } catch {
    // optional file is intentionally ignored when missing
  }

  return {
    sources: sources.map((source) => source.path),
    files: sources,
  };
}

function resolveEstimateTaskPath(context: EstimateContext) {
  return resolveTaskPath(
    context.taskRootPath,
    normalizeTaskRelativePath(context.cardRelativePath),
    "Task path is outside of project task root.",
  );
}

function buildEstimatePrompt(role: EstimateParticipantRole, files: EstimateSource[]) {
  const fileBlocks = files.map(
    (file) => `<file path="${file.path}">\n${file.content}\n</file>`,
  ).join("\n\n");

  return [
    `You are ${role}. Estimate this task in story points.`,
    `Allowed values: ${ALLOWED_STORY_POINTS.join(", ")}`,
    "Use only the context below.",
    `Context:
${fileBlocks}
`,
    "Return strictly JSON: {\"storyPoints\": <number>, \"reason\": \"<text>\"}.",
  ].join("\n");
}

async function requestParticipantVote(role: EstimateParticipantRole, sources: EstimateSource[]) {
  const client = createOpenAIClient();
  const response = await client.chat.completions.create({
    model: DIGEST_MODEL,
    messages: [
      {
        role: "system",
        content: BASE_ESTIMATE_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: buildEstimatePrompt(role, sources),
      },
    ],
    temperature: 0.2,
    response_format: {
      type: "json_object",
    },
  }) as OpenAIChatCompletionResponse;

  const raw = response.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error(`Participant ${role} returned empty response.`);
  }

  return parseParticipantVote(raw, role);
}

export async function generateEstimate(context: EstimateContext): Promise<TaskEstimate> {
  const sources = await readEstimateSources(context);
  const settledVotes = await Promise.allSettled(
    ESTIMATE_PARTICIPANTS.map((role) => requestParticipantVote(role, sources.files)),
  );

  const votes = parseSettledVotes(settledVotes);
  return buildEstimate(votes, sources.sources);
}
