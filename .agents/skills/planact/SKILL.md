---
name: planact
description: "[Run only when user is explicitly asking] Brainstorming, Plan, Act, or Plan-Act workflow: refine an idea into `draft.md`, turn it into `plan.md`, and optionally execute it through milestone implementation, milestone review, and final code review loops."
---

# Plan & Act workflow

1. This approach has four modes:
   1. Brainstorming: turn an idea or rough request into a planning-ready `draft.md` inside the task folder.
   2. Plan: turn `draft.md` into a self-contained `plan.md` with milestones and dependencies.
   3. Act: execute `plan.md` using a persistent Implementer+Reviewer pair plus the final code-review loop.
   4. Plan-Act: capture or refine the agreed task definition into `draft.md`, create `plan.md`, then execute that `plan.md` in the same run.
2. Keep the planning contract and the execution contract separate even when running Plan-Act mode.
3. Brainstorming is a pre-plan stage for creating or refining `draft.md`; it does not start implementation.
4. Standalone Brainstorming, Plan, and Act remain valid and must keep working.
5. Brainstorming may optionally use the visual companion for batched visual questions; this remains part of Brainstorming, not a separate top-level mode.
6. Brainstorming and Planning artifacts must pass `plan_simplify_worker` before `artifact_quality_reviewer_worker`.

# Manual invocation rules (required)

1. This skill must be used only when the user explicitly asks for it.
2. The user must provide a task-related path:
   1. for Brainstorming: a task folder path when the task folder is not already obvious from context
   2. for Plan: a `draft.md` path
   3. for Act: a `plan.md` path
   4. for Plan-Act: a task folder path is enough
3. Infer the intended mode from the chat context and the path type; do not require a magic keyword.
4. If the intent is genuinely ambiguous, ask the user to clarify with `request_user_input` instead of guessing.
5. In brainstorming-style discovery, ask clarification questions with `request_user_input` in batches of up to 3, and always send a short explanation before the question batch. If there are more than 3 questions, ask another batches.
6. If the latest agreed task definition cannot be inferred reliably from the current chat, create or refine `draft.md` through the Brainstorming stage before planning.

# Task Branch And Artifact Discipline

1. Brainstorming writes artifacts only inside the task folder and does not create or switch the task branch.
2. The task-related git branch discipline starts when entering Planning, Plan-Act, or Act.
3. The task-related git branch name must match the task folder name exactly (for example `task-123-some-task`).
4. If that branch does not exist yet, create it before continuing past the Brainstorming stage.
5. If the current working branch is not obvious or safe to use as the base, ask the user which branch should be used.
6. Each newly created task artifact file must be committed immediately after creation once the task branch discipline has started.
7. This rule applies in particular to `draft.md` and `plan.md`.
8. If `draft.md` was created during Brainstorming before the branch existed, commit that `draft.md` first when entering Planning or Plan-Act.

# Codex Thread Title (best effort)

1. In Codex, use the thread-title tool once when entering each stage to name the current thread `<task-label> draft|plan|act` (for example `task-54 draft`); in Plan-Act, update it at every stage transition.
2. Derive `<task-label>` from the leading `task-<number>` in the task folder name, or use the folder basename when no task ID exists.
3. Never rename subagent threads, override an explicit user title, or block the workflow when renaming is unavailable or fails.

# Stage selection

1. Brainstorming stage:
   1. Trigger when the user asks to explore, refine, decompose, clarify, or draft the task before planning or implementation, and the task folder is either provided or already obvious from context.
   2. Action: open `BRAINSTORM.md` and follow it.
   3. After finishing, stop unless the user explicitly asks to continue into Planning or Plan-Act.
2. Planning stage:
   1. Trigger when the user provides a `draft.md` path (for example `.../draft.md`) and clearly asks to plan, scope, or prepare the implementation plan.
   2. Action: open `PLAN.md` and follow it.
   3. After finishing, offer the user to proceed to Act (do not start Act unless the user confirms).
3. Plan-Act stage:
   1. Trigger when the user provides a task folder path and asks to implement the task end-to-end, for example “давай реализуем эту задачу”.
   2. Action:
      1. if the task definition is not yet stable enough for planning, run `BRAINSTORM.md` first to create or refine `draft.md`
      2. do not proceed past Brainstorming until `draft.md` has passed the Simplification and Artifact Review gates in `BRAINSTORM.md`
      3. ensure the task branch exists before committing or creating planning-stage artifacts
      4. if `draft.md` already exists from Brainstorming, commit it first on the task branch
      5. otherwise derive the latest agreed task definition from the current chat, write it into `draft.md`, run the Brainstorming gates, and commit `draft.md` only after both pass
      6. open `PLAN.md` and follow it to create `plan.md`
      7. do not commit `plan.md` until it has passed the Planning Simplification and Artifact Review gates in `PLAN.md`
      8. commit the newly created `plan.md`
      9. if planning blocks or requires a user choice, stop before Act
      10. otherwise open `ACT.md` and follow it using the generated `plan.md`
4. Execution stage:
   1. Trigger when the user provides a `plan.md` path or otherwise clearly refers to an existing plan and asks to implement, execute, or continue it.
   2. Action: open `ACT.md` and follow it.

# Context hygiene

1. Load only the stage document you need.
2. In Brainstorming mode, load `BRAINSTORM.md` only; load `VISUAL_COMPANION.md` only if a visual batch is actually needed.
3. In Plan-Act mode, use `BRAINSTORM.md` only if the task definition is not yet stable, then load `PLAN.md`, then `ACT.md` only after `plan.md` exists and the required task artifacts have been committed.
4. Keep outputs focused on deliverables and next actions; do not paste large plan sections unless the user asks.
