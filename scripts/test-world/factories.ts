import path from "node:path";

export type GeneratedFile = {
  relativePath: string;
  content: string;
};

export type GeneratedWorld = {
  name: string;
  repoPath: string;
  taskDirName: ".tasks";
  listOrder: string[];
  directories: string[];
  files: GeneratedFile[];
};

export type TaskContentOptions = {
  title: string;
  kind: string;
  owner: string;
  status: string;
  complexity: string;
  tags: string[];
  sections: string[];
  includeTable?: boolean;
  includeCode?: boolean;
};

export function createWorld(input: {
  name: string;
  repoPath: string;
  listOrder: string[];
  directories?: string[];
  files: GeneratedFile[];
}): GeneratedWorld {
  return {
    name: input.name,
    repoPath: input.repoPath,
    taskDirName: ".tasks",
    listOrder: input.listOrder,
    directories: input.directories ?? [],
    files: input.files,
  };
}

export function taskFolder(taskNumber: number, slug: string) {
  return `task-${String(taskNumber).padStart(3, "0")}-${slug}`;
}

export function markdown(relativePath: string, content: string): GeneratedFile {
  return {
    relativePath: normalizeRelativePath(relativePath),
    content: content.trimEnd() + "\n",
  };
}

export function text(relativePath: string, content: string): GeneratedFile {
  return {
    relativePath: normalizeRelativePath(relativePath),
    content,
  };
}

export function createTaskFiles(folder: string, options: TaskContentOptions): GeneratedFile[] {
  return [
    markdown(path.join(folder, "draft.md"), renderDraft(options)),
    markdown(path.join(folder, "plan.md"), renderPlan(options)),
    markdown(path.join(folder, "implementation_progress.md"), renderProgress(options)),
  ];
}

export function createSparseTaskFiles(
  folder: string,
  options: TaskContentOptions,
): GeneratedFile[] {
  return [
    markdown(path.join(folder, "draft.md"), renderDraft(options)),
    text(path.join(folder, "notes.txt"), `Unstructured notes for ${options.title}\n`),
  ];
}

export function createResearchFolderFiles(
  folder: string,
  options: TaskContentOptions,
): GeneratedFile[] {
  return [
    markdown(path.join(folder, "prompt.md"), renderPrompt(options)),
    markdown(path.join(folder, "result.md"), renderResult(options)),
    markdown(path.join(folder, "nested", "evidence.md"), renderEvidence(options)),
  ];
}

function renderDraft(options: TaskContentOptions) {
  return `# ${options.title}

## Context

${options.sections[0]}

## Goals

- Clarify the expected behavior.
- Keep the implementation scoped to the current repository.
- Leave enough verification notes for the next agent.

## Metadata

- Kind: ${options.kind}
- Owner: ${options.owner}
- Status: ${options.status}
- Complexity: ${options.complexity}
- Tags: ${options.tags.join(", ")}
`;
}

function renderPlan(options: TaskContentOptions) {
  const table = options.includeTable
    ? `
| Area | Change | Verification |
| --- | --- | --- |
| Frontend | Update visible workflow | Browser smoke pass |
| Backend | Keep file access scoped | API request check |
| Docs | Record command usage | README read-through |
`
    : "";

  const code = options.includeCode
    ? `
\`\`\`ts
type VerificationStep = {
  command: string;
  expected: string;
};
\`\`\`
`
    : "";

  return `# Plan: ${options.title}

## Milestones

1. Inspect the existing behavior and contracts.
2. Implement the smallest useful change.
3. Verify with typecheck, build, and a browser pass.

## Notes

${options.sections[1]}
${table}${code}
## Done Definition

- [ ] Implementation is complete.
- [ ] Edge cases are covered.
- [ ] Verification evidence is captured.
`;
}

function renderProgress(options: TaskContentOptions) {
  return `# Implementation Progress

## Current Status

${options.sections[2]}

## Log

- Created initial draft.
- Split work into focused milestones.
- Marked open questions for follow-up.

## Remaining

- [ ] Final code review
- [ ] Regression pass
`;
}

function renderPrompt(options: TaskContentOptions) {
  return `# Research Prompt

Investigate ${options.title.toLowerCase()} and return concise implementation evidence.

## Constraints

- Prefer source code over assumptions.
- Keep claims tied to exact files or commands.
- Separate confirmed behavior from inference.
`;
}

function renderResult(options: TaskContentOptions) {
  return `# Research Result

## Summary

${options.sections.join("\n\n")}

## Recommendation

Proceed with a narrow implementation and keep the board readable in compact columns.
`;
}

function renderEvidence(options: TaskContentOptions) {
  return `# Evidence

- Owner: ${options.owner}
- Status: ${options.status}
- Tags: ${options.tags.join(", ")}
`;
}

function normalizeRelativePath(relativePath: string) {
  return relativePath.split(path.sep).join("/");
}
