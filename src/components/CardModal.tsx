import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  BoardCard,
  BoardLabel,
  BoardResponse,
  FileContentResponse,
  RealtimeFileDeletedMessage,
  RealtimeFileSubscription,
  RealtimeFileUpdatedMessage,
  RealtimeSubscriptionErrorMessage,
  TaskEstimate,
} from "../../shared/types";
import { summarizeCardFiles } from "../appUtils";
import { applyRealtimeDiskUpdate, reloadFromLatestDisk } from "../realtimeEditState";
import { useTaskRealtime } from "../useTaskRealtime";
import { DateStat } from "./DateText";
import { FileTree } from "./FileTree";
import { LabelChips, LabelMenu } from "./LabelControls";
import { PreviewContent } from "./PreviewContent";

type EstimateActionState = {
  loading: boolean;
  error: string | null;
};

type CardFileState = {
  loading: boolean;
  filePath: string | null;
  payload: FileContentResponse | null;
  error: string | null;
};

export function CardModal({
  activeLabelMenuId,
  availableLabels,
  card,
  fileState,
  projectId,
  estimateActionState,
  labelError,
  labelLoading,
  listTitle,
  estimateLogOpen,
  onClose,
  onEstimate,
  onEstimateLogToggle,
  onFileOpen,
  onFileSave,
  onRealtimeFileDeleted,
  onRealtimeFileError,
  onRealtimeFileUpdated,
  onLabelMenuToggle,
  onLabelsChange,
}: {
  activeLabelMenuId: string | null;
  availableLabels: BoardLabel[];
  card: BoardCard;
  fileState: CardFileState;
  projectId: string;
  estimateActionState: EstimateActionState;
  labelError: string | null;
  labelLoading: boolean;
  listTitle: string;
  estimateLogOpen: boolean;
  onClose: () => void;
  onEstimate: () => void;
  onEstimateLogToggle: (isOpen: boolean) => void;
  onFileOpen: (relativePath: string) => void;
  onFileSave: (relativePath: string, newContent: string) => Promise<void>;
  onRealtimeFileDeleted: (relativePath: string, board: BoardResponse | null) => void;
  onRealtimeFileError: (relativePath: string, message: string) => void;
  onRealtimeFileUpdated: (
    relativePath: string,
    file: FileContentResponse,
    board: BoardResponse,
  ) => void;
  onLabelMenuToggle: (menuId: string) => void;
  onLabelsChange: (labelIds: string[]) => void;
}) {
  const summary = summarizeCardFiles(card.files);
  const labelMenuId = `modal:${card.id}`;

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [latestDiskPayload, setLatestDiskPayload] = useState<FileContentResponse | null>(null);
  const estimateLogRef = useRef<HTMLDivElement>(null);
  const isEditingRef = useRef(isEditing);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const realtimeSubscription = useMemo<RealtimeFileSubscription | null>(() => {
    if (!fileState.filePath) {
      return null;
    }

    return {
      projectId,
      cardRelativePath: card.relativePath,
      fileRelativePath: fileState.filePath,
    };
  }, [card.relativePath, fileState.filePath, projectId]);

  const insertMarkdown = (before: string, after: string, defaultText = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const selectedText = text.substring(start, end) || defaultText;
    const replacement = before + selectedText + after;

    const newContent = text.substring(0, start) + replacement + text.substring(end);
    setEditContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selectedText.length,
      );
    }, 0);
  };

  const insertMarkdownLinePrefix = (prefix: string, defaultText = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end) || defaultText;
    const replacement = selectedText
      .split("\n")
      .map((line) => (line.trim().length > 0 ? `${prefix}${line}` : line))
      .join("\n");

    const newContent = text.substring(0, start) + replacement + text.substring(end);
    setEditContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + replacement.length);
    }, 0);
  };

  useEffect(() => {
    setIsEditing(false);
    setEditContent("");
    setSaveError(null);
    setLatestDiskPayload(null);
  }, [fileState.filePath]);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useTaskRealtime({
    subscription: realtimeSubscription,
    onFileUpdated: (message: RealtimeFileUpdatedMessage) => {
      const { board, file, fileRelativePath } = message.payload;
      onRealtimeFileUpdated(fileRelativePath, file, board);

      if (isEditingRef.current) {
        setLatestDiskPayload((current) =>
          applyRealtimeDiskUpdate({
            editContent,
            isEditing: true,
            latestDiskPayload: current,
          }, file).latestDiskPayload,
        );
        return;
      }

      setLatestDiskPayload(null);
    },
    onFileDeleted: (message: RealtimeFileDeletedMessage) => {
      const { board, fileRelativePath } = message.payload;
      setLatestDiskPayload(null);
      onRealtimeFileDeleted(fileRelativePath, board);
    },
    onSubscriptionError: (message: RealtimeSubscriptionErrorMessage) => {
      const relativePath = message.payload.fileRelativePath ?? fileState.filePath;
      if (!relativePath) {
        return;
      }

      onRealtimeFileError(relativePath, message.payload.message);
    },
  });

  useEffect(() => {
    if (!estimateLogOpen) {
      return;
    }

    const handler = (event: MouseEvent) => {
      if (estimateLogRef.current && !estimateLogRef.current.contains(event.target as Node)) {
        onEstimateLogToggle(false);
      }
    };

    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onEstimateLogToggle(false);
      }
    };

    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);

    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [estimateLogOpen, onEstimateLogToggle]);

  const handleSave = async () => {
    if (!fileState.filePath) return;
    setSaveLoading(true);
    setSaveError(null);
    try {
      await onFileSave(fileState.filePath, editContent);
      setLatestDiskPayload(null);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save file.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleReloadFromDisk = () => {
    if (!latestDiskPayload) {
      return;
    }

    const nextState = reloadFromLatestDisk({
      editContent,
      isEditing,
      latestDiskPayload,
    });
    setEditContent(nextState.editContent);
    setLatestDiskPayload(nextState.latestDiskPayload);
    setActiveTab("edit");
    setSaveError(null);
  };

  return (
    <div
      aria-hidden="true"
      className="modal-backdrop"
      onClick={onClose}
    >
      <section
        aria-label={`${card.title} details`}
        aria-modal="true"
        className="card-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="card-modal__header">
          <div>
            <p className="card-modal__eyebrow">{listTitle}</p>
            <h3>{card.title}</h3>
            <p className="card-modal__path">{card.relativePath}</p>
            <div className="card-modal__label-row">
              <LabelChips labels={card.labels} />
              {card.labels.length === 0 ? <p className="muted">No labels assigned.</p> : null}
              <LabelMenu
                availableLabels={availableLabels}
                error={labelError}
                loading={labelLoading}
                menuId={labelMenuId}
                open={activeLabelMenuId === labelMenuId}
                selectedLabelIds={card.labelIds}
                size="compact"
                onChange={onLabelsChange}
                onToggle={() => onLabelMenuToggle(labelMenuId)}
              />
            </div>
            <div className="card-modal__estimate">
              <div className="card-modal__estimate-actions">
                {card.estimate ? (
                  <div className="card-estimate-popover-wrap" ref={estimateLogRef}>
                    <button
                      className="card-estimate-badge"
                      onClick={() => onEstimateLogToggle(!estimateLogOpen)}
                      type="button"
                    >
                      {card.estimate.storyPoints} pts
                    </button>
                    {estimateLogOpen ? <EstimateLogPopover estimate={card.estimate} /> : null}
                  </div>
                ) : null}

                {card.estimateEligible ? (
                  <button
                    className="card-estimate-action"
                    disabled={estimateActionState.loading}
                    onClick={onEstimate}
                    type="button"
                  >
                    {estimateActionState.loading
                      ? "Estimating..."
                      : card.estimate
                        ? "Regenerate estimate"
                        : "Generate estimate"}
                  </button>
                ) : null}

                {!card.estimateEligible && card.estimateIneligibleReason ? (
                  <p className="muted">Estimate unavailable: {card.estimateIneligibleReason}</p>
                ) : null}
              </div>

              {estimateActionState.error ? <p className="error-box">{estimateActionState.error}</p> : null}
            </div>
          </div>
          <button
            aria-label="Close card details"
            className="modal-close"
            onClick={onClose}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <div className="card-modal__stats">
          {card.createdAt ? (
            <DateStat label="created" value={card.createdAt} />
          ) : null}
          {card.updatedAt ? (
            <DateStat label="updated" value={card.updatedAt} />
          ) : null}
          <div>
            <strong>{summary.files}</strong>
            <span>files</span>
          </div>
          <div>
            <strong>{summary.directories}</strong>
            <span>folders</span>
          </div>
          <div>
            <strong>{summary.markdownFiles}</strong>
            <span>markdown</span>
          </div>
        </div>

        <div className="card-modal__body">
          <aside className="file-tree file-tree--modal">
            <div className="panel-heading">
              <p className="file-tree__label">Files</p>
              <span>{summary.files} entries</span>
            </div>
            <FileTree
              nodes={card.files}
              activePath={fileState.filePath}
              onFileClick={onFileOpen}
            />
          </aside>

          <div className="preview-pane preview-pane--modal" aria-live="polite">
            <div className="panel-heading">
              <p className="file-tree__label">{isEditing ? "Editing File" : "Preview"}</p>
              <span>{fileState.filePath ?? "No file open"}</span>
            </div>

            {fileState.loading ? <p className="muted">Loading preview...</p> : null}

            {!fileState.loading && !fileState.payload && card.defaultOpenFilePath ? (
              <div className="preview-empty">
                <p className="muted">Open the primary markdown artifact for this card.</p>
                <button
                  className="preview-trigger"
                  onClick={() => onFileOpen(card.defaultOpenFilePath!)}
                  type="button"
                >
                  Open primary doc
                </button>
              </div>
            ) : null}

            {!fileState.loading && !fileState.payload && !card.defaultOpenFilePath ? (
              <p className="muted">Select a file to preview.</p>
            ) : null}

            {fileState.error ? <p className="error-box">{fileState.error}</p> : null}

            {fileState.payload && !fileState.loading ? (
              isEditing ? (
                <div className="editor-pane">
                  <div className="editor-pane__header">
                    <div className="editor-pane__tabs">
                      <button
                        className={`editor-tab ${activeTab === "edit" ? "is-active" : ""}`}
                        onClick={() => setActiveTab("edit")}
                        type="button"
                      >
                        Edit
                      </button>
                      {fileState.payload.format === "markdown" ? (
                        <button
                          className={`editor-tab ${activeTab === "preview" ? "is-active" : ""}`}
                          onClick={() => setActiveTab("preview")}
                          type="button"
                        >
                          Live Preview
                        </button>
                      ) : null}
                    </div>
                    <div className="editor-pane__actions">
                      {latestDiskPayload ? (
                        <div className="editor-disk-warning">
                          <span>File changed on disk</span>
                          <button
                            className="editor-btn editor-btn--secondary"
                            onClick={handleReloadFromDisk}
                            type="button"
                          >
                            Reload from disk
                          </button>
                        </div>
                      ) : null}
                      <button
                        className="editor-btn editor-btn--secondary"
                        onClick={() => setIsEditing(false)}
                        disabled={saveLoading}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className="editor-btn editor-btn--primary"
                        onClick={handleSave}
                        disabled={saveLoading || editContent === fileState.payload.content}
                        type="button"
                      >
                        {saveLoading ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>

                  <div className="editor-pane__body">
                    {activeTab === "edit" ? (
                      <>
                        <div className="editor-toolbar">
                          <button
                            className="editor-toolbar-btn"
                            onClick={() => insertMarkdown("**", "**", "жирный текст")}
                            type="button"
                            title="Bold (Жирный)"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
                          </button>
                          <button
                            className="editor-toolbar-btn"
                            onClick={() => insertMarkdown("*", "*", "курсив")}
                            type="button"
                            title="Italic (Курсив)"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
                          </button>
                          <button
                            className="editor-toolbar-btn"
                            onClick={() => insertMarkdown("### ", "", "Заголовок")}
                            type="button"
                            title="Header (Заголовок)"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12h12M6 4v16M18 4v16"/></svg>
                          </button>
                          <button
                            className="editor-toolbar-btn"
                            onClick={() => insertMarkdownLinePrefix("- ", "Элемент списка")}
                            type="button"
                            title="Bullet List (Список)"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                          </button>
                          <button
                            className="editor-toolbar-btn"
                            onClick={() => insertMarkdown("`", "`", "код")}
                            type="button"
                            title="Inline Code (Код)"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                          </button>
                          <button
                            className="editor-toolbar-btn"
                            onClick={() => insertMarkdown("\n```javascript\n", "\n```\n", "console.log('hello');")}
                            type="button"
                            title="Code Block (Блок кода)"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 8l-2 2 2 2M14 8l2 2-2 2M12 15l1-6"/></svg>
                          </button>
                          <button
                            className="editor-toolbar-btn"
                            onClick={() => insertMarkdown("[", "](url)", "ссылка")}
                            type="button"
                            title="Link (Ссылка)"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                          </button>
                          <button
                            className="editor-toolbar-btn"
                            onClick={() => insertMarkdown("> ", "", "Цитата")}
                            type="button"
                            title="Quote (Цитата)"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                          </button>
                        </div>
                        <textarea
                          ref={textareaRef}
                          className="editor-textarea editor-textarea--with-toolbar"
                          value={editContent}
                          onChange={(event) => setEditContent(event.target.value)}
                          disabled={saveLoading}
                          placeholder="Type your content here..."
                          autoFocus
                        />
                      </>
                    ) : (
                      <div className="markdown-body h-full overflow-auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{editContent}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                  {saveError ? <p className="error-box" style={{ marginTop: "8px" }}>{saveError}</p> : null}
                </div>
              ) : (
                <PreviewContent
                  payload={fileState.payload}
                  onEditClick={() => {
                    setEditContent(fileState.payload!.content);
                    setIsEditing(true);
                    setActiveTab("edit");
                    setSaveError(null);
                    setLatestDiskPayload(null);
                  }}
                />
              )
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function EstimateLogPopover({ estimate }: { estimate: TaskEstimate }) {
  return (
    <div className="card-estimate-popover" role="dialog" aria-label="Estimate details">
      <div className="card-estimate-popover__header">
        <p>Estimate details</p>
        <div>
          <strong>{estimate.storyPoints} pts</strong>
          <small>final</small>
        </div>
      </div>

      <div className="card-estimate-popover__metrics">
        <div>
          <strong>{estimate.storyPoints}</strong>
          <small>Median</small>
        </div>
        <div>
          <strong>{estimate.averageStoryPoints}</strong>
          <small>Average</small>
        </div>
      </div>

      <div className="card-estimate-popover__section">
        <p className="card-estimate-popover__title">Decision log</p>
        <p>{estimate.explanation}</p>
      </div>

      <div className="card-estimate-popover__section">
        <p className="card-estimate-popover__title">Participant votes</p>
        <ul className="card-estimate-votes">
          {estimate.votes.map((vote, index) => (
            <li key={`${vote.role}-${index}`}>
              <strong>{vote.role}</strong>
              <span>{vote.storyPoints} pts</span>
              <small>{vote.reason}</small>
            </li>
          ))}
        </ul>
      </div>

      <div className="card-estimate-popover__section card-estimate-popover__section--meta">
        <p className="card-estimate-popover__title">
          Sources ({estimate.sources.length})
        </p>
        <p>{estimate.sources.join(", ")}</p>
      </div>
    </div>
  );
}
