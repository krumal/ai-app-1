import type { FileContentResponse } from "../shared/types";

export type RealtimeEditState = {
  editContent: string;
  isEditing: boolean;
  latestDiskPayload: FileContentResponse | null;
};

export function applyRealtimeDiskUpdate(
  state: RealtimeEditState,
  file: FileContentResponse,
): RealtimeEditState {
  if (state.isEditing) {
    return {
      ...state,
      latestDiskPayload: file,
    };
  }

  return {
    ...state,
    latestDiskPayload: null,
  };
}

export function reloadFromLatestDisk(state: RealtimeEditState): RealtimeEditState {
  if (!state.latestDiskPayload) {
    return state;
  }

  return {
    ...state,
    editContent: state.latestDiskPayload.content,
    latestDiskPayload: null,
  };
}
