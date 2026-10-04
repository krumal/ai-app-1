# Goal

1. Turn an idea, rough request, or partially-specified task into a planning-ready `draft.md`.
2. Keep the conversation exploratory, but converge to one explicit draft contract that can feed `PLAN.md`.
3. Stop before planning unless the user explicitly asks to continue into the Planning stage.

# Output

1. Write or update `draft.md` inside the provided task folder.
2. Keep every artifact created during this stage inside that same task folder.

# Non-Negotiable Constraints

1. Do not create or switch to the task branch during Brainstorming.
2. Do not invoke `PLAN.md`, `ACT.md`, or any implementation flow until the user explicitly asks to continue.
3. Do not write product code, scaffold files outside the task folder, or start implementation.
4. Before every `request_user_input` call, send a short text explanation of why the next answers are needed.
5. Use `request_user_input` for clarification batches, with at most 3 questions per call.
6. Group clarification questions by one topic at a time; do not mix unrelated decisions into one batch.
7. If a set of related questions depends on seeing layout, hierarchy, flow, or UI variants, prefer the visual companion over multiple text-only back-and-forth turns.
8. If the task involves changing an existing interface or adding new UI, prefer using the visual companion unless the decision is trivial in chat.

# Input Path (expected)

1. Prefer a task folder path as the input to this stage.
2. If the task folder is already obvious from context (for example, the user is working inside an existing task folder or has already anchored the conversation to one), infer it instead of asking for the path again.
3. If the repository has an established task-folder system and the next task folder/name can be inferred with high confidence from existing task numbering and local conventions, do not ask the user to confirm it; create or use the inferred next task folder directly.
4. Ask the user for the task folder path only when it is not discoverable with reasonable confidence.
5. Treat that folder as the canonical location for:
   1. `draft.md`
   2. any brainstorming-only artifacts created during this stage

# Recommended Draft Structure

Use a concise self-contained structure like:

```markdown
# <Task Title> (Draft)

## 1. Goal

## 2. Scope

## 3. Non-goals

## 4. Constraints and fixed decisions

## 5. User journey / user-visible behavior

## 6. Testing expectations

## 7. Documentation updates

## 8. Acceptance criteria

## 9. Open questions resolved during brainstorming

## 10. Notes for planning
```

1. Keep the draft planning-ready, not essay-like.
2. Capture the decisions the Planning stage will need:
   1. what is in scope
   2. what must not be built
   3. constraints that must survive planning and implementation
   4. user-visible behavior and, when possible, the end-to-end user journey for the new feature
   5. the expected test coverage split across unit, integration, and e2e tests
   6. which project documentation likely must be updated or added for this feature, based on repo documentation patterns
   7. acceptance criteria and behavioral expectations
3. If the task is too large for one implementation plan, decompose it and write the draft only for the first sub-task the user wants to pursue now.

# DRY, KISS, YAGNI And Overengineering Guard

1. Start from the agreed user-visible behavior and repository constraints, then design the smallest solution that satisfies them. Treat production readiness as a quality bar for that solution, not as permission to add scope.
2. Prefer reusing or simplifying an existing configuration surface, state, hook, job, service, UI state, API contract, or test pattern over introducing a parallel concept.
3. Acceptance criteria must describe observable behavior, an explicit user decision, or a required correctness, security, or data-integrity outcome. Do not turn an implementation detail introduced during brainstorming into an acceptance criterion to make that detail appear required. Record user-selected or repository-mandated technologies under fixed decisions or constraints instead.
4. Every net-new concept or artifact, such as product state, a dependency or abstraction, configuration, a runtime or operational mechanism, an API/UI surface, verification, logging, or documentation, must:
   1. be required by an explicit acceptance criterion, fixed user decision, or concrete correctness, security, or data-integrity requirement
   2. have a concrete consumer or required use that already exists, is delivered by this task, or follows from an explicitly approved downstream requirement
   3. survive repository inspection confirming that no existing concept can satisfy the same requirement more simply
5. A consumer may be inside or outside this task, but a hypothetical future use does not count.
6. A test or assertion added only to exercise a proposed mechanism is not an independent consumer of that mechanism. Verification counts as a consumer only when it protects a required behavior or concrete risk that is not already covered at a simpler layer.
7. Remove a proposed concept when deleting it would preserve all acceptance criteria and fixed decisions, or when it has no concrete consumer or required use.
8. Collapse concepts that have the same observable effect. Do not keep separate states, intents, commands, checks, or branches only because they represent different historical causes.
9. Do not introduce speculative infrastructure for hypothetical future needs, including:
   1. feature flags
   2. compatibility or fallback paths
   3. replay, reconciliation, or backfill mechanisms
   4. new queues, schedulers, outboxes, or state machines
   5. generalized abstractions for a single known use
   unless the user explicitly requires them, a concrete correctness, security, or data-integrity requirement makes them necessary, or current repository constraints make them necessary.
