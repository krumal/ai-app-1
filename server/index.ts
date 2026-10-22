import path from "node:path";
import {
  addProject,
  deleteProject,
  getConfigPath,
  getProjectSummaries,
  loadConfig,
  pickProjectDirectory,
  setActiveProject,
} from "./config";
import { buildBoard, createProjectTask, readProjectFile, writeProjectFile } from "./board";
import { generateProjectDigest, previewProjectDigest } from "./digest";
import { generateEstimate, writeEstimate } from "./estimate";
import {
  addProjectLabel,
  readProjectLabels,
  setProjectFileLabelIds,
} from "./labels";
import { realtimeService } from "./realtime";
import { getTaskRootPath, resolveTaskPath } from "./task-paths";
import { rejectNonLocalRequest } from "./local-access";
import type {
  BoardCard,
  CreateLabelInput,
  CreateProjectInput,
  CreateTaskInput,
  DigestPreviewRequest,
  GenerateDigestRequest,
  GenerateEstimateRequest,
  ProjectBoard,
  ProjectConfig,
  ProjectSummary,
  SetCardLabelsInput,
} from "../shared/types";

const PORT = Number(process.env.PORT ?? 3001);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function empty(status = 204) {
  return new Response(null, {
    status,
  });
}

async function readJsonBody<T>(request: Request) {
  return (await request.json()) as T;
}

function notFound(message: string) {
  return json({ error: message }, 404);
}

function badRequest(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed.";
  return json({ error: message }, 400);
}

function matchProjectRoute(pathname: string, suffix: string) {
  const normalized = pathname.replace(/\/+$/, "");
  const match = normalized.match(new RegExp(`^/api/projects/([^/]+)${suffix}$`));
  return match?.[1] ?? null;
}

function findBoardCard(cards: BoardCard[], cardRelativePath: string) {
  return cards.find(
    (card) => card.relativePath === cardRelativePath || card.id === cardRelativePath,
  );
}

type ProjectContext = {
  project: ProjectConfig;
};

type ProjectSummaryContext = ProjectContext & {
  summary: ProjectSummary;
};

async function getProjectContext(projectId: string): Promise<ProjectContext | null> {
  const config = await loadConfig();
  const project = config.projects.find((candidate) => candidate.id === projectId);

  if (!project) {
    return null;
  }

  return { project };
}

async function getProjectSummaryContext(projectId: string): Promise<ProjectSummaryContext | null> {
  const config = await loadConfig();
  const project = config.projects.find((candidate) => candidate.id === projectId);

  if (!project) {
    return null;
  }

  const summaries = await getProjectSummaries(config);
  const summary = summaries.find((candidate) => candidate.id === projectId);

  if (!summary) {
    return null;
  }

  return { project, summary };
}

async function withProject(
  projectId: string,
  handler: (context: ProjectContext) => Promise<Response>,
) {
  const context = await getProjectContext(projectId);

  if (!context) {
    return notFound(`Project "${projectId}" was not found.`);
  }

  try {
    return await handler(context);
  } catch (error) {
    return badRequest(error);
  }
}

async function withProjectSummary(
  projectId: string,
  handler: (context: ProjectSummaryContext) => Promise<Response>,
) {
  const context = await getProjectSummaryContext(projectId);

  if (!context) {
    return notFound(`Project "${projectId}" was not found.`);
  }

  try {
    return await handler(context);
  } catch (error) {
    return badRequest(error);
  }
}

function buildBoardResponse(project: ProjectSummary, board: ProjectBoard) {
  return { project, board };
}

function getBoardCards(board: ProjectBoard) {
  return board.lists.flatMap((list) => list.cards);
}

