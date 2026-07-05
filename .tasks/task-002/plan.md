# AI Scrum Poker estimate implementation plan

## Project context

LocalTasks is a local task tracker for repository-based work. It reads a selected repository's `.tasks` directory, builds a kanban board, opens task cards, renders task files, edits task files, manages labels, and generates AI digests.

Current relevant model:

- Root `task-*` directories inside `.tasks` are shown in the `Tasks` list.
- Other root directories become separate board lists.
- Root files become `Misc`.
- Cards contain a file tree.
- Card timestamps are derived from files in the card tree.
- AI digest currently selects cards by `card.updatedAt`.
- AI digest reads selected card files and sends them to an OpenAI-compatible Chat Completions provider.
- Existing OpenAI client setup lives in `server/ai/openai.ts`.

This task adds a simple AI-assisted Scrum Poker estimate for eligible task cards.

## Goal

When the user opens an eligible task card, they can request an AI estimate. The backend runs five role-based AI participant requests, combines valid votes deterministically, saves the result as task-local structured data, refreshes the board, and the UI shows a compact story-points badge without page reload.

The feature should stay simple. Do not build a complex scoring framework, rubric UI, estimate history, or a final AI facilitator step.

## Non-goals

- Do not test AI output quality or exact generated wording.
- Do not preserve previous estimate attempts.
- Do not create a separate global database or config store for estimates.
- Do not include estimate data in AI digest.
- Do not support estimation for incidents, reports, misc files, grouped task folders, or nested `task-*` directories.
- Do not add backwards compatibility aliases or fallback estimate formats.

## Product decisions

- Estimation is available only for root-level `task-*` cards in the `Tasks` list.
- Required files are root-level `draft.md` and root-level `plan.md`.
- Root-level `implementation_progress.md` is optional and included only when it exists.
- AI participants are:
  - `backend engineer`;
  - `frontend engineer`;
  - `QA engineer`;
  - `tech lead`;
  - `product-minded implementation reviewer`.
- Each participant returns only a story point value and a short reason.
- Allowed story point scale is `0, 1, 2, 3, 5, 8, 13, 21`.
- Final `storyPoints` is the median of valid participant votes.
- `averageStoryPoints` is calculated from valid participant votes and stored rounded to one decimal place.
- At least 3 valid participant votes are required to save an estimate.
- Fewer than 3 valid participant votes means generation fails and no estimate is saved or overwritten.
- Regeneration uses the same endpoint and replaces the current `estimate.json`.

## Implementation milestones

### Milestone 1. Contracts and deterministic estimate core

Goal: define the shared contract and implement the pure backend logic that does not depend on the board UI or live AI calls.

Deliverables:

- add estimate-related shared types in `shared/types.ts`;
- add `server/estimate.ts`;
- define participant roles and allowed story point scale;
- implement vote validation;
- implement all-settled result normalization;
- implement median and average calculation;
- implement deterministic explanation construction;
- implement `estimate.json` read/write helpers with safe path handling.

Verification:

- unit tests cover valid and invalid votes;
- unit tests cover 3, 4, and 5 valid votes;
- unit tests cover fewer than 3 valid votes;
- unit tests cover upper-middle median behavior for 4 valid votes;
- unit tests cover average rounding to one decimal place.

This milestone should not require frontend work.

### Milestone 2. Board integration and system-file safety

Goal: make the board understand estimates without treating `estimate.json` as a normal task file.

Deliverables:

- extend `BoardCard` with `estimate`, `estimateEligible`, and `estimateIneligibleReason`;
- implement reusable eligibility detection for root `Tasks` list `task-*` folders with root `draft.md` and `plan.md`;
- parse existing `estimate.json` into `card.estimate`;
- hide `estimate.json` from file tree construction;
- exclude `estimate.json` from visible file stats and default-open behavior;
- exclude `estimate.json` from `createdAt` and `updatedAt` calculations;
- reject normal file read/write requests for `task-*/estimate.json`.

Verification:

- board tests prove eligible and ineligible states;
- board tests prove existing estimates appear as `card.estimate`;
- board tests prove `estimate.json` is hidden from the file tree;
- board tests prove `estimate.json` does not change card timestamps;
- file endpoint tests prove direct reads/writes of `estimate.json` fail.

This milestone creates the safest foundation for the rest of the feature.

### Milestone 3. Digest exclusion

Goal: ensure estimate generation can never pollute AI digest selection or prompt context.

Deliverables:

- make digest selection rely on card timestamps that ignore `estimate.json`;
- explicitly exclude `estimate.json` from digest file path collection;
- add regression coverage for tasks where only `estimate.json` is fresh.

