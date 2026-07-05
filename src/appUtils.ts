import type {
  BoardCard,
  BoardList,
  DigestPeriod,
  FileTreeNode,
} from "../shared/types";

export type BoardTotals = {
  lists: number;
  cards: number;
  files: number;
  markdownFiles: number;
};

export type DigestRangePreset = "current-week" | "previous-week" | "custom";

export function getDigestPeriod(preset: DigestRangePreset, customRange: DigestPeriod): DigestPeriod {
  if (preset === "current-week") {
    return getWeekRange(new Date(), 0);
  }

  if (preset === "previous-week") {
    return getWeekRange(new Date(), -1);
  }

  return customRange;
}

export function getWeekRange(date: Date, offsetWeeks: number): DigestPeriod {
  const start = new Date(date);
  const day = start.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - daysSinceMonday + offsetWeeks * 7);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    from: formatDateInputValue(start),
    to: formatDateInputValue(end),
  };
}

export function hasValidDigestPeriod(period: DigestPeriod) {
  return /^\d{4}-\d{2}-\d{2}$/.test(period.from) && /^\d{4}-\d{2}-\d{2}$/.test(period.to);
}

export function getNextFolderName(list: BoardList, lists: BoardList[]) {
  if (list.kind !== "group") {
    return getNextNumberedName("task", lists.flatMap((candidate) => candidate.cards));
  }

  return getNextNumberedName(list.sourceName, list.cards);
}

export function calculateBoardTotals(lists: BoardList[]): BoardTotals {
  return lists.reduce<BoardTotals>(
    (totals, list) => {
      totals.lists += 1;
      totals.cards += list.cards.length;

      for (const card of list.cards) {
        const summary = summarizeCardFiles(card.files);
        totals.files += summary.files;
        totals.markdownFiles += summary.markdownFiles;
      }

      return totals;
    },
    {
      lists: 0,
      cards: 0,
      files: 0,
      markdownFiles: 0,
    },
  );
}

export function summarizeCardFiles(nodes: FileTreeNode[]) {
  return nodes.reduce(
    (totals, node) => {
      if (node.nodeType === "file") {
        totals.files += 1;
        if (node.isMarkdown) {
          totals.markdownFiles += 1;
        }
        return totals;
      }

      totals.directories += 1;
      const nested = summarizeCardFiles(node.children ?? []);
      totals.files += nested.files;
      totals.directories += nested.directories;
      totals.markdownFiles += nested.markdownFiles;
      return totals;
    },
    {
      files: 0,
      directories: 0,
      markdownFiles: 0,
    },
  );
}

export function cardMatchesQuery(card: BoardCard, query: string): boolean {
  const fields = [
    card.title,
    card.sourceName,
    card.relativePath,
    ...card.labelIds,
    ...card.labels.flatMap((label) => [label.id, label.name, label.color]),
  ];

  if (fields.some((value) => value.toLowerCase().includes(query))) {
    return true;
  }

  return fileTreeMatchesQuery(card.files, query);
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextNumberedName(prefix: string, cards: BoardCard[]) {
  let maxNumber = 0;
  const takenNames = new Set(cards.map((card) => card.sourceName));
  const matcher = new RegExp(`^${escapeRegExp(prefix)}-(\\d+)`, "i");

  for (const card of cards) {
    const match = card.sourceName.match(matcher);
    if (match) {
      maxNumber = Math.max(maxNumber, Number(match[1]));
    }
  }

  let nextNumber = maxNumber || cards.length;
  let candidate = "";

  do {
    nextNumber += 1;
    candidate = `${prefix}-${String(nextNumber).padStart(3, "0")}`;
  } while (takenNames.has(candidate));

  return candidate;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fileTreeMatchesQuery(nodes: FileTreeNode[], query: string): boolean {
  return nodes.some((node) => {
    if (node.name.toLowerCase().includes(query) || node.relativePath.toLowerCase().includes(query)) {
      return true;
    }

    if (node.nodeType === "directory") {
      return fileTreeMatchesQuery(node.children ?? [], query);
    }

    return false;
  });
}
