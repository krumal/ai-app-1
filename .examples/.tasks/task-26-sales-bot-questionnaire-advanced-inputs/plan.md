# Task-26 — Sales Bot questionnaire advanced inputs and voting modes (Implementation Plan)

## 1. Scope (what to implement)

1. Extend Sales Bot questionnaires so funnel authors can create richer question definitions and respondents can answer them without breaking the existing linear funnel model.
2. Update questionnaire authoring so the builder supports:
   1. multiline `questionText`
   2. `3000` character validation for question text
   3. per-question `selectionMode`
   4. one optional `custom answer` option per question
   5. draft-only plain-text parsing into questions and options when the questionnaire is empty
3. Update Telegram runtime so questionnaires support:
   1. immediate single-choice answers
   2. pending multi-select toggling with explicit submit
   3. custom-answer text capture after selecting a dedicated option
   4. strict stale-callback rejection after the run already advanced
4. Update campaign UX so admins get:
   1. visible copy-link success or failure feedback
   2. earlier and clearer blocking when the selected entry funnel is structurally invalid
5. Update persistence, analytics, and respondent detail so multi-select and custom-answer responses remain history-safe and readable after later questionnaire edits.

## 2. Fixed decisions (must follow)

1. Do not introduce fallbacks or backward compatibility unless explicitly requested by the user.
2. Questionnaire progression remains linear:
   1. no branching
   2. no per-answer routing
   3. no arbitrary question skipping
3. Existing task-24 and task-25 invariants remain in force unless this task explicitly replaces them:
   1. channel-scoped funnels
   2. explicit `allowRestart`
   3. atomic funnel structure writes
   4. duplicate callback idempotency
   5. history-safe answer snapshots for reporting
4. Question authoring rules are fixed:
   1. question text preserves line breaks
   2. question text is limited to `3000` characters
   3. each question has a `selectionMode`
   4. supported `selectionMode` values are `single` and `multiple`
5. Option authoring rules are fixed:
   1. options stay ordered
   2. each option has an explicit kind
   3. supported option kinds are `preset` and `custom`
   4. a question may contain at most one `custom` option
6. Parser behavior is fixed:
   1. parser input is plain text only
   2. a line starting with `* ` opens a new question
   3. a line starting with `- ` adds an option to the current question
   4. blank lines are separators and may be ignored
   5. leading indentation is ignored via `trimStart` before syntax checks
   6. parser syntax does not declare `single` or `multiple`
   7. parsed questions default to `single`
   8. parser is draft-only and web-only
   9. parser may run only when the questionnaire is empty
   10. parser must fail fast on malformed input or non-empty questionnaire state
7. Runtime rules for `single` questions are fixed:
   1. one option click immediately finalizes the answer
   2. once the run advances, old callbacks must not mutate stored answers
8. Runtime rules for `multiple` questions are fixed:
   1. option clicks toggle pending selection for the active question only
   2. selected options are rendered with `✅`
   3. the inline keyboard is refreshed after each toggle
   4. the last button is always `➡️ Проголосовать`
   5. final persistence happens only after `➡️ Проголосовать`
   6. submitting with no selected options must not advance the run and must show `Сначала выберите хотя бы один вариант`
9. Runtime rules for `custom` answers are fixed:
   1. selecting the custom option sends `Введите ваш вариант ответа`
   2. the run enters an explicit waiting-for-text state
   3. custom-answer mode is mutually exclusive with preset options in the same question
   4. only the next inbound text message may finalize the answer
   5. non-text input in this state shows an error and keeps waiting
   6. text is trimmed before validation
   7. whitespace-only text is rejected and keeps waiting
   8. stored custom text is truncated to the first `1000` characters
   9. clicking another option before sending text cancels waiting-for-text state
10. Re-voting rules are fixed:
   1. selection changes are allowed only while a `multiple` question is still pending
   2. after a question is completed and the run advances, the answer cannot be changed
   3. stale callbacks for completed questions must answer with `Нельзя изменить ответ на уже пройденный вопрос`
   4. stale callbacks must not mutate persisted state
   5. stale callbacks must not resend the next question or completion outcome
