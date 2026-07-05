# Goal

1. Produce `plan.md` that is self-contained enough to hand off to an execution orchestrator.
2. The plan must be dependency-aware and easy to execute sequentially by a single implementer agent.

# Output

1. Write or update `plan.md` in the same directory as the provided `draft.md` path.

# Artifact Commit Discipline

1. If planning creates a new task artifact file, ensure the task-related git branch already exists and is checked out before writing it.
2. The task-related git branch name must match the task folder name exactly.
3. Commit each newly created task artifact file after it passes the required artifact review gate.
4. If `draft.md` was created earlier during Brainstorming before the task branch existed, commit that `draft.md` first when entering Planning.
5. This rule applies in particular to `draft.md` and `plan.md`.
6. In Plan-Act mode, do not start `ACT.md` until the newly created `plan.md` has been committed.
7. `plan.md` is not ready to commit until the Planning Artifact Review Gate returns `pass`.

# Input Path (expected)

1. The user provides an explicit path to the draft file (for example `.../draft.md`) as an argument to this skill.
2. Use that path as the primary input.
3. Write `plan.md` next to the provided draft file (same folder) unless the user explicitly requests a different output location.

# Plan Format (minimal, but strict)

1. Use the following top-level structure (keep it short).
2. Use Markdown headings exactly as shown, so an executor can reliably parse it.

```markdown
# <Task Title> (Implementation Plan)

## 1. Scope (what to implement)

## 2. Fixed decisions (must follow)

## 3. Milestone rules (dependencies)

## 4. Milestone index

## 5. Milestone details

### 5.1 M1 — <Name>

#### 5.1.1 Depends on

#### 5.1.2 Scope

#### 5.1.3 Acceptance criteria

#### 5.1.4 Verification

#### 5.1.5 Consumer surfaces impacted

#### 5.1.6 Pre-response/loading/success/error/empty states (when applicable)

### 5.2 M2 — <Name>

...

## N. Execution order (derived from dependencies)

## Orchestration (managed by orchestrator)
```

# Fixed Decisions (repo policy)

1. In `## 2. Fixed decisions (must follow)`, include repo-level constraints that must not be violated.
2. Always include: “Do not introduce fallbacks or backward compatibility unless explicitly requested by the user.”

# Milestone Index (required)

1. In `## 4. Milestone index`, include a compact table that makes dependencies obvious.

```markdown
| ID  | Name   | Depends on | Notes    |
| --- | ------ | ---------- | -------- |
| M1  | <Name> | none       | <1 line> |
| M2  | <Name> | M1         | <1 line> |
```

# Orchestration Block (simple and parseable)

1. At the very end of `plan.md`, include an orchestration block to track milestone status and recorded commits.
2. Use a plain Markdown table (no JSON/YAML).
3. Initialize each milestone with `Status = not started` and empty `Commits`.

```markdown
## Orchestration (managed by orchestrator)

| Milestone   | Status      | Commits |
| ----------- | ----------- | ------- |
| M1 — <Name> | not started |         |
| M2 — <Name> | not started |         |
| Reviewer    | not started |         |
| Code Reviewer | not started |       |
```

# Milestone Rules (dependency-aware, sequential)

1. Milestones are sequential phases of the implementation (do not design for parallel milestones).
2. Each milestone must declare explicit dependencies:
   1. `Depends on: none` OR `Depends on: M1, M2`
3. Do not use file ownership:
   1. do not introduce `Owned files` lists
   2. do not enforce disjoint file sets
4. Each milestone must be executable once its dependencies are complete, without requiring parallel coordination.
5. Each milestone must include:
   1. `Scope` (what is included + what is explicitly excluded)
   2. `Acceptance criteria` (observable outcomes; “must be true” statements)
   3. `Verification` (exact commands + minimal manual checks)
6. For milestones that affect user-facing or API consumer behavior, explicitly list impacted consumer surfaces.
7. For async/IO behavior, define expected pre-response/loading/success/error/empty states in the milestone so implementation and review can verify them consistently.

# Milestone Decomposition (tuning)

1. Decompose primarily by dependency boundaries:
   1. “define contracts / SSOT” milestones first
   2. “implement core behavior” milestones next
   3. “update consumers / integration” milestones after contracts stabilize
   4. “tests + cleanup” milestones last (unless tests are required to safely refactor)
2. Prefer fewer, larger milestones over many tiny ones:
   1. if a scope chunk is small, merge it into the nearest milestone it depends on
3. If the only reason to split is “different stacks” but the work is small (for example UI tweaks that are not a separate multi-hour track), keep it inside the main milestone to avoid overhead.

# Acceptance-Focused Testing

1. Tests should prove acceptance criteria, not cover everything.
2. Before writing the test plan, inspect the repo's existing test layout, helpers, seed/world patterns, and commands.
3. Map each important AC to the smallest useful regression test level:
   1. unit tests for pure business rules, calculations, DTO mappers, serializers, and edge cases
   2. integration/API tests for mutations, persistence, authorization, API responses, and cross-boundary safety
   3. e2e tests for key user journeys and stable user-visible outcomes
   4. contract/mapper tests for public DTO/API shapes and field semantics
   5. negative tests for forbidden, invalid, wrong-scope, duplicate, blocked, or idempotent cases