export async function apiHandler(request: Request) {
  const rejected = rejectNonLocalRequest(request);
  if (rejected) return rejected;
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return empty();
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    return json({ ok: true, port: PORT });
  }

  if (request.method === "GET" && url.pathname === "/api/config") {
    const config = await loadConfig();
    const projects = await getProjectSummaries(config);

    return json({
      configPath: getConfigPath(),
      config,
      projects,
    });
  }

  if (request.method === "POST" && url.pathname === "/api/projects") {
    try {
      const payload = await readJsonBody<CreateProjectInput>(request);
      const config = await addProject(payload);
      const projects = await getProjectSummaries(config);

      return json({
        configPath: getConfigPath(),
        config,
        projects,
      }, 201);
    } catch (error) {
      return badRequest(error);
    }
  }

  if (request.method === "POST" && url.pathname === "/api/projects/pick") {
    try {
      const repoPath = await pickProjectDirectory();
      if (!repoPath) {
        return empty();
      }

      const config = await addProject({
        name: "",
        repoPath,
      });
      const projects = await getProjectSummaries(config);

      return json({
        configPath: getConfigPath(),
        config,
        projects,
      }, 201);
    } catch (error) {
      return badRequest(error);
    }
  }

  if (request.method === "POST") {
    const tasksProjectId = matchProjectRoute(url.pathname, "/tasks");
    if (tasksProjectId) {
      return withProjectSummary(tasksProjectId, async ({ project, summary }) => {
        const payload = await readJsonBody<CreateTaskInput>(request);
        await createProjectTask(project, payload);
        const board = await buildBoard(project);
        return json(buildBoardResponse(summary, board), 201);
      });
    }

    const labelsProjectId = matchProjectRoute(url.pathname, "/labels");
    if (labelsProjectId) {
      return withProjectSummary(labelsProjectId, async ({ project, summary }) => {
        const payload = await readJsonBody<CreateLabelInput>(request);
        const labels = await addProjectLabel(project, payload);
        return json({ project: summary, labels }, 201);
      });
    }

    const digestPreviewProjectId = matchProjectRoute(url.pathname, "/digest/preview");
    if (digestPreviewProjectId) {
      return withProject(digestPreviewProjectId, async ({ project }) => {
        const payload = await readJsonBody<DigestPreviewRequest>(request);
        return json(await previewProjectDigest(project, payload));
      });
    }

    const digestProjectId = matchProjectRoute(url.pathname, "/digest");
    if (digestProjectId) {
      return withProject(digestProjectId, async ({ project }) => {
        const payload = await readJsonBody<GenerateDigestRequest>(request);
        return json(await generateProjectDigest(project, payload));
      });
    }

    const estimateProjectId = matchProjectRoute(url.pathname, "/estimate");
    if (estimateProjectId) {
      return withProjectSummary(estimateProjectId, async ({ project, summary }) => {
        const payload = await readJsonBody<GenerateEstimateRequest>(request);
        if (!payload.cardRelativePath) {
          return badRequest(new Error("cardRelativePath is required."));
        }

        const taskRootPath = getTaskRootPath(project);
        resolveTaskPath(taskRootPath, payload.cardRelativePath, "Task path is outside of project task root.");
        const board = await buildBoard(project);
        const card = findBoardCard(getBoardCards(board), payload.cardRelativePath);
        if (!card) {
          return notFound(`Card "${payload.cardRelativePath}" was not found.`);
        }

        if (!card.estimateEligible) {
          return badRequest(new Error(card.estimateIneligibleReason || "Card is not eligible for estimate."));
        }

        const estimate = await generateEstimate({
          taskRootPath,
          cardRelativePath: payload.cardRelativePath,
        });
        await writeEstimate(
          {
            taskRootPath,
            cardRelativePath: payload.cardRelativePath,
          },
          estimate,
        );

        const boardWithEstimate = await buildBoard(project);
        return json({ ok: true, estimate, board: buildBoardResponse(summary, boardWithEstimate) });
      });
    }
  }

  if (request.method === "PATCH") {
    const cardLabelsProjectId = matchProjectRoute(url.pathname, "/card-labels");
    if (cardLabelsProjectId) {
      return withProjectSummary(cardLabelsProjectId, async ({ project, summary }) => {
        const payload = await readJsonBody<SetCardLabelsInput>(request);
        const board = await buildBoard(project);
        const card = findBoardCard(getBoardCards(board), payload.cardRelativePath);

        if (!card) {
          return notFound(`Card "${payload.cardRelativePath}" was not found.`);
        }

        if (!card.defaultOpenFilePath) {
          return badRequest(new Error("This card has no primary markdown file for labels."));
        }

        await setProjectFileLabelIds(project, card.defaultOpenFilePath, payload);
        const nextBoard = await buildBoard(project);
        return json(buildBoardResponse(summary, nextBoard));
      });
    }

    const projectId = matchProjectRoute(url.pathname, "/select");
    if (projectId) {
      try {
        const config = await setActiveProject(projectId);
        const projects = await getProjectSummaries(config);

        return json({
          configPath: getConfigPath(),
          config,
          projects,
        });
      } catch (error) {
        return badRequest(error);
      }
    }
  }

  if (request.method === "PUT") {
    const fileProjectId = matchProjectRoute(url.pathname, "/file");
    if (fileProjectId) {
      return withProjectSummary(fileProjectId, async ({ project, summary }) => {
        const { relativePath, content } = await readJsonBody<{ relativePath: string; content: string }>(request);
        if (!relativePath) {
          return badRequest(new Error("File path is required."));
        }

        await writeProjectFile(project, relativePath, content);
        const payload = await readProjectFile(project, relativePath);
        const board = await buildBoard(project);
        return json({ ok: true, file: payload, board: buildBoardResponse(summary, board) });
      });
    }
  }

  if (request.method === "DELETE") {
    const projectId = matchProjectRoute(url.pathname, "");
    if (projectId) {
      try {
        const config = await deleteProject(projectId);
        const projects = await getProjectSummaries(config);

        return json({
          configPath: getConfigPath(),
          config,
          projects,
        });
      } catch (error) {
        return badRequest(error);
      }
    }
  }

  if (request.method === "GET") {
    const labelsProjectId = matchProjectRoute(url.pathname, "/labels");
    if (labelsProjectId) {
      return withProjectSummary(labelsProjectId, async ({ project, summary }) => {
        const labels = await readProjectLabels(project);
        return json({ project: summary, labels });
      });
    }

    const boardProjectId = matchProjectRoute(url.pathname, "/board");
    if (boardProjectId) {
      return withProjectSummary(boardProjectId, async ({ project, summary }) => {
        const board = await buildBoard(project);
        return json(buildBoardResponse(summary, board));
      });
    }

    const fileProjectId = matchProjectRoute(url.pathname, "/file");
    if (fileProjectId) {
      const relativePath = url.searchParams.get("path");
      if (!relativePath) {
        return badRequest(new Error("File path is required."));
      }

      return withProject(fileProjectId, async ({ project }) => {
        const payload = await readProjectFile(project, relativePath);
        return json(payload);
      });
    }
  }

  return notFound(`Route "${request.method} ${url.pathname}" was not found.`);
}

export function handleServerRequest(request: Request, server: { upgrade(request: Request): boolean }) {
  const url = new URL(request.url);
  const rejected = rejectNonLocalRequest(request, url.pathname === "/ws");
  if (rejected) return rejected;
  if (url.pathname === "/ws" && server.upgrade(request)) return;
  return apiHandler(request);
}

if (process.env.LOCALTASKS_SKIP_SERVER !== "1") {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: PORT,
    idleTimeout: 120,
    fetch: handleServerRequest,
    websocket: {
      open: realtimeService.open,
      message: realtimeService.message,
      close: realtimeService.close,
    },
  });

  console.log(
    `LocalTasks API listening on http://127.0.0.1:${server.port} (config: ${path.join(process.env.HOME ?? "~", ".config", "localtasks", "config.json")})`,
  );
}