11. Persistence rules are fixed:
   1. current questionnaire data may be discarded
   2. backward-compatible migration of existing questionnaire test data is not required
   3. final persisted answers use one row per selected option
   4. a custom answer persists the selected custom option row plus the captured custom-text snapshot
   5. transient current-step interaction state lives on `sales_bot_funnel_runs`
   6. only the currently active step may have transient interaction state
12. Reporting rules are fixed:
   1. aggregate statistics increment the custom option count when it is selected
   2. aggregate statistics do not split custom answers by unique entered text
   3. respondent detail shows the full stored custom text
   4. respondent detail shows multi-select answers as one question with the full list of selected options
13. Builder edit guards are fixed:
   1. adding a second custom option in the same question is blocked
   2. changing `selectionMode` after a question already has answers is blocked
14. Campaign UX changes are scoped:
   1. deep-link copy must show explicit success or failure feedback
   2. earlier invalid-funnel blocking must happen before save-time surprise whenever the selected funnel is already known to be structurally invalid
   3. this task does not broaden or relax deep-link slug validation rules

## 3. Milestone rules (dependencies)

1. Milestones are sequential and dependency-aware.
2. Persistence and contract changes land before runtime, API, analytics, and web consumers.
3. Any milestone that consumes upstream contracts must start with contract sync.
4. Database integrity changes land early because the current one-answer-per-step model blocks multi-select behavior.
5. Runtime callback and inbound-text routing changes land before admin consumers rely on new persisted answers.
6. Builder and campaign UX changes land only after backend contracts and query shapes are stable.
7. Analytics and respondent detail must remain snapshot-driven and readable after questionnaire text changes.
8. Generated migration flow is required:
   1. use Drizzle generation and migrate commands
   2. do not hand-write SQL migrations
9. Preserve unaffected Sales Bot surfaces unless this task explicitly changes them:
   1. broadcasts
   2. publisher
   3. inbox behavior outside custom-answer interception while waiting for questionnaire text
   4. campaign entry-template flow
10. Verification commands must be runnable from repo root.

## 4. Milestone index

| ID | Name | Depends on | Notes |
| --- | --- | --- | --- |
| M1 | Contracts and persistence foundation | none | Add question mode, option kind, transient run state, and multi-answer persistence contracts |
| M2 | Runtime answering and webhook routing | M1 | Implement single, multiple, custom-answer, stale-callback, and waiting-for-text behavior |
| M3 | Admin API, validation, and reporting contracts | M1, M2 | Expose new funnel shapes, edit guards, structural validity, analytics, and respondent detail |
| M4 | Web builder, campaigns, and respondents UI | M3 | Add parser and advanced-input UX, copy feedback, early invalid-funnel blocking, and new result rendering |
| M5 | Regression coverage and repo verification | M1, M2, M3, M4 | Lock behaviors across database, backend, and web, then run repo gates |
| M6 | Fix parser draft-only scope regression | M4, M5 | Restrict parser rendering/execution to empty draft funnels only and lock it with regression coverage |

## 5. Milestone details

### 5.1 M1 — Contracts and persistence foundation

#### 5.1.1 Depends on

1. Depends on: none

#### 5.1.2 Scope

1. Contracts produced/changed:
   1. funnel step contract adds `selectionMode`
   2. funnel option contract adds `kind`
   3. funnel answer contract supports:
      1. one row per selected option
      2. custom-text snapshot for the custom option row
   4. funnel run contract supports transient current-step interaction state for:
      1. pending multi-select selections
      2. waiting-for-text custom-answer mode
   5. funnel summary/detail and web shared types reflect the new step and option fields
2. Persistence work:
   1. update Drizzle schema for steps, options, runs, and answers
   2. replace the current `(runId, stepId)` answer uniqueness with a shape compatible with one row per selected option
   3. preserve run-level active uniqueness and ordered step/option integrity
   4. keep answer snapshots sufficient for history-safe analytics and respondent detail
   5. model transient interaction state on `sales_bot_funnel_runs` instead of introducing a separate pending-state table
3. Contract sync:
   1. review current schema, serializers, backend schemas, web types, and touched tests that still assume one answer row per step
   2. identify all consumers that currently assume options have only text and steps have no mode field
4. Explicitly excluded:
   1. Telegram runtime behavior
   2. HTTP route implementation
   3. builder parser UI

#### 5.1.3 Acceptance criteria

