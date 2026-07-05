# AI Scrum Poker estimate

## Idea

Add a simple AI-assisted task complexity estimate for planned tasks in LocalTasks.

The feature should work like a lightweight Scrum Poker session: when the user opens a task, they can request an AI estimate. The app asks several AI "participants" to independently estimate the task, combines their votes into a final story point value, and saves the result with a short decision log.

The goal is not to build a complex scoring system. The estimate should be easy to understand, easy to regenerate, and visibly connected to the task files that were used.

## User value

As a developer using LocalTasks, I want to quickly estimate task complexity from the task draft and plan, so that I can prioritize work and understand relative effort without manually running a planning discussion every time.

## Scope

The feature applies only to regular task cards:

- card must belong to the `Tasks` list (`list.id === "tasks"`);
- card must be a folder (`card.kind === "folder"`);
- card source directory name must match `task-*`;
- `draft.md` must exist directly in the task folder root;
- `plan.md` must exist directly in the task folder root;
- `implementation_progress.md` may be used if it exists directly in the task folder root, but is optional.

The feature should not apply to incidents, reports, misc files, or other non-task cards.

Nested `task-*` folders are not eligible. The first version should support only root-level cards in the `Tasks` list.

## UX

In the opened task modal, show an estimate action near task metadata.

Initial state:

- if the task is eligible and has no estimate, show an `Estimate` action;
- if the task is not eligible, do not offer estimation or show it as unavailable with a short reason.

After generation:

- show a compact badge like `5 pts`;
- clicking the badge opens a popover with the saved decision log;
- provide a way to regenerate the estimate;
- regeneration replaces the current estimate.
- the badge must appear immediately after generation, without requiring a page reload.

The decision log should stay compact. It should show only the most useful information:

- final estimate;
- median and average vote values;
- AI participant votes;
- short explanation based on participant reasons.

## AI estimation flow

Backend reads the task files:

- `draft.md`;
- `plan.md`;
- `implementation_progress.md`, if present.

Then it runs several AI requests in parallel. Each request receives the same task context but a different planning-poker role, for example:

- backend engineer;
- frontend engineer;
- QA engineer;
- tech lead;
- product-minded implementation reviewer.

Each participant must return structured data:

```json
{
  "role": "backend engineer",
  "storyPoints": 5,
  "reason": "Backend work needs a new endpoint and persistence, but the scope is contained."
}
```

Allowed story point scale:

```text
0, 1, 2, 3, 5, 8, 13, 21
```

The final estimate should be derived deterministically from the votes:

- `storyPoints` is the median vote value;
- `averageStoryPoints` is also calculated and saved as a supporting signal;
- no additional AI facilitator request is needed.

If at least 3 of 5 participant requests succeed, the estimate can be generated from successful votes. If fewer than 3 requests succeed, show an error and do not save an estimate.

The parallel participant requests must use an all-settled style flow. One failed participant must not cancel the whole estimation attempt if at least 3 participant results are still valid.

The system builds the saved decision log from participant votes and reasons.

## Persistence

Save the estimate inside the task directory, so it travels with the task files.

Use JSON because the result is structured data that the UI needs to parse reliably:

```text
estimate.json
```

Example shape:

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
      "reason": "The feature needs eligibility checks, persistence checks, and regeneration checks."
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
  "explanation": "The final estimate is 5 points because the median vote is 5. The average vote is 5.2. The task has a contained UI entry point, but requires backend generation, task-local persistence, and clear regeneration behavior."
}
```

Regeneration replaces the current `estimate.json`. Previous attempts are not preserved in the first version.

`estimate.json` should not be included in AI digest context.

## System file behavior

`estimate.json` is a system-managed file, not a regular task content file.

It should be excluded from:

- card file tree;
- visible file statistics;
- default file opening;
- task search by file name/content metadata;
- general file editor read/write flows;
- card `createdAt` and `updatedAt` calculations;
- AI digest card selection;
- AI digest file context.

This is important because generating or regenerating an estimate must not make the task look recently updated for digest purposes. The task should enter AI digest only when user-authored task content changes, such as `draft.md`, `plan.md`, `implementation_progress.md`, or other regular task files.

The board can still expose parsed estimate metadata through a dedicated field on the card, for example `card.estimate`, so the UI can render the badge while keeping `estimate.json` hidden from the file tree.

## API response behavior

After a successful estimate generation or regeneration, the UI must receive enough fresh data to show the badge immediately without reload.

Preferred response shape:

- generated estimate;
- fresh board response, matching the existing file-save pattern.

Returning the fresh board keeps task card metadata, labels, timestamps, and estimate state in sync after the backend writes `estimate.json`.

## Acceptance criteria

- Eligible tasks can request an AI Scrum Poker estimate from the task modal.
- Ineligible cards do not allow estimation.
- Estimation uses `draft.md` and `plan.md`, plus optional `implementation_progress.md`.
- Multiple role-based AI requests run in parallel.
- Participant requests use an all-settled flow so one failed participant does not fail the whole generation.
- Each participant returns only a story point value and a short reason.
- Final story points are derived deterministically from the median participant vote.
- Average story points are calculated and saved.
- If at least 3 of 5 participant requests succeed, the estimate is saved.
- If fewer than 3 participant requests succeed, the UI shows an error and no estimate is saved.
- The result is saved as `estimate.json` inside the task directory.
- `estimate.json` is treated as a system-managed file.
- `estimate.json` is hidden from the task file tree, visible stats, search, and general file editor.
- `estimate.json` does not affect card `createdAt` or `updatedAt`.
- The task modal displays the saved estimate badge.
- The estimate badge appears immediately after successful generation or regeneration, without reload.
- Clicking the badge shows a compact decision log popover.
- Regeneration creates a new estimate and replaces the previous saved result.
- Successful generation/regeneration returns fresh UI data, preferably a fresh board response.
- `estimate.json` is not included in AI digest context.
- `estimate.json` does not affect AI digest card selection.
