import { describe, expect, test } from "bun:test";
import { applyRealtimeDiskUpdate, reloadFromLatestDisk } from "../src/realtimeEditState";
import type { FileContentResponse } from "../shared/types";

function file(content: string): FileContentResponse {
  return {
    projectId: "project-1",
    relativePath: "task-001/draft.md",
    content,
    format: "markdown",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:01.000Z",
  };
}

describe("realtime edit state", () => {
  test("stores disk updates without overwriting unsaved editor text", () => {
    const diskFile = file("new disk content");
    const nextState = applyRealtimeDiskUpdate(
      {
        editContent: "unsaved editor text",
        isEditing: true,
        latestDiskPayload: null,
      },
      diskFile,
    );

    expect(nextState.editContent).toBe("unsaved editor text");
    expect(nextState.latestDiskPayload).toBe(diskFile);
  });

  test("reloads editor content from the latest disk payload", () => {
    const nextState = reloadFromLatestDisk({
      editContent: "unsaved editor text",
      isEditing: true,
      latestDiskPayload: file("new disk content"),
    });

    expect(nextState.editContent).toBe("new disk content");
    expect(nextState.latestDiskPayload).toBeNull();
  });
});
