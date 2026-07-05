import path from "node:path";
import chokidar from "chokidar";
import { buildBoard, readProjectFile } from "./board";
import { getProjectSummaries, loadConfig } from "./config";
import { getTaskRootPath } from "./task-paths";
import type {
  BoardCard,
  BoardResponse,
  ProjectBoard,
  ProjectConfig,
  RealtimeClientMessage,
  RealtimeFileSubscription,
  RealtimeServerMessage,
  RealtimeSubscriptionErrorMessage,
} from "../shared/types";

type RealtimeSocket = {
  send(data: string): unknown;
};

type Watcher = {
  on(eventName: "add" | "change" | "unlink", callback: (filePath: string) => void): Watcher;
  close(): Promise<unknown> | unknown;
};

type RealtimeDependencies = {
  loadConfig: typeof loadConfig;
  getProjectSummaries: typeof getProjectSummaries;
  buildBoard: typeof buildBoard;
  readProjectFile: typeof readProjectFile;
  watch: (taskRootPath: string) => Watcher;
  debounceMs: number;
};

type RegisteredSubscription = RealtimeFileSubscription & {
  project: ProjectConfig;
  taskRootPath: string;
};

type ProjectWatcherState = {
  taskRootPath: string;
  watcher: Watcher;
  timers: Map<string, ReturnType<typeof setTimeout>>;
};

const DEFAULT_DEBOUNCE_MS = 75;

