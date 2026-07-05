# Plan: AI digest

## Goal

Add an AI digest workflow that lets the user generate a markdown summary for tasks updated during a selected period.

The digest is generated on demand through OpenAI Chat Completions and is shown in the UI modal only. The result is not saved back into `.tasks`.

## Product Flow

1. User clicks the `AI digest` button in the top-right app toolbar.
2. App opens an `AI digest` modal.
3. Modal defaults to `Current week` and shows the date range.
4. User can switch between:
   - `Current week`;
   - `Previous week`;
   - `Custom range`.
5. Modal previews the cards that will be included in the digest.
6. The matching cards are highlighted on the board while the modal is open.
7. User clicks `Generate digest`.
8. Backend gathers the selected card files and calls OpenAI Chat Completions.
9. Modal displays the returned markdown digest.
10. User can copy the digest text.

## API Design

### Preview digest candidates

`POST /api/projects/:id/digest/preview`

Request:

```ts
type DigestPreviewRequest = {
  from: string;
  to: string;
};
```

Response:

```ts
type DigestPreviewResponse = {
  period: DigestPeriod;
  cards: DigestCardPreview[];
};
```

### Generate digest

`POST /api/projects/:id/digest`

Request:

```ts
type GenerateDigestRequest = {
  from: string;
  to: string;
};
```

Response:

```ts
type GenerateDigestResponse = {
  period: DigestPeriod;
  includedCards: DigestCardPreview[];
  digest: string;
};
```

## Shared Types

Add these types to `shared/types.ts`:

```ts
type DigestPeriod = {
  from: string;
  to: string;
};

type DigestCardPreview = {
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
```

## Backend Plan

1. Add `openai` dependency.
2. Add `server/ai/openai.ts`.
3. Read configuration from environment:
   - `OPENAI_API_KEY`;
   - `OPENAI_API_BASE_URL`, used as the OpenAI SDK `baseURL`.
4. Hardcode the digest model as `gpt-oss-120b`.
5. Add `server/digest.ts` with pure helpers:
   - normalize and validate date ranges;
   - build the board for the project;
   - select cards whose `updatedAt` is inside the inclusive range;
   - collect digest file paths for each selected card;
   - read selected files from the project task root;
   - build Chat Completions messages;
   - call OpenAI and return markdown text.
6. Wire routes in `server/index.ts`.
7. Keep all file access scoped through existing project/task-root safety helpers or equivalent path checks.

Date ranges are interpreted in the local runtime timezone. Week presets use local week boundaries, and selected ranges are inclusive from the start of the first day through the end of the last day.

Cards are selected by `card.updatedAt`. For `task-*` cards this may include a card whose `draft.md` changed during the period, even though `draft.md` is not sent to the model.

## File Selection Rules

For cards in the `Tasks` list backed by `task-*` directories:

- include `plan.md`;
- include `implementation_progress.md`;
- exclude `draft.md`;
- ignore missing optional files instead of failing the whole digest.

For all other cards and lists:

- include all readable markdown and text files from the card tree;
- keep file order stable and deterministic;
- skip binary or unsupported files.

## Prompt Contract

Use Chat Completions via `client.chat.completions.create(...)`.

The OpenAI SDK should be configured with:

```ts
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE_URL,
});
```

The model is hardcoded in code:

```ts
const DIGEST_MODEL = "gpt-oss-120b";
```

System message:

```text
You generate concise project work digests from local task tracker files.
Write in Russian.
Use only the provided files and task metadata.
Do not invent facts.
For each task, summarize what was worked on, progress, problems or risks, current stopping point, and likely next step.
Return markdown.
```

User message should include:

- selected period;
- task list with title, list, labels, updated date;
- included files grouped by task;
- explicit output format request.

Send selected file contents as-is. Do not truncate or annotate oversized file content in v1.

Expected markdown shape:

```md
# AI digest: <period>

## Summary

## Tasks

## Problems and risks

## Where we stopped

## Next steps
```

## Frontend Plan

1. Add API client methods in `src/api.ts`:
   - `previewDigest`;
   - `generateDigest`.
2. Add digest modal state in `src/App.tsx`:
   - open/closed;
   - selected range preset;
   - custom range values;
   - preview loading/error;
   - generation loading/error;
   - digest markdown result.
3. Add top-right toolbar button.
4. Render modal:
   - period controls;
   - included cards preview;
   - generate button;
   - markdown digest preview;
   - copy button.
5. Highlight board cards whose ids are included in the current digest preview while the modal is open.
6. Disable generation when no cards are selected or preview failed.

Do not add manual card exclusion in v1. The selected date range fully determines the included task set.

## UX States

- No active project: hide or disable `AI digest`.
- Missing `.tasks`: modal shows no candidates.
- Empty period: show `No tasks updated in this period`.
- Missing API key: show a clear backend error message.
- OpenAI request failure: keep the modal open and preserve preview selection.
- Slow generation: show loading state on the generate button and result area.

## Validation

- `bun run check`
- `bun run build`
- Browser smoke pass:
  - open smoke-check world;
  - generate current-week preview and confirm two tasks are included;
  - generate previous-week preview and confirm three tasks are included;
  - confirm `draft.md` is excluded for `task-*` cards;
  - confirm modal result renders as markdown;
  - confirm board highlight appears only while modal is open.
