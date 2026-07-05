const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const FRONTMATTER_BLOCK_PATTERN = /^(---\r?\n[\s\S]*?\r?\n---)(?:\r?\n|$)/;

export function stripMarkdownFrontmatter(content: string) {
  return content.replace(FRONTMATTER_PATTERN, "");
}

export function preserveMarkdownFrontmatter(originalContent: string, nextBody: string) {
  const frontmatterMatch = originalContent.match(FRONTMATTER_BLOCK_PATTERN);
  if (!frontmatterMatch) {
    return nextBody;
  }

  return `${frontmatterMatch[1]}\n\n${nextBody}`;
}

export function parseFrontmatterLabelIds(content: string) {
  const frontmatter = parseMarkdownFrontmatter(content);
  if (!frontmatter) {
    return [];
  }

  const labelIds: string[] = [];
  const lines = frontmatter.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const inlineLabels = line.match(/^labels:\s*(.+?)\s*$/);

    if (inlineLabels) {
      labelIds.push(...parseInlineLabels(inlineLabels[1]!));
      continue;
    }

    if (!/^labels:\s*$/.test(line)) {
      continue;
    }

    for (let childIndex = index + 1; childIndex < lines.length; childIndex += 1) {
      const childLine = lines[childIndex]!;
      const listItem = childLine.match(/^\s+-\s*(.+?)\s*$/);

      if (listItem) {
        labelIds.push(cleanLabelId(listItem[1]!));
        continue;
      }

      if (childLine.trim() === "") {
        continue;
      }

      break;
    }
  }

  return unique(labelIds.filter(Boolean));
}

export function updateFrontmatterLabelIds(content: string, labelIds: string[]) {
  const labelsBlock = formatLabelsBlock(labelIds);
  const frontmatterMatch = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)(\r?\n|$)/);

  if (!frontmatterMatch) {
    return `---\n${labelsBlock}---\n\n${content}`;
  }

  const [, open, rawFrontmatter, close, afterClose] = frontmatterMatch;
  const nextFrontmatter = replaceFrontmatterLabels(rawFrontmatter!, labelsBlock);
  const body = content.slice(frontmatterMatch[0].length);
  return `${open}${nextFrontmatter}${close}${afterClose}${body}`;
}

function parseMarkdownFrontmatter(content: string) {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
    return null;
  }

  const match = content.match(FRONTMATTER_PATTERN);
  return match?.[1] ?? null;
}

function replaceFrontmatterLabels(frontmatter: string, labelsBlock: string) {
  const lines = frontmatter.split(/\r?\n/);
  const labelStartIndex = lines.findIndex((line) => /^labels:\s*(?:\[.*\]|\S.*)?$/.test(line));

  if (labelStartIndex === -1) {
    const prefix = frontmatter.trimEnd();
    return prefix ? `${prefix}\n${labelsBlock.trimEnd()}` : labelsBlock.trimEnd();
  }

  let labelEndIndex = labelStartIndex + 1;
  const startLine = lines[labelStartIndex]!;

  if (/^labels:\s*$/.test(startLine)) {
    while (labelEndIndex < lines.length) {
      const line = lines[labelEndIndex]!;

      if (/^\s+-\s+/.test(line) || line.trim() === "") {
        labelEndIndex += 1;
        continue;
      }

      break;
    }
  }

  return [
    ...lines.slice(0, labelStartIndex),
    ...labelsBlock.trimEnd().split("\n"),
    ...lines.slice(labelEndIndex),
  ].join("\n").trimEnd();
}

function formatLabelsBlock(labelIds: string[]) {
  if (labelIds.length === 0) {
    return "labels: []\n";
  }

  return `labels:\n${labelIds.map((labelId) => `  - ${labelId}`).join("\n")}\n`;
}

function parseInlineLabels(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map(cleanLabelId);
  }

  return [cleanLabelId(trimmed)];
}

function cleanLabelId(value: string) {
  return value.trim().replace(/^["']|["']$/g, "");
}

function unique(values: string[]) {
  return [...new Set(values)];
}