export function createRealtimeService(overrides: Partial<RealtimeDependencies> = {}) {
  const dependencies: RealtimeDependencies = {
    loadConfig,
    getProjectSummaries,
    buildBoard,
    readProjectFile,
    watch: (taskRootPath) =>
      chokidar.watch(taskRootPath, {
        ignoreInitial: true,
        persistent: true,
      }),
    debounceMs: DEFAULT_DEBOUNCE_MS,
    ...overrides,
  };

  const subscriptionsBySocket = new Map<RealtimeSocket, Map<string, RegisteredSubscription>>();
  const projectWatchers = new Map<string, ProjectWatcherState>();

  function open(socket: RealtimeSocket) {
    socket.send(serialize({ type: "connection:ready" }));
  }

  async function message(socket: RealtimeSocket, rawMessage: string | Buffer<ArrayBuffer>) {
    let message: RealtimeClientMessage;

    try {
      message = parseClientMessage(rawMessage);
    } catch {
      sendError(socket, "invalid_message", "Realtime message is not supported.");
      return;
    }

    if (message.type === "subscribe:file") {
      await subscribe(socket, message.payload);
      return;
    }

    unsubscribe(socket, message.payload);
  }

  function close(socket: RealtimeSocket) {
    const subscriptions = subscriptionsBySocket.get(socket);
    if (!subscriptions) {
      return;
    }

    subscriptionsBySocket.delete(socket);
    for (const subscription of subscriptions.values()) {
      closeProjectWatcherIfUnused(subscription.projectId);
    }
  }

  async function subscribe(socket: RealtimeSocket, payload: RealtimeFileSubscription) {
    let subscription: RegisteredSubscription;
    let normalizedPayload: RealtimeFileSubscription | undefined;

    try {
      normalizedPayload = normalizeSubscriptionPayload(payload);
      subscription = await validateSubscription(normalizedPayload);
    } catch (error) {
      const subscriptionError = toSubscriptionError(error);
      sendError(socket, subscriptionError.code, subscriptionError.message, normalizedPayload);
      return;
    }

    const socketSubscriptions = getSocketSubscriptions(socket);
    socketSubscriptions.set(subscriptionKey(subscription), subscription);
    ensureProjectWatcher(subscription);
  }

  function unsubscribe(socket: RealtimeSocket, payload: RealtimeFileSubscription) {
    const socketSubscriptions = subscriptionsBySocket.get(socket);
    if (!socketSubscriptions) {
      return;
    }

    let normalizedPayload: RealtimeFileSubscription;
    try {
      normalizedPayload = normalizeSubscriptionPayload(payload);
    } catch {
      sendError(socket, "invalid_path", "Subscription path is invalid.");
      return;
    }

    const existing = socketSubscriptions.get(subscriptionKey(normalizedPayload));
    socketSubscriptions.delete(subscriptionKey(normalizedPayload));

    if (socketSubscriptions.size === 0) {
      subscriptionsBySocket.delete(socket);
    }

    if (existing) {
      closeProjectWatcherIfUnused(existing.projectId);
    }
  }

  function ensureProjectWatcher(subscription: RegisteredSubscription) {
    if (projectWatchers.has(subscription.projectId)) {
      return;
    }

    const watcher = dependencies.watch(subscription.taskRootPath);
    const state: ProjectWatcherState = {
      taskRootPath: subscription.taskRootPath,
      watcher,
      timers: new Map(),
    };

    watcher
      .on("add", (filePath) => queueFileEvent(subscription.projectId, filePath))
      .on("change", (filePath) => queueFileEvent(subscription.projectId, filePath))
      .on("unlink", (filePath) => queueFileEvent(subscription.projectId, filePath));
    projectWatchers.set(subscription.projectId, state);
  }

  function queueFileEvent(projectId: string, filePath: string) {
    const watcherState = projectWatchers.get(projectId);
    if (!watcherState) {
      return;
    }

    const fileRelativePath = toProtocolRelativePath(watcherState.taskRootPath, filePath);
    if (!fileRelativePath || !hasSubscriptionsForFile(projectId, fileRelativePath)) {
      return;
    }

    const existingTimer = watcherState.timers.get(fileRelativePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    watcherState.timers.set(
      fileRelativePath,
      setTimeout(() => {
        watcherState.timers.delete(fileRelativePath);
        void publishFileEvent(projectId, fileRelativePath);
      }, dependencies.debounceMs),
    );
  }

  async function publishFileEvent(projectId: string, fileRelativePath: string) {
    const subscriptions = getSubscriptionsForFile(projectId, fileRelativePath);
    const firstSubscription = subscriptions[0]?.subscription;
    if (!firstSubscription) {
      return;
    }

    const board = await buildBoardResponse(firstSubscription.project).catch(() => null);

    try {
      const file = await dependencies.readProjectFile(firstSubscription.project, fileRelativePath);
      if (!board) {
        sendErrors(subscriptions, "read_failed", "Could not refresh project board.");
        return;
      }

      sendToSubscriptions(subscriptions, {
        type: "file:updated",
        payload: {
          projectId,
          cardRelativePath: firstSubscription.cardRelativePath,
          fileRelativePath,
          file,
          board,
        },
      });
    } catch {
      sendToSubscriptions(subscriptions, {
        type: "file:deleted",
        payload: {
          projectId,
          cardRelativePath: firstSubscription.cardRelativePath,
          fileRelativePath,
          board,
        },
      });
    }
  }

  async function validateSubscription(normalized: RealtimeFileSubscription): Promise<RegisteredSubscription> {
    const config = await dependencies.loadConfig();
    const project = config.projects.find((candidate) => candidate.id === normalized.projectId);
    if (!project) {
      throw new RealtimeSubscriptionException("invalid_project", "Project was not found.");
    }

    const taskRootPath = getTaskRootPath(project);
    const summaries = await dependencies.getProjectSummaries(config);
    const summary = summaries.find((candidate) => candidate.id === project.id);
    if (!summary?.exists) {
      throw new RealtimeSubscriptionException("invalid_project", "Project task root was not found.");
    }

    const board = await dependencies.buildBoard(project);
    const card = findBoardCard(board, normalized.cardRelativePath);
    if (!card || !cardHasFile(card, normalized.fileRelativePath)) {
      throw new RealtimeSubscriptionException("unsupported_file", "Subscribed file is not part of the card.");
    }

    try {
      await dependencies.readProjectFile(project, normalized.fileRelativePath);
    } catch (error) {
      if (isSystemFileError(error)) {
        throw new RealtimeSubscriptionException("unsupported_file", getErrorMessage(error));
      }

      throw new RealtimeSubscriptionException("read_failed", "Subscribed file could not be read.");
    }

    return {
      ...normalized,
      project,
      taskRootPath,
    };
  }

  function getSocketSubscriptions(socket: RealtimeSocket) {
    const existing = subscriptionsBySocket.get(socket);
    if (existing) {
      return existing;
    }

    const subscriptions = new Map<string, RegisteredSubscription>();
    subscriptionsBySocket.set(socket, subscriptions);
    return subscriptions;
  }

  function closeProjectWatcherIfUnused(projectId: string) {
    if (hasSubscriptionsForProject(projectId)) {
      return;
    }

    const watcherState = projectWatchers.get(projectId);
    if (!watcherState) {
      return;
    }

    for (const timer of watcherState.timers.values()) {
      clearTimeout(timer);
    }

    watcherState.timers.clear();
    projectWatchers.delete(projectId);
    void watcherState.watcher.close();
  }

  function hasSubscriptionsForProject(projectId: string) {
    for (const subscriptions of subscriptionsBySocket.values()) {
      for (const subscription of subscriptions.values()) {
        if (subscription.projectId === projectId) {
          return true;
        }
      }
    }

    return false;
  }

  function hasSubscriptionsForFile(projectId: string, fileRelativePath: string) {
    return getSubscriptionsForFile(projectId, fileRelativePath).length > 0;
  }

  function getSubscriptionsForFile(projectId: string, fileRelativePath: string) {
    const matches: Array<{ socket: RealtimeSocket; subscription: RegisteredSubscription }> = [];

    for (const [socket, subscriptions] of subscriptionsBySocket.entries()) {
      for (const subscription of subscriptions.values()) {
        if (subscription.projectId === projectId && subscription.fileRelativePath === fileRelativePath) {
          matches.push({ socket, subscription });
        }
      }
    }

    return matches;
  }

  async function buildBoardResponse(project: ProjectConfig): Promise<BoardResponse> {
    const [summaries, board] = await Promise.all([
      dependencies.loadConfig().then(dependencies.getProjectSummaries),
      dependencies.buildBoard(project),
    ]);
    const summary = summaries.find((candidate) => candidate.id === project.id);
    if (!summary) {
      throw new Error("Project summary was not found.");
    }

    return sanitizeBoardResponse({ project: summary, board });
  }

  function sendToSubscriptions(
    subscriptions: Array<{ socket: RealtimeSocket; subscription: RegisteredSubscription }>,
    message: RealtimeServerMessage,
  ) {
    for (const { socket, subscription } of subscriptions) {
      if ("payload" in message && "cardRelativePath" in message.payload) {
        socket.send(
          serialize({
            ...message,
            payload: {
              ...message.payload,
              cardRelativePath: subscription.cardRelativePath,
            },
          } as RealtimeServerMessage),
        );
        continue;
      }

      socket.send(serialize(message));
    }
  }

  function sendErrors(
    subscriptions: Array<{ socket: RealtimeSocket; subscription: RegisteredSubscription }>,
    code: RealtimeSubscriptionErrorMessage["payload"]["code"],
    message: string,
  ) {
    for (const { socket, subscription } of subscriptions) {
      sendError(socket, code, message, subscription);
    }
  }

  return {
    open,
    message,
    close,
    getSubscriptionCount() {
      let count = 0;
      for (const subscriptions of subscriptionsBySocket.values()) {
        count += subscriptions.size;
      }

      return count;
    },
    getWatcherCount() {
      return projectWatchers.size;
    },
  };
}

export const realtimeService = createRealtimeService();

function sanitizeBoardResponse(response: BoardResponse): BoardResponse {
  return {
    project: {
      ...response.project,
      repoPath: ".",
      taskRootPath: response.project.taskDirName,
    },
    board: {
      ...response.board,
      taskRootPath: response.project.taskDirName,
    },
  };
}

function parseClientMessage(rawMessage: string | Buffer<ArrayBuffer>): RealtimeClientMessage {
  const text = typeof rawMessage === "string" ? rawMessage : new TextDecoder().decode(rawMessage);
  const parsed = JSON.parse(text) as Partial<RealtimeClientMessage>;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Message must be an object.");
  }

  if (parsed.type !== "subscribe:file" && parsed.type !== "unsubscribe:file") {
    throw new Error("Message type is not supported.");
  }

  if (!parsed.payload || typeof parsed.payload !== "object") {
    throw new Error("Message payload is required.");
  }

  return parsed as RealtimeClientMessage;
}