Verification:

- digest preview does not include a task only because `estimate.json` changed;
- digest still includes the task when regular task content changed;
- digest included file paths never include `estimate.json`;
- digest prompt context never contains `estimate.json` content.

This milestone protects the existing AI digest behavior before adding the new generation endpoint.

### Milestone 4. Estimate generation API

Goal: expose backend generation/regeneration with mocked AI support in tests and fresh board response for the UI.

Deliverables:

- add `POST /api/projects/:id/estimate`;
- request body is `{ "cardRelativePath": "task-002" }`;
- validate project and card eligibility;
- read `draft.md`, `plan.md`, and optional `implementation_progress.md`;
- run five participant requests through the OpenAI-compatible client;
- use `Promise.allSettled`;
- save `estimate.json` only when at least 3 valid votes exist;
- preserve existing estimate on failed regeneration;
- rebuild and return fresh board data after successful save.

Verification:

- API tests use mocked AI responses;
- 5 valid votes succeeds;
- 3 valid votes plus 2 failures succeeds;
- 2 valid votes fails;
- invalid story point values are rejected;
- failed regeneration does not overwrite the previous estimate;
- successful response contains the saved estimate and fresh board data.

After this milestone, backend behavior should be complete.

### Milestone 5. Task modal UI

Goal: make the feature usable from the opened task modal.

Deliverables:

- add typed API client method;
- render `Estimate` action for eligible tasks without an estimate;
- render compact badge such as `5 pts` for tasks with an estimate;
- add loading and error states;
- add decision log popover;
- show final estimate, median/average values, participant votes, and explanation;
- add regenerate action;
- apply returned fresh board data and update the open card so the badge appears without reload.

Verification:

- eligible task can generate an estimate;
- ineligible cards do not show the primary estimate action;
- badge appears immediately after success;
- popover opens from the badge;
- regenerate updates the displayed estimate;
- errors are visible and do not leave stale success state.

### Milestone 6. Final verification, docs, and cleanup

Goal: close the task with full checks and memory-bank updates.

Deliverables:

- run TypeScript checks;
- run relevant tests;
- dogfood the workflow in a local test world if practical;
- update `.memory-bank/architecture/c4.md`;
- update `.memory-bank/product/user-stories.md`;
- update `.memory-bank/index.md` if needed;
- remove accidental debug code or temporary fixtures.

Verification:

- `bun run check` passes;
- relevant automated tests pass;
- memory bank reflects AI Scrum Poker estimates, `estimate.json`, board estimate metadata, and digest exclusion;
- no unrelated files are changed.

## Data model

Store the estimate in the task directory:

```text
<repo>/.tasks/task-*/estimate.json
```

`estimate.json` is system-managed data, not a user-authored task content file.

Add shared TypeScript types in `shared/types.ts`:

```ts
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
```

Extend `BoardCard`:

```ts
estimate: TaskEstimate | null;
estimateEligible: boolean;
estimateIneligibleReason: string | null;
```

Recommended saved JSON shape:

```json
{
  "version": 1,
  "storyPoints": 5,
  "averageStoryPoints": 5.2,
  "scale": "fibonacci",
  "generatedAt": "2026-06-04T15:00:00.000Z",
  "sources": ["draft.md", "plan.md", "implementation_progress.md"],
  "votes": [
    {
      "role": "backend engineer",
      "storyPoints": 5,
      "reason": "Backend work needs a new endpoint and persistence, but the scope is contained."
    },
    {
      "role": "frontend engineer",
      "storyPoints": 3,
      "reason": "UI work is limited to one action, one badge, and one popover."
    },
    {
      "role": "QA engineer",
      "storyPoints": 5,
      "reason": "The feature needs eligibility, persistence, digest safety, and regeneration checks."
    },
    {
      "role": "tech lead",
      "storyPoints": 8,
      "reason": "The main complexity is keeping the AI flow deterministic and failure-tolerant."
    },
    {
      "role": "product-minded implementation reviewer",
      "storyPoints": 3,
      "reason": "The user-facing scope is small and the decision log is intentionally compact."
    }
  ],
  "explanation": "The final estimate is 5 points because the median vote is 5. The average vote is 5.2."
}
```

## Eligibility

Implement one backend eligibility helper and reuse it for board metadata and estimate generation.

A card is eligible only when all conditions are true:

- the card is in the `Tasks` list: `list.id === "tasks"`;
- the card is a folder: `card.kind === "folder"`;
- the root card directory name matches `task-*`;
- `draft.md` exists directly under the card root;
- `plan.md` exists directly under the card root.

