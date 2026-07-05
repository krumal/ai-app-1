import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { createRealtimeService } from "./realtime";
import type {
  AppConfig,
  BoardResponse,
  ProjectBoard,
  ProjectConfig,
  ProjectSummary,
  RealtimeServerMessage,
} from "../shared/types";

type SentMessage = RealtimeServerMessage;

class TestSocket {
  messages: SentMessage[] = [];

  send(data: string) {
    this.messages.push(JSON.parse(data) as SentMessage);
  }
}

class TestWatcher {
  closed = false;
  callbacks = new Map<string, Array<(filePath: string) => void>>();

  on(eventName: "add" | "change" | "unlink", callback: (filePath: string) => void) {
    const callbacks = this.callbacks.get(eventName) ?? [];
    callbacks.push(callback);
    this.callbacks.set(eventName, callbacks);
    return this;
  }

  emit(eventName: "add" | "change" | "unlink", filePath: string) {
    for (const callback of this.callbacks.get(eventName) ?? []) {
      callback(filePath);
    }
  }

  close() {
    this.closed = true;
  }
}

type TestContext = {
  root: string;
  taskRootPath: string;
  project: ProjectConfig;
  summary: ProjectSummary;
  config: AppConfig;
  board: ProjectBoard;
};

let context: TestContext;
let watchers: TestWatcher[];
let readableFiles: Set<string>;