function normalizeSubscriptionPayload(payload: RealtimeFileSubscription): RealtimeFileSubscription {
  if (!payload || typeof payload !== "object") {
    throw new RealtimeSubscriptionException("invalid_message", "Subscription payload is required.");
  }

  return {
    projectId: normalizeProjectId(payload.projectId),
    cardRelativePath: normalizeRelativePath(payload.cardRelativePath),
    fileRelativePath: normalizeRelativePath(payload.fileRelativePath),
  };
}

function normalizeProjectId(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RealtimeSubscriptionException("invalid_project", "Project id is required.");
  }

  return value.trim();
}

function normalizeRelativePath(value: unknown) {
  if (typeof value !== "string") {
    throw new RealtimeSubscriptionException("invalid_path", "Subscription path is required.");
  }

  const trimmed = value.trim();
  if (
    trimmed === "" ||
    trimmed.includes("\\") ||
    path.posix.isAbsolute(trimmed) ||
    path.win32.isAbsolute(trimmed)
  ) {
    throw new RealtimeSubscriptionException("invalid_path", "Subscription path must be relative.");
  }

  const parts = trimmed.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new RealtimeSubscriptionException("invalid_path", "Subscription path is invalid.");
  }

  return parts.join("/");
}

function toProtocolRelativePath(taskRootPath: string, filePath: string) {
  const relativePath = path.relative(taskRootPath, filePath);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return relativePath.split(path.sep).join("/");
}