10. Do not extract a helper used only once unless it represents an independently meaningful domain rule or materially improves correctness and testability.
11. Prefer tests of observable behavior and persisted outcomes. Do not add tests whose only purpose is to prove that removed implementation details no longer exist.
12. Do not add a new UI or API concept when existing behavior can represent the required result without losing user-visible functionality.
13. If a simpler design depends on an unresolved product or operational trade-off, ask the user before locking a more complex design into the draft.
14. If the task contains independent system changes that are not required for the same observable outcome, split them instead of bundling them into one broad draft.
15. Do not call the solution minimal, simple, or free of overengineering until the final simplification check below passes.

# Workflow

1. Explore project context first:
   1. inspect relevant files, docs, and recent changes
   2. follow local project patterns instead of inventing a parallel structure
   3. inspect existing documentation and test patterns enough to capture useful documentation and testing expectations in the draft
2. Assess scope early:
   1. if the request actually contains multiple independent subsystems, say so
   2. help the user choose the first sub-task before writing a broad draft
3. Clarify using `request_user_input`:
   1. ask in batches of up to 3 questions
   2. prefer multiple-choice questions where reasonable
   3. ask only the questions needed to remove planning ambiguity
   4. do not ask about decisions that can be derived reliably from repo state, local conventions, or existing task numbering
4. If multiple related questions are visual and the user would benefit from seeing them together:
   1. use it when the decision depends on seeing layout, hierarchy, comparison, flow, or UI variants
   2. if the task changes an existing interface or adds new UI, prefer the visual companion unless the decision is trivial in chat
   3. if the same questions can be answered cleanly through `request_user_input` in chat, do not use the visual companion
   4. do not use it for abstract product choices with no meaningful visual component
   5. open `VISUAL_COMPANION.md` and follow it
   6. spawn `visual_companion_worker`
   7. pass one visual batch containing all currently known related visual decisions
   8. pass `ui_language` matching the current chat language
   9. pass `task_folder`, `ui_language`, `session_title`, `session_intro`, `product_context`, `visual_decisions`, `completion_rule: all_required_decisions_answered`, and `return_format` using the contract in `VISUAL_COMPANION.md`; include relevant UI paths, required states, and 2-3 materially different options per decision
   10. wait only for the worker to return a prepared session with URL and artifact paths; if it returns `not_visual`, ask the decision in chat; if it returns `error`, report the preparation failure
   11. tell the user where to open the session and what to answer
   12. as orchestrator, run `scripts/wait-for-visual-companion.sh` for that session
   13. use the watcher output as the session answers
   14. fold those answers into the draft
5. Explore 2-3 approaches when there is a meaningful product or architecture choice:
   1. explain trade-offs briefly
   2. recommend one option
   3. get the user's direction before locking it into the draft
6. Perform the final solution simplification check:
   1. list internally all proposed net-new concepts:
      1. product/domain behavior, state, and contracts
      2. code, dependency, abstraction, and configuration choices
      3. runtime, operational, build, and delivery mechanisms
      4. API/UI, verification, logging, documentation, and rollout artifacts
   2. for each concept, ask:
      1. which observable acceptance criterion, fixed user decision, or concrete correctness, security, or data-integrity requirement is its source
      2. which existing or task-delivered consumer uses it, or which explicitly approved downstream requirement needs it
      3. whether an existing repository concept can satisfy the same requirement
      4. whether it can be removed without changing observable behavior
      5. whether another proposed concept produces or verifies the same downstream effect
      6. whether it is needed now or only for a hypothetical future scenario
   3. remove or collapse every concept that lacks a valid source, lacks a concrete consumer or required use, duplicates an outcome or risk already covered more simply, or otherwise does not pass this check
   4. if the answer depends on an unknown user trade-off, resolve it before writing the final draft
7. Present the emerging draft in sections when needed:
   1. scope
   2. constraints / fixed decisions
   3. user journey and behavior
   4. testing and documentation expectations
   5. acceptance criteria
