import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { FileContentResponse } from "../../shared/types";
import { FileDateMeta } from "./DateText";

export function PreviewContent({
  payload,
  onEditClick,
}: {
  payload: FileContentResponse;
  onEditClick?: () => void;
}) {
  return (
    <div className="preview-content">
      <div className="preview-content__header">
        <div className="preview-content__title">
          <strong>{payload.relativePath}</strong>
          <FileDateMeta createdAt={payload.createdAt} updatedAt={payload.updatedAt} />
        </div>
        <div className="preview-content__actions">
          {onEditClick ? (
            <button
              className="preview-edit-btn"
              onClick={onEditClick}
              type="button"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "4px" }}><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              Редактировать
            </button>
          ) : null}
          <span>{payload.format}</span>
        </div>
      </div>
      {payload.format === "markdown" ? (
        <div className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{payload.content}</ReactMarkdown>
        </div>
      ) : (
        <pre>{payload.content}</pre>
      )}
    </div>
  );
}