4. Do not add UI layout, CSS, visual, or snapshot tests unless the task explicitly requires them.
5. The plan must describe which tests are needed, what they should verify, and which existing files/patterns/commands they should use when that can be determined from the repo.
6. Do not delegate test research to the implementer; `plan.md` must already contain the prepared test scope.
7. A test milestone must say which AC the planned tests prove and which level is used; avoid generic “add tests” wording.

# Documentation Planning

1. Before writing the documentation plan, inspect the repo's existing docs, memory bank, architecture notes, API contracts, product journeys, README, or other local documentation patterns.
2. Decide which documentation must be added or updated for the task before finishing Planning.
3. `plan.md` must name the documentation files or sections to update and describe the required content at implementation-ready detail.
4. If no documentation update is needed, state that explicitly with a short reason.
5. Do not delegate documentation research to the implementer; `plan.md` must already contain the prepared documentation scope.

# Contracts and Dependencies (required)

1. Treat API/type/schema/interface definitions as “contracts”.
2. Each relevant milestone must declare contracts in plain language:
   1. `Contracts produced/changed:` what interfaces are introduced/changed (API routes, DTO shapes, events, env vars, DB schema expectations, etc.)
   2. `Contracts consumed:` which upstream contracts it relies on
3. If a milestone consumes contracts produced/changed by another, it must depend on that producer milestone and run after it.
4. Any consumer milestone should start with “Contract sync” in its scope/tasks:
   1. review the latest contract definitions introduced/changed by dependencies
   2. confirm expected shapes/semantics before implementing

# Execution Order (derived from dependencies)

1. In `Execution order (derived from dependencies)`, provide an explicit sequential order that respects `Depends on` relationships.
2. If there is any ambiguity in order, resolve it by:
   1. running contract/SSOT changes first
   2. running migrations/integrity hardening early (to de-risk)
   3. running UI refactors after backend contracts stabilize

# Self-Contained Requirement (keep minimal)

1. Assume the executor and agents will not have additional context besides:
   1. repo contents
   2. `plan.md`
2. For each milestone, include enough detail to implement without asking questions, but avoid micro-steps.
3. If there are critical run/test commands, include them as one short numbered list at the end of the plan (no long sections).

# Draft Assimilation (required)

1. If there is a draft file (for example `draft.md`), treat it as input only.
2. `plan.md` must be self-contained:
   1. do not write “see draft”, “refer to draft”, or “Source: draft.md” as a required dependency
   2. do not require the executor/agents to open any other file to understand what to build
3. Extract from the draft all execution-critical details and restate them inside `plan.md`:
   1. scope and non-goals
   2. fixed decisions and constraints (transport, security checks, idempotency, limits)
   3. domain concepts and entities (what exists and how it behaves)
   4. edge cases and failure modes (retries, rate limits, parsing errors)
   5. acceptance criteria / done definition
   6. testing expectations
   7. documentation expectations
4. Do not paste the draft verbatim as a single blob:
   1. move invariants into “Fixed decisions (must follow)”
   2. move implementation work into the relevant milestone “Scope / Verification / Acceptance criteria”
   3. move acceptance and verification into the appropriate milestone sections
5. If the draft contains multiple real implementation options with materially different behavior, do not choose one in `plan.md`.
   1. mark planning as `blocked`
   2. use `request_user_input` tool to ask the user to pick one option explicitly
   3. resume only after the user decision is recorded as a fixed decision
6. Self-contained check (must pass):
   1. `plan.md` must not contain “see draft”, “refer to draft”, or any file path reference that is required to implement
   2. if `plan.md` mentions another file, it must be for provenance only and the plan must still be executable without opening it

# Final Simplification Pass (must pass)

1. Before completing the Planning stage, review the entire `plan.md` and ask yourself explicitly:
   1. Does this plan follow DRY, KISS, and YAGNI?
2. If the answer is “no” or “not fully”, revise the plan before finishing.
3. During this pass, remove or simplify:
   1. duplicated responsibilities across milestones
   2. unnecessary abstractions or new subsystems
   3. speculative or future-facing scope not required for the agreed task
   4. milestone splits that do not reflect real dependency boundaries
4. Prefer extending existing contracts/modules over introducing new layers when that keeps the plan simpler and clearer.
5. Do not finish Planning until the simplified plan still remains self-contained and executable.

# Artifact Review Gate

1. Run `artifact_quality_reviewer_worker` after `plan.md` has been written or updated and all Planning self-checks have passed.
2. Reuse the existing artifact reviewer if one was already spawned during this PlanAct run; otherwise spawn it once:
   1. spawn using `artifact_quality_reviewer_worker`
   2. spawn with `fork_context=false`
   3. remember its `agent_id`
   4. reuse the same reviewer for every Artifact Review Gate rerun in this PlanAct run
   5. do not close or delete the reviewer after it returns a result
3. The reviewer payload must contain only:
   1. task folder path
   2. artifact path (`plan.md`)
   3. current stage name (`Planning`)
4. Do not pass:
   1. chat summaries
   2. accepted user decisions
   3. expected findings
   4. custom checklists
   5. reviewer rubrics
   6. explanations of what the plan should contain
5. All execution-relevant draft decisions and stage-relevant planning decisions must already be written into `plan.md` before review.
6. If the reviewer cannot validate `plan.md` without extra chat context, revise `plan.md` and rerun review.
7. `critical`, `high`, and `medium` reviewer findings block the Planning stage.
8. `minor` reviewer findings are non-blocking unless they create ambiguity for the next stage.
9. Do not commit `plan.md`, announce Planning complete, or continue into `ACT.md` until the reviewer returns `pass`.