1. Database schema can represent `single`, `multiple`, and `custom` questionnaire definitions without fallback fields.
2. Database schema can represent pending interaction state on the active run for the current step only.
3. Persisted answers can represent:
   1. one selected preset option for `single`
   2. multiple selected preset options for `multiple`
   3. one custom option selection plus stored custom text for `custom`
4. Shared backend and web contracts expose the new step and option shape without requiring executors to infer semantics from implementation details.
5. Migration artifacts are generated through repo tooling and do not preserve old questionnaire test data.

#### 5.1.4 Verification

1. `pnpm --filter @tg-channel-stats/database build`
2. `pnpm --filter @tg-channel-stats/database db:generate`
3. `set -a && source packages/backend/.env && set +a && pnpm --filter @tg-channel-stats/database db:migrate`
4. `pnpm -s typecheck`

#### 5.1.5 Consumer surfaces impacted

1. Database schema and generated migration artifacts
2. Backend sales-bot schemas, serializers, and domain types
3. Web sales-bot types and normalizers

#### 5.1.6 Pre-response/loading/success/error/empty states (when applicable)

1. Not applicable for user-facing loading states in this milestone.

### 5.2 M2 — Runtime answering and webhook routing

#### 5.2.1 Depends on

1. Depends on: M1

#### 5.2.2 Scope

1. Contracts consumed:
   1. step `selectionMode` contract from M1
   2. option `kind` contract from M1
   3. multi-row answer persistence contract from M1
   4. run transient interaction state contract from M1
2. Contract sync:
   1. confirm final answer-row uniqueness and snapshot fields
   2. confirm transient run-state representation for pending selections and waiting-for-text mode
   3. confirm touched webhook flows that currently route user text directly into inbox handling
3. Runtime behavior to implement:
   1. keep current immediate-submit behavior for `single`
   2. extend callback protocol so the runtime can distinguish:
      1. select/toggle option
      2. submit current `multiple` step
   3. for `multiple`:
      1. toggle current selection in transient run state
      2. re-render the same message keyboard with `✅` markers
      3. show `➡️ Проголосовать` as the final button
      4. persist final answer rows and advance only on valid submit
   4. for `custom`:
      1. selecting the custom option enters waiting-for-text state
      2. runtime sends `Введите ваш вариант ответа`
      3. the next inbound text is consumed by questionnaire runtime before inbox routing
      4. valid text persists the custom option answer row plus custom-text snapshot and advances the run
      5. clicking another option while waiting cancels the waiting-for-text state
   5. stale-callback handling:
      1. completed-step callbacks return `Нельзя изменить ответ на уже пройденный вопрос`
      2. no persisted mutation
      3. no resend of next question or completion outcome
   6. duplicate delivery/idempotency:
      1. keep retry-safe behavior for duplicate accepted callbacks
      2. do not double-advance
      3. do not double-apply completion behavior
4. Explicitly excluded:
   1. admin CRUD routes
   2. builder parser UX
   3. result and respondent API payload updates outside what runtime persistence requires

#### 5.2.3 Acceptance criteria

1. `single` questions still finalize on one click and advance exactly once.
2. `multiple` questions allow pending toggle changes until submit, then persist one row per selected option and advance exactly once.
3. Submitting an empty `multiple` selection keeps the run on the current step and shows `Сначала выберите хотя бы один вариант`.
4. Selecting a custom option enters waiting-for-text mode, captures the next valid text, truncates stored text to `1000`, and advances exactly once.
5. Non-text and whitespace-only custom-answer input do not advance the run and keep waiting for valid text.
6. Callbacks from already completed questions do not mutate state and only return the stale-answer message.

#### 5.2.4 Verification

1. `pnpm --filter @tg-channel-stats/backend test:run -- webhook.test.ts`
2. `pnpm --filter @tg-channel-stats/backend test:run -- bot/sales-bot.test.ts`
3. `pnpm --filter @tg-channel-stats/backend test:run`
4. `pnpm -s typecheck`

#### 5.2.5 Consumer surfaces impacted

1. Telegram callback flow for questionnaire buttons
2. Telegram private-chat inbound message flow while a questionnaire waits for custom text
3. Runtime delivery helpers and callback parsing utilities