`implementation_progress.md` does not affect eligibility.

Nested `task-*` folders are not eligible. For this version, eligibility is intentionally limited to root cards that the board already places in the `Tasks` list.

Use clear ineligible reasons for UI/debuggability, for example:

- `Only Tasks list cards can be estimated.`
- `Only task folders can be estimated.`
- `Task estimate requires draft.md.`
- `Task estimate requires plan.md.`

## System file behavior

Treat `estimate.json` as a system-managed file.

It must be excluded from:

- card file tree;
- visible file statistics;
- default file opening;
- task search by file name or file metadata;
- general file editor read/write flows;
- card `createdAt` and `updatedAt` calculations;
- AI digest card selection;
- AI digest prompt context.

The board should expose parsed estimate metadata through `card.estimate`, but `estimate.json` itself must not appear as a regular file.

This is critical: creating or regenerating `estimate.json` must not make the task look recently updated. Digest selection should reflect user-authored task content changes, not system-generated estimate changes.

## Backend implementation

### Shared constants

Add a shared backend constant/helper for system task files:

```ts
const ESTIMATE_FILE_NAME = "estimate.json";
```

Use the helper anywhere file tree, timestamps, file read/write, digest file collection, or search logic needs to distinguish regular task files from system-managed files.

### Estimate module

Add `server/estimate.ts` for estimate-specific logic:

- role list;
- allowed story point scale;
- eligibility helpers;
- reading eligible task context;
- reading existing `estimate.json`;
- validating saved estimate shape;
- participant AI calls;
- participant result validation;
- median/average calculation;
- explanation construction;
- safe write of `estimate.json`.

Use safe path resolution inside the project task root. The endpoint must not be able to read or write outside `<repo>/.tasks`.

### AI flow

Use the existing OpenAI-compatible Chat Completions client from `server/ai/openai.ts`. Use the same model configuration approach as AI digest unless the OpenAI module already exposes a better shared model constant.

For each participant:

- send the same task context;
- send a participant-specific role;
- require JSON output;
- ask for only `storyPoints` and `reason`;
- set low temperature, similar to digest, to keep output stable.

Participant response contract:

```json
{
  "storyPoints": 5,
  "reason": "Short reason for this role's estimate."
}
```

The backend should attach the known role itself instead of trusting the model to echo it correctly.

Use `Promise.allSettled` for the five participant requests. A failed participant, malformed JSON, empty reason, or story point outside the allowed scale counts as an invalid vote but does not cancel the whole run.

Generation succeeds only when at least 3 valid votes remain.

Median rules:

- sort valid story point numbers ascending;
- with 3 or 5 valid votes, take the middle value;
- with 4 valid votes, choose the upper middle value so the final estimate is still an allowed scale value.

Average rules:

- calculate arithmetic average from valid story point numbers;
- store rounded to one decimal place.

Explanation:

- build deterministically from median and average;
- include a short note if votes are spread out;
- do not call AI again for a facilitator summary.

Example:

```text
The final estimate is 5 points because the median vote is 5. The average vote is 5.2. Participant reasons point to contained UI work, backend AI orchestration, task-local persistence, and regeneration handling.
```

### API endpoint

Add a concrete endpoint:

```text
POST /api/projects/:id/estimate
```

Request body:

```json
{
  "cardRelativePath": "task-002"
}
```

`cardRelativePath` must be the board card `relativePath`, relative to the task root. For eligible root task cards it is normally the task directory name, such as `task-002`.

Behavior:

1. Load project config.
2. Validate project exists.
3. Build or inspect board enough to validate that the target card is an eligible root `Tasks` card.
4. Read `draft.md`, `plan.md`, and optional `implementation_progress.md`.
5. Run the AI participant flow.
6. Save `estimate.json`.
7. Rebuild board.
8. Return estimate and fresh board data.

Response:

```json
{
  "ok": true,
  "estimate": {
    "version": 1,
    "storyPoints": 5,
    "averageStoryPoints": 5.2,
    "scale": "fibonacci",
    "generatedAt": "2026-06-04T15:00:00.000Z",
    "sources": ["draft.md", "plan.md"],
    "votes": [
      {
        "role": "backend engineer",
        "storyPoints": 5,
        "reason": "Backend work needs a new endpoint and persistence, but the scope is contained."
      }
    ],
    "explanation": "..."
  },
  "board": {
    "project": {},
    "board": {}
  }
}
```

