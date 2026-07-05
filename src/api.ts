import type {
  BoardResponse,
  ConfigResponse,
  CreateLabelInput,
  CreateProjectInput,
  CreateTaskInput,
  DigestPreviewRequest,
  DigestPreviewResponse,
  FileContentResponse,
  GenerateDigestRequest,
  GenerateDigestResponse,
  GenerateEstimateRequest,
  GenerateEstimateResponse,
  LabelsResponse,
  SetCardLabelsInput,
} from "../shared/types";

async function readJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `Request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

export function fetchConfig() {
  return readJson<ConfigResponse>("/api/config");
}

export function createProject(payload: CreateProjectInput) {
  return readJson<ConfigResponse>("/api/projects", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function selectProject(projectId: string) {
  return readJson<ConfigResponse>(`/api/projects/${projectId}/select`, {
    method: "PATCH",
  });
}

export function deleteProject(projectId: string) {
  return readJson<ConfigResponse>(`/api/projects/${projectId}`, {
    method: "DELETE",
  });
}

export async function pickProject() {
  const response = await fetch("/api/projects/pick", {
    method: "POST",
  });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `Request failed with status ${response.status}.`);
  }

  return (await response.json()) as ConfigResponse;
}

export function fetchBoard(projectId: string) {
  return readJson<BoardResponse>(`/api/projects/${projectId}/board`);
}

export function createLabel(projectId: string, payload: CreateLabelInput) {
  return readJson<LabelsResponse>(`/api/projects/${projectId}/labels`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function setCardLabels(projectId: string, payload: SetCardLabelsInput) {
  return readJson<BoardResponse>(`/api/projects/${projectId}/card-labels`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function createTask(projectId: string, payload: CreateTaskInput) {
  return readJson<BoardResponse>(`/api/projects/${projectId}/tasks`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function previewDigest(projectId: string, payload: DigestPreviewRequest) {
  return readJson<DigestPreviewResponse>(`/api/projects/${projectId}/digest/preview`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function generateDigest(projectId: string, payload: GenerateDigestRequest) {
  return readJson<GenerateDigestResponse>(`/api/projects/${projectId}/digest`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function generateEstimate(projectId: string, payload: GenerateEstimateRequest) {
  return readJson<GenerateEstimateResponse>(`/api/projects/${projectId}/estimate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function fetchFile(projectId: string, relativePath: string) {
  const params = new URLSearchParams({ path: relativePath });
  return readJson<FileContentResponse>(`/api/projects/${projectId}/file?${params.toString()}`);
}

export function updateFile(projectId: string, relativePath: string, content: string) {
  return readJson<{ ok: boolean; file: FileContentResponse; board: BoardResponse }>(`/api/projects/${projectId}/file`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ relativePath, content }),
  });
}