#### 5.2.6 Pre-response/loading/success/error/empty states (when applicable)

1. Pre-response:
   1. active question message is already visible before the user interacts
2. Loading:
   1. no separate loading UI is introduced; callback handling remains inline and server-driven
3. Success:
   1. `single` advances immediately to the next question or completion
   2. `multiple` toggle updates refresh the same message keyboard
   3. valid `multiple` submit advances to the next question or completion
   4. valid custom text advances to the next question or completion
4. Error:
   1. empty `multiple` submit answers with `Сначала выберите хотя бы один вариант`
   2. non-text custom input answers with a user-facing error and keeps waiting
   3. whitespace-only custom text answers with a user-facing error and keeps waiting
   4. stale callbacks answer with `Нельзя изменить ответ на уже пройденный вопрос`
5. Empty:
   1. not applicable beyond the explicit empty-selection submit error path

### 5.3 M3 — Admin API, validation, and reporting contracts

#### 5.3.1 Depends on

1. Depends on: M1, M2

#### 5.3.2 Scope

1. Contracts consumed:
   1. step, option, answer, and run-state contracts from M1
   2. final runtime persistence semantics from M2
2. Contract sync:
   1. confirm final save payload shape for steps and options
   2. confirm final answer snapshot shape for multi-select and custom-answer reporting
   3. confirm runtime semantics for stale callbacks and waiting-for-text states so admin reporting stays consistent
3. Backend/API behavior to implement:
   1. extend funnel create/update/read schemas for `selectionMode` and option `kind`
   2. enforce builder edit guards server-side:
      1. at most one custom option per question
      2. reject `selectionMode` changes for questions that already have answers
   3. keep structural validation strict for activation and campaign linkage
   4. expose enough structural validity signal in funnel API responses so campaigns UI can block clearly before save when an already-known funnel is invalid
4. Reporting/query behavior to implement:
   1. results aggregation counts each selected option for `multiple`
   2. results aggregation counts custom-option selection without splitting by free-text value
   3. respondent detail groups multiple selected options under one question
   4. respondent detail includes full stored custom text
   5. mixed historical wording remains snapshot-driven after later edits
5. Explicitly excluded:
   1. parser execution in the browser draft state
   2. campaign copy interaction UI
   3. visual component composition

#### 5.3.3 Acceptance criteria

1. Funnel CRUD payloads and read DTOs fully describe advanced questionnaire inputs without hidden defaults.
2. Saving a question with multiple custom options is rejected.
3. Changing `selectionMode` on a question that already has answers is rejected.
4. Campaign consumers can determine that a selected funnel is structurally invalid before they attempt save.
5. Results and respondent detail remain readable and deterministic for:
   1. multi-select answers
   2. custom text answers
   3. pre-edit versus post-edit question wording

#### 5.3.4 Verification

1. `pnpm --filter @tg-channel-stats/backend test:run -- routes/sales-bot.test.ts`
2. `pnpm --filter @tg-channel-stats/backend test:run -- domain/sales-bot/funnels.test.ts`
3. `pnpm --filter @tg-channel-stats/backend test:run -- domain/sales-bot/campaigns.test.ts`
4. `pnpm --filter @tg-channel-stats/backend test:run -- schemas/sales-bot.test.ts`
5. `pnpm -s typecheck`

#### 5.3.5 Consumer surfaces impacted

1. Backend funnel and campaign routes
2. Backend reporting and respondent-detail queries
3. Web hooks and normalizers that consume funnel, run, and campaign data

#### 5.3.6 Pre-response/loading/success/error/empty states (when applicable)

1. Pre-response:
   1. existing funnel and campaign data loads as usual
2. Loading:
   1. route handlers remain request-response without new async background stages
3. Success:
   1. funnel reads expose advanced-input structure and structural validity data
   2. result and respondent reads expose the new answer model in a display-ready form
4. Error:
   1. invalid advanced-input payloads fail validation
   2. invalid structural campaign linkage is surfaced as a clear API error instead of a generic save failure
5. Empty:
   1. results with no responses still return zero-count structures for defined questions and options
   2. respondent detail with no answers stays empty without throwing

### 5.4 M4 — Web builder, campaigns, and respondents UI

#### 5.4.1 Depends on

1. Depends on: M3

#### 5.4.2 Scope