function subscriptionKey(subscription: RealtimeFileSubscription) {
  return [
    subscription.projectId,
    subscription.cardRelativePath,
    subscription.fileRelativePath,
  ].join("\0");
}

function findBoardCard(board: ProjectBoard, cardRelativePath: string) {
  return board.lists
    .flatMap((list) => list.cards)
    .find((card) => card.relativePath === cardRelativePath || card.id === cardRelativePath);
}

function cardHasFile(card: BoardCard, fileRelativePath: string) {
  return flattenCardFiles(card).has(fileRelativePath);
}

function flattenCardFiles(card: BoardCard) {
  const paths = new Set<string>();
  const pending = [...card.files];

  while (pending.length > 0) {
    const node = pending.shift()!;
    if (node.nodeType === "file") {
      paths.add(node.relativePath);
      continue;
    }

    pending.push(...(node.children ?? []));
  }

  return paths;
}

function isSystemFileError(error: unknown) {
  return getErrorMessage(error).includes("managed by the system");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Realtime subscription failed.";
}

function sendError(
  socket: RealtimeSocket,
  code: RealtimeSubscriptionErrorMessage["payload"]["code"],
  message: string,
  subscription?: Partial<RealtimeFileSubscription>,
) {
  socket.send(
    serialize({
      type: "subscription:error",
      payload: {
        ...subscription,
        code,
        message,
      },
    }),
  );
}

function serialize(message: RealtimeServerMessage) {
  return JSON.stringify(message);
}

function toSubscriptionError(error: unknown) {
  if (error instanceof RealtimeSubscriptionException) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  return {
    code: "read_failed" as const,
    message: "Realtime subscription failed.",
  };
}

class RealtimeSubscriptionException extends Error {
  constructor(
    readonly code: RealtimeSubscriptionErrorMessage["payload"]["code"],
    message: string,
  ) {
    super(message);
  }
}
