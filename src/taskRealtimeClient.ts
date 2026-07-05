import type {
  RealtimeClientMessage,
  RealtimeFileDeletedMessage,
  RealtimeFileSubscription,
  RealtimeFileUpdatedMessage,
  RealtimeServerMessage,
  RealtimeSubscriptionErrorMessage,
} from "../shared/types";

type RealtimeWebSocket = {
  readonly readyState: number;
  send(data: string): unknown;
  close(): unknown;
  addEventListener(type: "open", listener: () => void): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  addEventListener(type: "close" | "error", listener: () => void): void;
};

type RealtimeWebSocketConstructor = {
  readonly OPEN: number;
  new(url: string): RealtimeWebSocket;
};

type TimerId = ReturnType<typeof setTimeout>;

export type TaskRealtimeClientOptions = {
  getUrl: () => string;
  WebSocketCtor: RealtimeWebSocketConstructor;
  setTimer: (callback: () => void, delayMs: number) => TimerId;
  clearTimer: (timer: TimerId) => void;
  onFileUpdated: (message: RealtimeFileUpdatedMessage) => void;
  onFileDeleted: (message: RealtimeFileDeletedMessage) => void;
  onSubscriptionError: (message: RealtimeSubscriptionErrorMessage) => void;
};

const BASE_RECONNECT_DELAY_MS = 250;
const MAX_RECONNECT_DELAY_MS = 5_000;

export class TaskRealtimeClient {
  private socket: RealtimeWebSocket | null = null;
  private reconnectTimer: TimerId | null = null;
  private reconnectAttempt = 0;
  private closing = false;
  private activeSubscription: RealtimeFileSubscription | null = null;
  private sentSubscription: RealtimeFileSubscription | null = null;

  constructor(private readonly options: TaskRealtimeClientOptions) {}

  connect() {
    const socket = new this.options.WebSocketCtor(this.options.getUrl());
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.reconnectAttempt = 0;
      this.sentSubscription = null;
      this.syncSubscription();
    });

    socket.addEventListener("message", (event) => {
      this.handleMessage(event.data);
    });

    socket.addEventListener("close", () => {
      if (this.socket === socket) {
        this.socket = null;
        this.sentSubscription = null;
      }

      if (!this.closing) {
        this.scheduleReconnect();
      }
    });

    socket.addEventListener("error", () => {
      socket.close();
    });
  }

  setSubscription(subscription: RealtimeFileSubscription | null) {
    this.activeSubscription = subscription;
    this.syncSubscription();
  }

  dispose() {
    this.closing = true;
    this.clearReconnectTimer();
    this.unsubscribe(this.sentSubscription);
    this.sentSubscription = null;
    this.socket?.close();
    this.socket = null;
  }

  private scheduleReconnect() {
    this.clearReconnectTimer();
    const delay = Math.min(
      MAX_RECONNECT_DELAY_MS,
      BASE_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempt,
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = this.options.setTimer(() => this.connect(), delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer === null) {
      return;
    }

    this.options.clearTimer(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private syncSubscription() {
    if (!this.socket || this.socket.readyState !== this.options.WebSocketCtor.OPEN) {
      return;
    }

    if (this.sentSubscription && !sameSubscription(this.sentSubscription, this.activeSubscription)) {
      this.send({
        type: "unsubscribe:file",
        payload: this.sentSubscription,
      });
      this.sentSubscription = null;
    }

    if (this.activeSubscription && !sameSubscription(this.sentSubscription, this.activeSubscription)) {
      this.send({
        type: "subscribe:file",
        payload: this.activeSubscription,
      });
      this.sentSubscription = this.activeSubscription;
    }
  }

  private unsubscribe(subscription: RealtimeFileSubscription | null) {
    if (!this.socket || this.socket.readyState !== this.options.WebSocketCtor.OPEN || !subscription) {
      return;
    }

    this.send({
      type: "unsubscribe:file",
      payload: subscription,
    });
  }

  private send(message: RealtimeClientMessage) {
    this.socket?.send(JSON.stringify(message));
  }

  private handleMessage(rawData: unknown) {
    const message = parseServerMessage(rawData);
    if (!message) {
      return;
    }

    if (message.type === "file:updated") {
      if (sameSubscription(message.payload, this.activeSubscription)) {
        this.options.onFileUpdated(message);
      }
      return;
    }

    if (message.type === "file:deleted") {
      if (sameSubscription(message.payload, this.activeSubscription)) {
        this.options.onFileDeleted(message);
      }
      return;
    }

    if (
      message.type === "subscription:error" &&
      errorMatchesActiveSubscription(message, this.activeSubscription)
    ) {
      this.options.onSubscriptionError(message);
    }
  }
}

export function parseServerMessage(rawData: unknown): RealtimeServerMessage | null {
  try {
    const text = typeof rawData === "string" ? rawData : String(rawData);
    const parsed = JSON.parse(text) as Partial<RealtimeServerMessage>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") {
      return null;
    }

    return parsed as RealtimeServerMessage;
  } catch {
    return null;
  }
}

function errorMatchesActiveSubscription(
  message: RealtimeSubscriptionErrorMessage,
  activeSubscription: RealtimeFileSubscription | null,
) {
  if (!activeSubscription) {
    return false;
  }

  const payload = message.payload;
  const scopedFields = [
    payload.projectId,
    payload.cardRelativePath,
    payload.fileRelativePath,
  ].filter(Boolean);

  if (scopedFields.length === 0) {
    return false;
  }

  return (
    (!payload.projectId || payload.projectId === activeSubscription.projectId) &&
    (!payload.cardRelativePath || payload.cardRelativePath === activeSubscription.cardRelativePath) &&
    (!payload.fileRelativePath || payload.fileRelativePath === activeSubscription.fileRelativePath)
  );
}

function sameSubscription(
  left: RealtimeFileSubscription | null | undefined,
  right: RealtimeFileSubscription | null | undefined,
) {
  return (
    left?.projectId === right?.projectId &&
    left?.cardRelativePath === right?.cardRelativePath &&
    left?.fileRelativePath === right?.fileRelativePath
  );
}