1. Contracts consumed:
   1. advanced funnel DTOs from M3
   2. structural validity signal for campaign entry funnels from M3
   3. results/respondent detail DTOs from M3
2. Contract sync:
   1. confirm final draft-to-payload mapping for `selectionMode` and option `kind`
   2. confirm final result and respondent detail payload shapes before rendering
3. Builder UX to implement:
   1. replace single-line question input with multiline `textarea`
   2. show `3000` character validation feedback for question text
   3. add per-question selection mode control
   4. add custom-answer option creation with single-custom guard
   5. add draft-only parser textarea and parse action
   6. parser UX must:
      1. be available only when there are no questions
      2. generate draft questions and options without saving automatically
      3. show actionable parse errors
4. Campaign UX to implement:
   1. explicit success or failure feedback after copy-link action
   2. earlier, clearer entry-funnel invalidity messaging using the structural validity data from M3
5. Respondents and results UI to implement:
   1. display multi-select answers as one question with the full selected-option list
   2. display custom-answer text in respondent detail
   3. render aggregate counts correctly for multi-select and custom-option usage
6. Explicitly excluded:
   1. unrelated Sales Bot section redesign
   2. changes to deep-link slug rules
   3. changes to entry-template campaigns

#### 5.4.3 Acceptance criteria

1. Admin can author multiline question text and see validation before save.
2. Admin can set `single` or `multiple` mode per question in the builder.
3. Admin can add at most one custom-answer option per question.
4. Parser creates draft questionnaire content from valid plain text only when the questionnaire is empty.
5. Parser errors are specific enough to fix malformed input without guessing.
6. Campaign copy action shows explicit success or failure feedback.
7. Campaign UI blocks an already-known invalid entry funnel before save and explains why.
8. Respondents and results UI render the new answer model without collapsing multi-select or custom-answer data.

#### 5.4.4 Verification

1. `pnpm --filter @tg-channel-stats/web test:run -- components/sales-bot/sections/FunnelsSection.test.tsx`
2. `pnpm --filter @tg-channel-stats/web test:run -- components/sales-bot/sections/CampaignsSection.test.tsx`
3. `pnpm --filter @tg-channel-stats/web test:run -- hooks/sales-bot/normalize.test.ts`
4. `pnpm --filter @tg-channel-stats/web test:run`
5. `pnpm -s typecheck`

#### 5.4.5 Consumer surfaces impacted

1. Sales Bot funnels builder UI
2. Sales Bot campaigns UI
3. Sales Bot respondents and results panes

#### 5.4.6 Pre-response/loading/success/error/empty states (when applicable)

1. Pre-response:
   1. existing funnel and campaign data load before editing begins
2. Loading:
   1. builder and campaign save buttons reflect in-flight save state
   2. copy-link action shows in-place status once the clipboard attempt resolves
3. Success:
   1. parse success populates draft questions and options without saving
   2. copy success shows an affirmative status message
   3. valid save reflects the new questionnaire structure after refresh
4. Error:
   1. question text over `3000` is shown as validation feedback
   2. parser syntax errors are shown inline with enough detail to fix the input
   3. duplicate custom-option attempts are blocked with a clear message
   4. invalid campaign entry funnel selection is shown before save
   5. copy failure shows a clear failure status message
5. Empty:
   1. empty questionnaire shows the existing no-questions state plus parser entry point
   2. empty respondents/results states remain informative when a funnel has no responses yet

### 5.5 M5 — Regression coverage and repo verification

#### 5.5.1 Depends on

1. Depends on: M1, M2, M3, M4

#### 5.5.2 Scope

1. Contracts consumed:
   1. final database schema from M1
   2. final runtime semantics from M2
   3. final admin/reporting contracts from M3
   4. final web UX from M4
2. Contract sync:
   1. review all touched backend and web tests to ensure they assert the final chosen behavior rather than an earlier intermediate shape
