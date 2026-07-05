import { useEffect, useRef } from "react";
import { TaskRealtimeClient } from "./taskRealtimeClient";
import type {
  RealtimeFileDeletedMessage,
  RealtimeFileSubscription,
  RealtimeFileUpdatedMessage,
  RealtimeSubscriptionErrorMessage,
} from "../shared/types";

type TaskRealtimeOptions = {
  subscription: RealtimeFileSubscription | null;
  onFileUpdated: (message: RealtimeFileUpdatedMessage) => void;
  onFileDeleted: (message: RealtimeFileDeletedMessage) => void;
  onSubscriptionError: (message: RealtimeSubscriptionErrorMessage) => void;
};

export function useTaskRealtime({
  subscription,
  onFileUpdated,
  onFileDeleted,
  onSubscriptionError,
}: TaskRealtimeOptions) {
  const callbacksRef = useRef({
    onFileUpdated,
    onFileDeleted,
    onSubscriptionError,
  });
  const clientRef = useRef<TaskRealtimeClient | null>(null);

  useEffect(() => {
    callbacksRef.current = {
      onFileUpdated,
      onFileDeleted,
      onSubscriptionError,
    };
  }, [onFileDeleted, onFileUpdated, onSubscriptionError]);

  useEffect(() => {
    const client = new TaskRealtimeClient({
      getUrl: getRealtimeUrl,
      WebSocketCtor: WebSocket,
      setTimer: window.setTimeout,
      clearTimer: window.clearTimeout,
      onFileUpdated: (message) => callbacksRef.current.onFileUpdated(message),
      onFileDeleted: (message) => callbacksRef.current.onFileDeleted(message),
      onSubscriptionError: (message) => callbacksRef.current.onSubscriptionError(message),
    });

    clientRef.current = client;
    client.connect();

    return () => {
      client.dispose();
      clientRef.current = null;
    };
  }, []);

  useEffect(() => {
    clientRef.current?.setSubscription(subscription);
  }, [subscription]);
}

function getRealtimeUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}