beforeEach(async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "localtasks-realtime-"));
  const taskRootPath = path.join(root, ".tasks");
  await mkdir(path.join(taskRootPath, "task-001"), { recursive: true });
  await mkdir(path.join(taskRootPath, "task-002"), { recursive: true });

  const project: ProjectConfig = {
    id: "project-1",
    name: "Project 1",
    repoPath: root,
    taskDirName: ".tasks",
    listOrder: ["tasks"],
  };
  const summary: ProjectSummary = {
    ...project,
    taskRootPath,
    exists: true,
  };
  const board: ProjectBoard = {
    taskRootExists: true,
    taskRootPath,
    labels: [],
    lists: [
      {
        id: "tasks",
        title: "Tasks",
        sourceName: "tasks",
        kind: "tasks",
        cards: [
          {
            id: "task-001",
            title: "Task 001",
            sourceName: "task-001",
            kind: "folder",
            relativePath: "task-001",
            createdAt: null,
            updatedAt: null,
            estimate: null,
            estimateEligible: false,
            estimateIneligibleReason: null,
            labelIds: [],
            labels: [],
            defaultOpenFilePath: "task-001/draft.md",
            files: [
              {
                id: "task-001",
                name: "task-001",
                relativePath: "task-001",
                nodeType: "directory",
                children: [
                  {
                    id: "task-001/draft.md",
                    name: "draft.md",
                    relativePath: "task-001/draft.md",
                    nodeType: "file",
                    isMarkdown: true,
                  },
                  {
                    id: "task-001/plan.md",
                    name: "plan.md",
                    relativePath: "task-001/plan.md",
                    nodeType: "file",
                    isMarkdown: true,
                  },
                ],
              },
            ],
          },
          {
            id: "task-002",
            title: "Task 002",
            sourceName: "task-002",
            kind: "folder",
            relativePath: "task-002",
            createdAt: null,
            updatedAt: null,
            estimate: null,
            estimateEligible: false,
            estimateIneligibleReason: null,
            labelIds: [],
            labels: [],
            defaultOpenFilePath: "task-002/draft.md",
            files: [
              {
                id: "task-002",
                name: "task-002",
                relativePath: "task-002",
                nodeType: "directory",
                children: [
                  {
                    id: "task-002/draft.md",
                    name: "draft.md",
                    relativePath: "task-002/draft.md",
                    nodeType: "file",
                    isMarkdown: true,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  context = {
    root,
    taskRootPath,
    project,
    summary,
    config: {
      version: 1,
      activeProjectId: project.id,
      projects: [project],
    },
    board,
  };
  watchers = [];
  readableFiles = new Set(["task-001/draft.md", "task-001/plan.md", "task-002/draft.md"]);
});

afterEach(async () => {
  await rm(context.root, { recursive: true, force: true });
});

function createTestService(overrides: Parameters<typeof createRealtimeService>[0] = {}) {
  return createRealtimeService({
    loadConfig: async () => context.config,
    getProjectSummaries: async (config) =>
      config.projects.map((project) => ({
        ...project,
        taskRootPath: path.join(project.repoPath, project.taskDirName),
        exists: project.id === context.summary.id ? context.summary.exists : false,
      })),
    buildBoard: async () => context.board,
    readProjectFile: async (project, relativePath) => {
      if (!readableFiles.has(relativePath)) {
        throw new Error("File is not readable.");
      }

      return {
        projectId: project.id,
        relativePath,
        content: `Content for ${relativePath}`,
        format: "markdown",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:01.000Z",
      };
    },
    watch: () => {
      const watcher = new TestWatcher();
      watchers.push(watcher);
      return watcher;
    },
    debounceMs: 1,
    ...overrides,
  });
}

function subscribeMessage(cardRelativePath = "task-001", fileRelativePath = "task-001/draft.md") {
  return JSON.stringify({
    type: "subscribe:file",
    payload: {
      projectId: context.project.id,
      cardRelativePath,
      fileRelativePath,
    },
  });
}

function waitForDebounce() {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

function boardResponse(): BoardResponse {
  return {
    project: {
      ...context.summary,
      repoPath: ".",
      taskRootPath: ".tasks",
    },
    board: {
      ...context.board,
      taskRootPath: ".tasks",
    },
  };
}

describe("realtime service", () => {
  test("sends connection:ready when a socket opens", () => {
    const service = createTestService();
    const socket = new TestSocket();

    service.open(socket);

    expect(socket.messages).toEqual([{ type: "connection:ready" }]);
  });

  test("reports invalid messages without throwing", async () => {
    const service = createTestService();
    const socket = new TestSocket();

    await service.message(socket, "{not json");
    await service.message(socket, JSON.stringify({ type: "unknown" }));

    expect(socket.messages).toEqual([
      {
        type: "subscription:error",
        payload: {
          code: "invalid_message",
          message: "Realtime message is not supported.",
        },
      },
      {
        type: "subscription:error",
        payload: {
          code: "invalid_message",
          message: "Realtime message is not supported.",
        },
      },
    ]);
  });

  test("rejects traversal and absolute subscription paths", async () => {
    const service = createTestService();
    const socket = new TestSocket();

    await service.message(socket, subscribeMessage("../task-001", "task-001/draft.md"));
    await service.message(socket, subscribeMessage("task-001", "/task-001/draft.md"));

    expect(socket.messages.map((message) => message.type)).toEqual([
      "subscription:error",
      "subscription:error",
    ]);
    expect(socket.messages).toEqual([
      {
        type: "subscription:error",
        payload: {
          code: "invalid_path",
          message: "Subscription path is invalid.",
        },
      },
      {
        type: "subscription:error",
        payload: {
          code: "invalid_path",
          message: "Subscription path must be relative.",
        },
      },
    ]);
    expect(
      socket.messages.map((message) =>
        message.type === "subscription:error" ? message.payload.code : null,
      ),
    ).toEqual(["invalid_path", "invalid_path"]);
    expect(service.getSubscriptionCount()).toBe(0);
    expect(service.getWatcherCount()).toBe(0);
  });

  test("rejects invalid projects with subscription:error", async () => {
    const service = createTestService();
    const socket = new TestSocket();

    await service.message(socket, JSON.stringify({
      type: "subscribe:file",
      payload: {
        projectId: "missing-project",
        cardRelativePath: "task-001",
        fileRelativePath: "task-001/draft.md",
      },
    }));

    expect(socket.messages).toEqual([
      {
        type: "subscription:error",
        payload: {
          projectId: "missing-project",
          cardRelativePath: "task-001",
          fileRelativePath: "task-001/draft.md",
          code: "invalid_project",
          message: "Project was not found.",
        },
      },
    ]);
    expect(service.getSubscriptionCount()).toBe(0);
    expect(service.getWatcherCount()).toBe(0);
  });

  test("hides absolute paths from unexpected subscription validation failures", async () => {
    const service = createTestService({
      buildBoard: async () => {
        throw new Error(`Unexpected failure at ${context.taskRootPath}/task-001/draft.md`);
      },
    });
    const socket = new TestSocket();

    await service.message(socket, subscribeMessage());

    expect(socket.messages).toEqual([
      {
        type: "subscription:error",
        payload: {
          projectId: "project-1",
          cardRelativePath: "task-001",
          fileRelativePath: "task-001/draft.md",
          code: "read_failed",
          message: "Realtime subscription failed.",
        },
      },
    ]);
    expect(JSON.stringify(socket.messages)).not.toContain(context.root);
    expect(service.getSubscriptionCount()).toBe(0);
    expect(service.getWatcherCount()).toBe(0);
  });

  test("subscribes valid files and broadcasts only exact matching file updates", async () => {
    const service = createTestService();
    const draftSocket = new TestSocket();
    const planSocket = new TestSocket();

    await service.message(draftSocket, subscribeMessage("task-001", "task-001/draft.md"));
    await service.message(planSocket, subscribeMessage("task-001", "task-001/plan.md"));

    expect(service.getSubscriptionCount()).toBe(2);
    expect(service.getWatcherCount()).toBe(1);
    expect(watchers).toHaveLength(1);

    watchers[0]!.emit("change", path.join(context.taskRootPath, "task-002", "draft.md"));
    await waitForDebounce();
    expect(draftSocket.messages).toEqual([]);
    expect(planSocket.messages).toEqual([]);

    watchers[0]!.emit("change", path.join(context.taskRootPath, "task-001", "draft.md"));
    await waitForDebounce();

    expect(draftSocket.messages).toEqual([
      {
        type: "file:updated",
        payload: {
          projectId: "project-1",
          cardRelativePath: "task-001",
          fileRelativePath: "task-001/draft.md",
          file: {
            projectId: "project-1",
            relativePath: "task-001/draft.md",
            content: "Content for task-001/draft.md",
            format: "markdown",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:01.000Z",
          },
          board: boardResponse(),
        },
      },
    ]);
    expect(planSocket.messages).toEqual([]);
  });

  test("sends file:deleted with board when a subscribed file becomes unreadable", async () => {
    const service = createTestService();
    const socket = new TestSocket();

    await service.message(socket, subscribeMessage());
    readableFiles.delete("task-001/draft.md");
    watchers[0]!.emit("unlink", path.join(context.taskRootPath, "task-001", "draft.md"));
    await waitForDebounce();

    expect(socket.messages).toEqual([
      {
        type: "file:deleted",
        payload: {
          projectId: "project-1",
          cardRelativePath: "task-001",
          fileRelativePath: "task-001/draft.md",
          board: boardResponse(),
        },
      },
    ]);
  });

  test("sends file:deleted with null board when board refresh fails", async () => {
    const service = createTestService();
    const socket = new TestSocket();

    await service.message(socket, subscribeMessage());
    readableFiles.delete("task-001/draft.md");
    context.config = {
      ...context.config,
      projects: [],
    };
    watchers[0]!.emit("unlink", path.join(context.taskRootPath, "task-001", "draft.md"));
    await waitForDebounce();

    expect(socket.messages).toEqual([
      {
        type: "file:deleted",
        payload: {
          projectId: "project-1",
          cardRelativePath: "task-001",
          fileRelativePath: "task-001/draft.md",
          board: null,
        },
      },
    ]);
  });

  test("releases watchers after unsubscribe and disconnect cleanup", async () => {
    const service = createTestService();
    const firstSocket = new TestSocket();
    const secondSocket = new TestSocket();

    await service.message(firstSocket, subscribeMessage("task-001", "task-001/draft.md"));
    await service.message(secondSocket, subscribeMessage("task-001", "task-001/plan.md"));

    await service.message(firstSocket, JSON.stringify({
      type: "unsubscribe:file",
      payload: {
        projectId: "project-1",
        cardRelativePath: "task-001",
        fileRelativePath: "task-001/draft.md",
      },
    }));

    expect(service.getSubscriptionCount()).toBe(1);
    expect(service.getWatcherCount()).toBe(1);
    expect(watchers[0]!.closed).toBe(false);

    service.close(secondSocket);

    expect(service.getSubscriptionCount()).toBe(0);
    expect(service.getWatcherCount()).toBe(0);
    expect(watchers[0]!.closed).toBe(true);
  });
});

describe("realtime websocket endpoint shape", () => {
  test("upgraded websocket receives connection:ready", async () => {
    const service = createTestService();
    const server = Bun.serve({
      port: 0,
      fetch(request, server) {
        const url = new URL(request.url);
        if (url.pathname === "/ws" && server.upgrade(request)) {
          return;
        }

        return new Response("not found", { status: 404 });
      },
      websocket: {
        open: service.open,
        message: service.message,
        close: service.close,
      },
    });

    try {
      const message = await new Promise<RealtimeServerMessage>((resolve, reject) => {
        const client = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
        client.addEventListener("message", (event) => {
          client.close();
          resolve(JSON.parse(String(event.data)) as RealtimeServerMessage);
        });
        client.addEventListener("error", () => {
          reject(new Error("WebSocket connection failed."));
        });
      });

      expect(message).toEqual({ type: "connection:ready" });
    } finally {
      server.stop(true);
    }
  });
});
