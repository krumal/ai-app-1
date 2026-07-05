export type AppConfig = {
  version: 1;
  activeProjectId: string | null;
  projects: ProjectConfig[];
};

export type ProjectConfig = {
  id: string;
  name: string;
  repoPath: string;
  taskDirName: string;
  listOrder: string[];
};

export type ConfigResponse = {
  configPath: string;
  config: AppConfig;
  projects: ProjectSummary[];
};

export type ProjectSummary = ProjectConfig & {
  taskRootPath: string;
  exists: boolean;
};

export type BoardResponse = {
  project: ProjectSummary;
  board: ProjectBoard;
};

export type LabelColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "gray";

export type BoardLabel = {
  id: string;
  name: string;
  color: LabelColor;
};

export type LabelRegistry = {
  version: 1;
  labels: BoardLabel[];
};

export type LabelsResponse = {
  project: ProjectSummary;
  labels: BoardLabel[];
};

export type ProjectBoard = {
  taskRootExists: boolean;
  taskRootPath: string;
  labels: BoardLabel[];
  lists: BoardList[];
};

export type BoardList = {
  id: string;
  title: string;
  sourceName: string;
  kind: "tasks" | "group" | "misc";
  cards: BoardCard[];
};

export type BoardCard = {
  id: string;
  title: string;
  sourceName: string;
  kind: "folder" | "file";
  relativePath: string;
  createdAt: string | null;
  updatedAt: string | null;
  estimate: TaskEstimate | null;
  estimateEligible: boolean;
  estimateIneligibleReason: string | null;
  labelIds: string[];
  labels: BoardLabel[];
  files: FileTreeNode[];
  defaultOpenFilePath: string | null;
};

export type EstimateParticipantRole =
  | "backend engineer"
  | "frontend engineer"
  | "QA engineer"
  | "tech lead"
  | "product-minded implementation reviewer";

export type EstimateVote = {
  role: EstimateParticipantRole;
  storyPoints: number;
  reason: string;
};

export type TaskEstimate = {
  version: 1;
  storyPoints: number;
  averageStoryPoints: number;
  scale: "fibonacci";
  generatedAt: string;
  sources: string[];
  votes: EstimateVote[];
  explanation: string;
};

export type GenerateEstimateRequest = {
  cardRelativePath: string;
};

export type GenerateEstimateResponse = {
  ok: true;
  estimate: TaskEstimate;
  board: BoardResponse;
};

export type DigestPeriod = {
  from: string;
  to: string;
};

export type DigestCardPreview = {
  id: string;
  title: string;
  listId: string;
  listTitle: string;
  relativePath: string;
  updatedAt: string | null;
  labels: BoardLabel[];
  fileCount: number;
  includedFilePaths: string[];
};

export type DigestPreviewRequest = DigestPeriod;

export type DigestPreviewResponse = {
  period: DigestPeriod;
  cards: DigestCardPreview[];
};

export type GenerateDigestRequest = DigestPeriod;

export type GenerateDigestResponse = {
  period: DigestPeriod;
  includedCards: DigestCardPreview[];
  digest: string;
};

export type FileTreeNode = {
  id: string;
  name: string;
  relativePath: string;
  nodeType: "directory" | "file";
  children?: FileTreeNode[];
  isMarkdown?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type FileContentResponse = {
  projectId: string;
  relativePath: string;
  content: string;
  format: "markdown" | "text";
  createdAt: string;
  updatedAt: string;
};

export type RealtimeFileSubscription = {
  projectId: string;
  cardRelativePath: string;
  fileRelativePath: string;
};

export type RealtimeClientMessage =
  | {
      type: "subscribe:file";
      payload: RealtimeFileSubscription;
    }
  | {
      type: "unsubscribe:file";
      payload: RealtimeFileSubscription;
    };

export type RealtimeConnectionReadyMessage = {
  type: "connection:ready";
};

export type RealtimeFileUpdatedMessage = {
  type: "file:updated";
  payload: RealtimeFileSubscription & {
    file: FileContentResponse;
    board: BoardResponse;
  };
};

export type RealtimeFileDeletedMessage = {
  type: "file:deleted";
  payload: RealtimeFileSubscription & {
    board: BoardResponse | null;
  };
};

export type RealtimeSubscriptionErrorMessage = {
  type: "subscription:error";
  payload: Partial<RealtimeFileSubscription> & {
    code:
      | "invalid_message"
      | "invalid_project"
      | "invalid_path"
      | "unsupported_file"
      | "read_failed";
    message: string;
  };
};

export type RealtimeServerMessage =
  | RealtimeConnectionReadyMessage
  | RealtimeFileUpdatedMessage
  | RealtimeFileDeletedMessage
  | RealtimeSubscriptionErrorMessage;

export type CreateProjectInput = {
  name: string;
  repoPath: string;
};

export type CreateLabelInput = {
  name: string;
  color: LabelColor;
};

export type SetCardLabelsInput = {
  cardRelativePath: string;
  labelIds: string[];
};

export type CreateTaskFileInput = {
  name: string;
  content: string;
};

export type CreateTaskInput = {
  listId: string;
  folderName: string;
  files: CreateTaskFileInput[];
};
