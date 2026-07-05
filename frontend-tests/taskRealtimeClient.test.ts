import { describe, expect, test } from "bun:test";
import { TaskRealtimeClient } from "../src/taskRealtimeClient";
import type {
  FileContentResponse,
  RealtimeFileSubscription,
  RealtimeServerMessage,
} from "../shared/types";

type Listener = () => void;
type MessageListener = (event: { data: unknown }) => void;

class FakeWebSocket {
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readyState = 0;
  sentMessages: unknown[] = [];
  private listeners = {
    open: [] as Listener[],
    message: [] as MessageListener[],
    close: [] as Listener[],
    error: [] as Listener[],
  };

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: "open", listener: Listener): void;
  addEventListener(type: "message", listener: MessageListener): void;
  addEventListener(type: "close" | "error", listener: Listener): void;
  addEventListener(type: "open" | "message" | "close" | "error", listener: Listener | MessageListener) {
    this.listeners[type].push(listener as never);
  }

  send(data: string) {
    this.sentMessages.push(JSON.parse(data));
  }

  close() {
    this.readyState = 3;
    for (const listener of this.listeners.close) {
      listener();
    }
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    for (const listener of this.listeners.open) {
      listener();
    }
  }

  receive(message: RealtimeServerMessage) {
    for (const listener of this.listeners.message) {
      listener({ data: JSON.stringify(message) });
    }
  }
}

function subscription(fileRelativePath: string): RealtimeFileSubscription {
  return {
    projectId: "project-1",
    cardRelativePath: "task-001",
    fileRelativePath,
  };
}

function file(relativePath: string, content = "content"): FileContentResponse {
  return {
    projectId: "project-1",
    relativePath,
    content,
    format: "markdown",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:01.000Z",
  };
}

function createClient() {
  FakeWebSocket.instances = [];
  const timers: Array<() => void> = [];
  const updated: RealtimeServerMessage[] = [];
  const deleted: RealtimeServerMessage[] = [];
  const errors: RealtimeServerMessage[] = [];
  const client = new TaskRealtimeClient({
    getUrl: () => "ws://localtasks.test/ws",
    WebSocketCtor: FakeWebSocket,
    setTimer: (callback) => {
      timers.push(callback);
      return timers.length - 1;
    },
    clearTimer: () => {},
    onFileUpdated: (message) => updated.push(message),
    onFileDeleted: (message) => deleted.push(message),
    onSubscriptionError: (message) => errors.push(message),
  });

  return {
    client,
    timers,
    updated,
    deleted,
    errors,
  };
}

describe("TaskRealtimeClient", () => {
  test("subscribes and unsubscribes when the selected file changes", () => {
    const { client } = createClient();
    const draft = subscription("task-001/draft.md");
    const plan = subscription("task-001/plan.md");

    client.connect();
    const socket = FakeWebSocket.instances[0]!;
    client.setSubscription(draft);
    socket.open();
    client.setSubscription(plan);

    expect(socket.sentMessages).toEqual([
      {
        type: "subscribe:file",
        payload: draft,
      },
      {
        type: "unsubscribe:file",
        payload: draft,
      },
      {
        type: "subscribe:file",
        payload: plan,
      },
    ]);
  });

  test("resubscribes to the current file after reconnect", () => {
    const { client, timers } = createClient();
    const draft = subscription("task-001/draft.md");

    client.connect();
    const firstSocket = FakeWebSocket.instances[0]!;
    client.setSubscription(draft);
    firstSocket.open();
    firstSocket.close();
    timers[0]!();
    const secondSocket = FakeWebSocket.instances[1]!;
    secondSocket.open();

    expect(firstSocket.sentMessages).toEqual([
      {
        type: "subscribe:file",
        payload: draft,
      },
    ]);
    expect(secondSocket.sentMessages).toEqual([
      {
        type: "subscribe:file",
        payload: draft,
      },
    ]);
  });

  test("ignores stale events for the previously selected file", () => {
    const { client, updated } = createClient();
    const draft = subscription("task-001/draft.md");
    const plan = subscription("task-001/plan.md");

    client.connect();
    const socket = FakeWebSocket.instances[0]!;
    client.setSubscription(draft);
    socket.open();
    client.setSubscription(plan);
    socket.receive({
      type: "file:updated",
      payload: {
        ...draft,
        file: file("task-001/draft.md", "stale"),
        board: {} as never,
      },
    });
    socket.receive({
      type: "file:updated",
      payload: {
        ...plan,
        file: file("task-001/plan.md", "fresh"),
        board: {} as never,
      },
    });

    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({
      type: "file:updated",
      payload: {
        fileRelativePath: "task-001/plan.md",
      },
    });
  });
});
