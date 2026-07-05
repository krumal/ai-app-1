import type { FileTreeNode } from "../../shared/types";
import { DateText } from "./DateText";

export function FileTree({
  activePath,
  nodes,
  onFileClick,
}: {
  activePath: string | null;
  nodes: FileTreeNode[];
  onFileClick: (relativePath: string) => void;
}) {
  return (
    <div className="file-tree__nodes">
      {nodes.map((node) => (
        <FileTreeNodeView
          key={node.id}
          activePath={activePath}
          node={node}
          onFileClick={onFileClick}
        />
      ))}
    </div>
  );
}

function FileTreeNodeView({
  activePath,
  node,
  onFileClick,
}: {
  activePath: string | null;
  node: FileTreeNode;
  onFileClick: (relativePath: string) => void;
}) {
  if (node.nodeType === "directory") {
    return (
      <details className="file-node file-node--directory" open>
        <summary>
          <span>{node.name}</span>
          <small>{node.children?.length ?? 0}</small>
        </summary>
        <div className="file-node__children">
          {node.children?.map((child) => (
            <FileTreeNodeView
              key={child.id}
              activePath={activePath}
              node={child}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      </details>
    );
  }

  return (
    <button
      aria-pressed={activePath === node.relativePath}
      className={`file-node file-node--file ${activePath === node.relativePath ? "is-active" : ""}`}
      onClick={() => onFileClick(node.relativePath)}
      type="button"
    >
      <span>{node.name}</span>
      <span className="file-node__meta">
        {node.updatedAt ? <DateText value={node.updatedAt} /> : null}
        {node.isMarkdown ? <small>md</small> : <small>file</small>}
      </span>
    </button>
  );
}