8. Write or update `draft.md` in the task folder.
9. Self-review the draft:
   1. no placeholders (`TODO`, `TBD`, unresolved “maybe” wording)
   2. no contradictions between sections
   3. no ambiguity that would cause `PLAN.md` to branch into multiple materially different plans
   4. no dependency on another file to understand the intended work
   5. if the feature has a user-facing flow, the user journey is explicit enough to guide planning
   6. the required test types are explicit enough that planning does not need to guess between unit, integration, and e2e coverage
   7. documentation updates are explicit enough that they can become plan milestones or acceptance criteria
   8. acceptance criteria describe observable behavior or required outcomes rather than implementation details introduced during brainstorming
   9. no net-new concept without a valid source, a concrete consumer or required use, and verified absence of a simpler existing repository concept
   10. no duplicated states, responsibilities, checks, or abstractions with equivalent observable effects
   11. no speculative infrastructure or future-facing scope
   12. no simpler existing repository surface that can satisfy the same acceptance criteria
10. Run the Draft Simplification Gate for `draft.md` until it passes.
11. Run the Artifact Review Gate for the simplified `draft.md`.
12. If either reviewer causes a revision, repeat the self-review, Draft Simplification Gate, then Artifact Review Gate.
13. Do not present the draft to the user until both gates pass.
14. Before asking the user to review the file, present a short in-chat summary of the drafted task:
   1. goal
   2. scope
   3. non-goals
   4. fixed decisions / constraints
   5. acceptance criteria
15. Ask the user to review the written `draft.md`.
16. After approval:
   1. if the user asked only for brainstorming, stop
   2. if the user wants planning next, hand off to `PLAN.md`

# Visual Companion Rules

1. Use it only for a coherent visual batch, not for every clarification.
2. If the same decision can be resolved cleanly in chat through `request_user_input`, stay in chat.
3. Put all currently known related visual questions into one session.
4. Do not split one visual topic into multiple browser sessions unless new visual ambiguity appears later.
5. The companion UI must use the same language as the chat.
6. Each visual question must support:
   1. answer options
   2. per-question submit action
   3. optional free-text note
7. The orchestrator must watch `answers.json` and `completed.json`; the worker must not complete the session on the user's behalf.
8. The browser session is a Brainstorming aid only; the orchestrator still owns the final `draft.md`.

# User Review Gate

After the draft passes the Draft Simplification and Artifact Review gates, summarize it in chat, then ask the user to review it before planning.

Do not ask the user to open the file without first summarizing the task in chat.

Then ask:

> "Draft written to `<path>`. I also summarized the task here in chat. Please review it and tell me what to change before we move to the planning stage."

If the user requests changes:

1. update `draft.md`
2. re-run the draft self-review
3. rerun the Draft Simplification Gate, then the Artifact Review Gate
4. ask for approval again only after both return `pass`

# Draft Simplification Gate

1. Before artifact review, run `plan_simplify_worker` with the task folder, artifact path, and `Draft Simplification` stage; on reruns also pass a concise summary of changes since its previous review.
2. Spawn it once with `fork_turns="none"`; reuse it for later simplification passes and Planning.
3. Evaluate its findings against the artifact and repository; do not apply them automatically.
4. Ask the user when a finding requires a product choice, scope change, or major architecture decision.
5. Apply accepted simplifications, repeat self-review, and rerun this gate until it returns `pass`.
6. Do not run artifact review until it returns `pass`.

# Artifact Review Gate

1. Run `artifact_quality_reviewer_worker` only after the Draft Simplification Gate passes.
2. Spawn the artifact reviewer only if there is no existing artifact reviewer for this PlanAct run:
   1. spawn using `artifact_quality_reviewer_worker`
   2. spawn with `fork_turns="none"`
   3. remember its `agent_id`
   4. reuse the same reviewer for every Artifact Review Gate rerun in this PlanAct run
   5. do not close or delete the reviewer after it returns a result
3. The reviewer payload must contain only:
   1. task folder path
   2. artifact path (`draft.md`)
   3. current stage name (`Brainstorming`)
4. Do not pass:
   1. chat summaries
   2. accepted user decisions
   3. expected findings
   4. custom checklists
   5. reviewer rubrics
   6. explanations of what the draft should contain
5. All stage-relevant decisions must already be written into `draft.md` before review.
6. If the reviewer cannot validate `draft.md` without extra chat context, revise `draft.md` and rerun review.
7. `critical`, `high`, and `medium` reviewer findings block the Brainstorming stage.
8. `minor` reviewer findings are non-blocking unless they create ambiguity for Planning.

# Transition To Planning

1. Brainstorming itself does not create the task branch.
2. When the user asks to continue into Planning or Plan-Act:
   1. create or switch to the task branch at that point
   2. if `draft.md` was created before the branch existed, commit it first on the task branch
   3. only then continue to `PLAN.md`
