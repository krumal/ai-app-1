import { useEffect, useMemo, useRef } from "react";
import type { BoardLabel, LabelColor } from "../../shared/types";

export const LABEL_COLORS: LabelColor[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "gray",
];

export function LabelChips({ labels, limit }: { labels: BoardLabel[]; limit?: number }) {
  if (labels.length === 0) {
    return null;
  }

  const visibleLabels = typeof limit === "number" ? labels.slice(0, limit) : labels;
  const hiddenCount = Math.max(0, labels.length - visibleLabels.length);

  return (
    <div className="label-chips">
      {visibleLabels.map((label) => (
        <LabelChip key={label.id} label={label} />
      ))}
      {hiddenCount > 0 ? <span className="label-chip label-chip--more">+{hiddenCount}</span> : null}
    </div>
  );
}

export function LabelChip({ label }: { label: BoardLabel }) {
  return (
    <span className="label-chip" data-color={label.color} title={label.id}>
      <span className="label-chip__dot" />
      <span>{label.name}</span>
    </span>
  );
}

export function LabelMenu({
  availableLabels,
  error,
  loading,
  menuId,
  onChange,
  onToggle,
  open,
  selectedLabelIds,
  size,
}: {
  availableLabels: BoardLabel[];
  error: string | null;
  loading: boolean;
  menuId: string;
  onChange: (labelIds: string[]) => void;
  onToggle: () => void;
  open: boolean;
  selectedLabelIds: string[];
  size: "compact" | "full";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const selectedLabelIdSet = useMemo(() => new Set(selectedLabelIds), [selectedLabelIds]);

  useEffect(() => {
    if (!open) return;

    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onToggle();
      }
    };
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onToggle();
    };

    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open, onToggle]);

  function toggleLabel(labelId: string) {
    const nextLabelIds = selectedLabelIdSet.has(labelId)
      ? selectedLabelIds.filter((selectedLabelId) => selectedLabelId !== labelId)
      : [...selectedLabelIds, labelId];

    onChange(nextLabelIds);
  }

  return (
    <div className={`label-menu label-menu--${size}`} ref={ref}>
      <button
        aria-expanded={open}
        className="label-menu__trigger"
        disabled={loading}
        onClick={onToggle}
        title="Assign labels"
        type="button"
      >
        {size === "compact" ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 12 22l-10-10V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><path d="M7 7h.01"/></svg>
        ) : (
          <span>{loading ? "Saving..." : "Edit labels"}</span>
        )}
      </button>

      {open ? (
        <div className="label-menu__panel" id={menuId}>
          {availableLabels.length > 0 ? (
            <div className="label-menu__options">
              {availableLabels.map((label) => {
                const selected = selectedLabelIdSet.has(label.id);

                return (
                  <button
                    aria-pressed={selected}
                    className={`label-menu__option ${selected ? "is-selected" : ""}`}
                    disabled={loading}
                    key={label.id}
                    onClick={() => toggleLabel(label.id)}
                    type="button"
                  >
                    <LabelChip label={label} />
                    <span className="label-menu__check">
                      {selected ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m20 6-11 11-5-5"/></svg>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="label-menu__empty">Create a board label first.</p>
          )}

          {error ? <p className="label-menu__error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