3. Coverage to add or update:
   1. schema and payload validation tests for new step and option fields
   2. migration-sensitive tests or assertions where schema uniqueness changed
   3. backend runtime tests for:
      1. empty multi-select submit
      2. toggle then submit flow
      3. custom-answer valid text
      4. non-text custom-answer input followed by valid text
      5. whitespace-only custom-answer input
      6. stale callback after the run already advanced
      7. waiting-for-text interception before inbox routing
   4. backend reporting tests for:
      1. respondent-detail rendering of multiple selected options
      2. custom text visibility in respondent detail
      3. aggregate counts for custom-option selections
   5. web tests for:
      1. parser success and failure
      2. multiline question editing and validation
      3. custom-option editing guard
      4. campaign copy feedback
      5. earlier invalid-funnel blocking
4. Final repo verification:
   1. run targeted package tests while implementing
   2. run full repo quality gates at the end

#### 5.5.3 Acceptance criteria

1. The advanced questionnaire flow is covered end-to-end across database, backend, and web layers.
2. All fixed product messages and state transitions introduced by this task are locked by regression tests.
3. Repo-wide quality gates pass after the implementation is complete.

#### 5.5.4 Verification

1. `pnpm --filter @tg-channel-stats/backend test:run`
2. `pnpm --filter @tg-channel-stats/web test:run`
3. `pnpm -s test:run`
4. `pnpm qc`

#### 5.5.5 Consumer surfaces impacted

1. Automated verification for database, backend, and web packages
2. Act-stage implementation confidence for advanced questionnaire delivery

#### 5.5.6 Pre-response/loading/success/error/empty states (when applicable)

1. Not applicable for end-user loading states in this milestone.

### 5.6 M6 — Fix parser draft-only scope regression

#### 5.6.1 Depends on

1. Depends on: M4, M5

#### 5.6.2 What changes now

1. Restrict questionnaire plain-text parser availability so it is shown only when:
   1. funnel status is `draft`
   2. questionnaire is empty
2. Restrict parser execution so it rejects non-draft funnels even if they have zero questions.
3. Add regression coverage proving:
   1. parser remains available for empty draft funnels
   2. parser is unavailable or rejected for empty `active` funnels
   3. parser is unavailable or rejected for empty `archived` funnels

#### 5.6.3 What must remain true

1. Parser behavior remains draft-only, web-only, and plain-text only.
2. Parser may run only when the questionnaire is empty.
3. Parser syntax remains unchanged:
   1. `* ` opens a new question
   2. `- ` adds an option to the current question
   3. blank lines may be ignored
   4. leading indentation is ignored via `trimStart`
   5. parsed questions default to `single`
   6. parsed options default to `preset`
4. Parser stays fail-fast on malformed input.
5. Parser still generates draft questions and options without saving automatically.
6. Existing M4 UX for multiline editing, selection mode, custom-option guard, campaign copy feedback, and invalid-funnel blocking remains unchanged.

#### 5.6.4 Verification

1. `pnpm --filter @tg-channel-stats/web test:run -- components/sales-bot/sections/FunnelsSection.test.tsx`
2. `pnpm --filter @tg-channel-stats/web test:run`
3. `pnpm -s typecheck`
4. `pnpm qc`

## 6. Execution order (derived from dependencies)

1. Execute M1 first to replace the single-answer data model with contracts that can represent `single`, `multiple`, `custom`, and transient current-step state.
2. Execute M2 after M1 so runtime callback flow and inbound text routing can rely on the new persistence contracts.
3. Execute M3 after M1 and M2 so admin routes, validation, analytics, and respondent detail are defined against the final runtime answer model.
4. Execute M4 after M3 so builder, campaign, respondents, and results UI consume stable DTOs and structural-validity signals instead of transient intermediate shapes.
5. Execute M5 last to expand regression coverage around the final behavior and then run repo gates.
6. Execute M6 after M5 to narrow the parser back to empty draft funnels only and lock the rule with regression coverage.

## Orchestration (managed by orchestrator)

| Milestone | Status | Commits |
| --- | --- | --- |
| M1 — Contracts and persistence foundation | done | `93c90a8` |
| M2 — Runtime answering and webhook routing | done | `a3318a8`, `3c86273`, `32b8ebe` |
| M3 — Admin API, validation, and reporting contracts | done | `f49d332`, `844c39d` |
| M4 — Web builder, campaigns, and respondents UI | done | `716d4af`, `321d4b2` |
| M5 — Regression coverage and repo verification | done | `a854908` |
| M6 — Fix parser draft-only scope regression | done | `fcfd050` |
| Reviewer | done | |