Use the same error style as existing API routes. Error cases:

- project not found;
- `cardRelativePath` missing;
- path escapes task root;
- card not found;
- card not eligible;
- fewer than 3 valid participant votes;
- OpenAI/API failure that leaves fewer than 3 valid votes.

### Board changes

Update board building so:

- `estimate.json` is skipped while building `FileTreeNode[]`;
- `estimate.json` is ignored by timestamp summarization;
- existing estimate data is parsed and exposed as `card.estimate`;
- `card.estimateEligible` and `card.estimateIneligibleReason` are populated for every card;
- invalid/corrupt `estimate.json` does not crash board loading. Treat it as `card.estimate = null` and keep the card usable.

If hiding `estimate.json` from the file tree already removes it from visible file counts, no extra frontend stat filtering is needed. Keep this behavior explicit in tests.

### File read/write protection

Normal file endpoints should not read or write `estimate.json` as a regular editable task file.

If a direct request asks for `task-*/estimate.json` through the existing file read or write endpoint, return a bad request error. Estimate updates must go through `POST /api/projects/:id/estimate`.

### Digest changes

AI digest must ignore `estimate.json` in two ways:

- digest preview must not select a task only because `estimate.json` was created or updated;
- digest prompt context must never include `estimate.json`.

Because digest selection uses `card.updatedAt`, the primary fix is making board timestamps ignore `estimate.json`.

Also keep explicit digest file collection protection so `estimate.json` cannot enter digest context even if future board logic changes.

## Frontend implementation

### API client

Extend `src/api.ts` with:

```ts
generateEstimate(projectId: string, cardRelativePath: string): Promise<GenerateEstimateResponse>
```

### Task modal UI

Render estimate UI in the opened task modal near task metadata.

States:

- eligible and no estimate: show `Estimate`;
- eligible and estimate exists: show compact badge, for example `5 pts`;
- generating/regenerating: show loading state and prevent duplicate requests;
- failed generation: show visible error message;
- ineligible: do not show the primary estimate action. It is acceptable to show a small unavailable hint only if it does not clutter the modal.

Badge behavior:

- clicking the badge opens a compact popover;
- popover has its own scroll area if content is long;
- popover shows final estimate, median/average values, participant votes, and explanation;
- regenerate action is available from the estimate UI;
- regenerate calls the same endpoint and replaces the displayed estimate after success.

After successful generation/regeneration:

- apply the returned fresh board to app state;
- update the selected/open card from the fresh board;
- badge must appear immediately without page reload.

Do not render `estimate.json` in the file tree, file preview, or editor.

## Test plan

Do not test AI output quality or exact generated wording. Test deterministic contracts and app behavior around AI.

### Backend unit tests

Eligibility helper:

- accepts only cards where `list.id === "tasks"`, `card.kind === "folder"`, `card.sourceName` matches `task-*`, and root-level `draft.md` plus `plan.md` exist;
- rejects task folders missing `draft.md`;
- rejects task folders missing `plan.md`;
- rejects non-`Tasks` list folders, even when their directory name matches `task-*`;
- rejects file cards;
- rejects nested `task-*` directories.

Vote processing:

- calculates median story points from valid votes;
- for 4 valid votes, median uses the upper middle allowed scale value;
- calculates average story points rounded to one decimal place;
- accepts only values from `0, 1, 2, 3, 5, 8, 13, 21`;
- rejects malformed participant JSON;
- rejects unsupported story point values;
- rejects empty reasons;
- succeeds with 3, 4, or 5 valid participant votes;
- fails when fewer than 3 valid participant votes are available;
- uses all-settled participant handling so one failed request does not cancel successful votes.

Estimate persistence:

- writes `estimate.json` with `version`, `storyPoints`, `averageStoryPoints`, `scale`, `generatedAt`, `sources`, `votes`, and `explanation`;
- includes `implementation_progress.md` in `sources` only when it exists;
- replaces the previous `estimate.json` during regeneration;
- does not create or replace `estimate.json` when generation fails with fewer than 3 valid votes.

### Backend integration tests

Board behavior:

- parses existing `estimate.json` into `card.estimate`;
- sets `card.estimateEligible` and `card.estimateIneligibleReason`;
- hides `estimate.json` from the card file tree;
- excludes `estimate.json` from visible file statistics;
- excludes `estimate.json` from default open file selection;
- ignores `estimate.json` when calculating card `createdAt` and `updatedAt`;
- does not expose `estimate.json` through normal file read/write endpoints;
- corrupt `estimate.json` does not crash board loading.

Digest behavior:

- digest preview does not include a task only because `estimate.json` was created or updated;
- digest preview can still include the task when regular task files were updated in the selected period;
- digest included file paths never contain `estimate.json`;
- digest prompt context never contains `estimate.json` content.

API behavior with mocked AI:

- successful estimate generation returns the estimate and fresh board data;
- returned fresh board contains the updated `card.estimate`;
- generation with 3 valid votes and 2 failed participants succeeds;
- generation with 2 valid votes fails and returns an error;
- failed generation does not mutate an existing estimate;
- regeneration overwrites the existing estimate and returns fresh board data;
- direct file read/write requests for `task-*/estimate.json` fail.

### Frontend tests or dogfood checks

Task modal behavior:

- eligible task without an estimate shows an `Estimate` action;
- ineligible cards do not show the primary estimate action;
- eligible task with an existing estimate shows a compact badge such as `5 pts`;
- clicking the badge opens the decision log popover;
- popover shows final estimate, median/average values, participant votes, and explanation;
- generation shows a loading state;
- generation error is visible and does not show a stale successful badge;
- after successful generation, the badge appears without page reload;
- regenerate calls the estimate endpoint and updates the badge/popover from returned board data.

## Documentation updates

Update memory bank after implementation.

`.memory-bank/architecture/c4.md`:

- L1 LocalTasks description should mention AI Scrum Poker estimates in addition to AI digest.
- L1/L2 OpenAI-compatible provider description should mention both digest generation and task estimation.
- Task File Store description should mention `estimate.json` as a task-local system-managed file.
- Web App component summary should mention the estimate action, badge, and decision log popover.
- API Server route list should include `POST /api/projects/:id/estimate`.
- `server/board.ts` summary should mention system file handling and `card.estimate`.
- Add `server/estimate.ts` if that module is introduced.
- Data Flow should describe estimate generation, `estimate.json` persistence, board refresh, and digest exclusion.

`.memory-bank/product/user-stories.md`:

- Add `US-07. Оценить сложность задачи через AI Scrum Poker`.
- Cover eligible task requirements, estimate generation, badge display, decision log popover, regeneration, loading/error states, and saved `estimate.json`.
- Update `US-03. Открыть карточку задачи` to mention the saved estimate badge in the card modal.
- Update `US-06. Сгенерировать AI digest` to state that `estimate.json` does not affect digest selection and is not included in digest context.

`.memory-bank/index.md`:

- Update the Product link description so it includes AI Scrum Poker estimation.
- Update the Architecture link description only if the summary remains too narrow after C4 changes.

## Acceptance criteria

- Eligible task cards show an AI estimate action in the task modal.
- A task card is eligible only when it is a root `Tasks` list folder named `task-*` with root-level `draft.md` and `plan.md`.
- Non-task cards, nested `task-*` folders, and task folders missing `draft.md` or `plan.md` do not allow estimation.
- Estimation reads `draft.md`, `plan.md`, and optional root-level `implementation_progress.md`.
- Estimation runs five role-based AI participant requests in parallel.
- Participant requests use an all-settled flow so one failed participant does not fail the whole generation.
- Each valid participant result contains only an allowed story point value and a short reason.
- The final estimate is derived deterministically from the median participant vote.
- With 4 valid votes, median uses the upper middle value.
- Average story points are calculated, rounded to one decimal place, and saved.
- At least 3 valid participant votes are required to save an estimate.
- If fewer than 3 valid participant votes are available, the UI shows an error and no estimate is saved or overwritten.
- The estimate is saved as `estimate.json` inside the task directory.
- Regeneration replaces the current `estimate.json`.
- Existing estimates are exposed to the UI through `card.estimate`.
- Card data exposes eligibility state through `card.estimateEligible` and `card.estimateIneligibleReason`.
- `estimate.json` is treated as a system-managed file.
- `estimate.json` is hidden from the task file tree, visible stats, search, default opening, and general file editor.
- Direct normal file read/write requests for `task-*/estimate.json` are rejected.
- `estimate.json` does not affect card `createdAt` or `updatedAt`.
- `estimate.json` does not affect AI digest card selection.
- `estimate.json` is not included in AI digest prompt context.
- The task modal displays a compact saved estimate badge, such as `5 pts`.
- The estimate badge appears immediately after successful generation or regeneration, without page reload.
- Clicking the estimate badge opens a compact decision log popover.
- The popover shows final estimate, median/average values, participant votes, and a short explanation.
- Successful generation and regeneration return fresh board data.
- Memory bank documentation is updated after implementation.
