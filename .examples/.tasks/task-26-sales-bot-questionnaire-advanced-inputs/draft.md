# Task-26 — Sales Bot questionnaire advanced inputs and voting modes (Draft)

Status: draft (agreed scope, ready to turn into execution plan)

## 1. Context

1. The current Sales Bot funnel model is a linear questionnaire with ordered questions and ordered answer options.
2. The current implementation is still limited in three important ways:
   1. question text is edited in the admin UI as a single-line field
   2. questionnaire authoring is fully manual and does not support bulk parsing from plain text
   3. runtime answers are single-choice only and callback-driven
3. The current runtime also routes incoming free-form user text into inbox handling instead of questionnaire answer handling.
4. Campaign save can currently fail with `Campaign entry funnel must include at least one step` when the linked funnel is structurally invalid in persisted state.

## 2. Product Goal

1. Make questionnaire authoring faster for admins who already have the survey written as text.
2. Support both single-choice and multi-choice questions in Telegram questionnaire runtime.
3. Support a custom answer flow where the user can type their own answer when a dedicated option is selected.
4. Preserve simple linear progression and explicit answer finalization rules so the runtime remains predictable.

## 3. Requested Changes

1. In the funnel builder:
   1. support multiline question text
   2. enforce a `3000` character limit for question text
   3. add a parser input where the admin can paste questionnaire text and convert it into draft questions and options
   4. add per-question selection mode:
      1. `radio`
      2. `checkbox`
   5. allow adding a dedicated `custom answer` option
2. In campaign UX:
   1. show feedback after copying the deep-link
   2. fail earlier and more clearly when the selected funnel is structurally invalid
3. In Telegram runtime:
   1. `radio` questions keep one-answer behavior
   2. `checkbox` questions allow selecting multiple options before explicit submit
   3. `custom answer` prompts the user to type free text
   4. once a question is already completed and the run has advanced, the user cannot change that answer anymore

## 4. Fixed Product Decisions

1. Do not introduce fallbacks or backward compatibility unless explicitly requested by the user.
2. Questionnaire progression remains linear:
   1. no branching
   2. no per-answer routing
   3. no skipping between arbitrary questions
3. The questionnaire parser is intentionally simple:
   1. input format is plain text only
   2. a line starting with `* ` opens a new question
   3. a line starting with `- ` adds an option to the current question
   4. blank lines are separators and may be ignored
   5. leading indentation is ignored by applying `trimStart` before syntax checks
   6. parser syntax does not include `radio` or `checkbox` markers
   7. parsed questions default to `radio`
4. `checkbox` runtime behavior is:
   1. clicking an option toggles it inside the current pending selection
   2. selected options are rendered with `✅`
   3. the inline keyboard is updated after each toggle
   4. the last button is always `➡️ Проголосовать`
   5. the answer is finalized only after `➡️ Проголосовать`
   6. pressing `➡️ Проголосовать` with no selected options must not advance the run and must show a user-facing error
5. `radio` runtime behavior is:
   1. one click immediately finalizes the answer for the current question
   2. once the run advances, old message callbacks must not alter stored answers
6. Re-voting rules are strict:
   1. while a `checkbox` question is still pending, the user may change selection freely
   2. after a question is completed and the run has advanced, the user may not change that answer
   3. clicking an old message for an already completed question must answer callback query with a user-facing message that the answer can no longer be changed
7. `custom answer` behavior is:
   1. it is represented by an explicit option in the question
   2. clicking it sends `Введите ваш вариант ответа`
   3. the run enters a state waiting for the next user text message
   4. `custom answer` is mutually exclusive with all other options in the same question
   5. the next user text message is captured as the answer for that question
   6. only text messages are accepted in this state
   7. if the user sends anything other than text, runtime shows an error and keeps waiting for text
   8. custom answer text is truncated to the first `1000` characters
   9. text is validated after trimming surrounding whitespace
   10. whitespace-only text is rejected with an error and runtime keeps waiting for text
   11. if the user clicks another option before sending text, waiting-for-text state is canceled
8. Historical answer edits are not supported:
   1. no retroactive answer replacement after the question is completed
   2. no reopening prior steps
9. Parser application rules are strict:
   1. parser may run only when the questionnaire is empty
   2. parser output replaces nothing because there must be no existing questions
   3. parser must fail fast when used on a non-empty questionnaire
10. Statistics and respondent detail rules are:
   1. aggregate statistics increment the `custom answer` option count
   2. respondent detail must display the full entered custom text
   3. multi-select answers must be displayed in respondent detail as one question with the full list of selected options
   4. aggregate statistics do not split custom answers by unique entered text
11. Migration policy for this task is explicit:
   1. current questionnaire data may be discarded
   2. backward-compatible migration of existing test data is not required
12. Builder editing guards are strict:
   1. only one `custom answer` option may exist in a question
   2. if a `custom answer` option already exists, the add button for another one must be blocked
   3. changing `selectionMode` after a question already has answers is not allowed
13. Product copy is fixed for this task:
   1. submit button text is `➡️ Проголосовать`
   2. custom-answer prompt text is `Введите ваш вариант ответа`
   3. stale callback message is `Нельзя изменить ответ на уже пройденный вопрос`
   4. empty multi-select submit message is `Сначала выберите хотя бы один вариант`

## 5. Domain Changes

### 5.1 Question model

1. Each question must support:
   1. `questionText`
   2. `selectionMode`
   3. ordered options
2. `selectionMode` values are:
   1. `single`
   2. `multiple`
3. Question text must preserve line breaks and be limited to `3000` characters.

### 5.2 Option model

1. Each option must support:
   1. display text
   2. order index
   3. option kind
2. Option kind must distinguish:
   1. regular preset option
   2. custom-answer option
3. A question may have at most one custom-answer option.

### 5.3 Answer model

1. The current one-row-per-step answer model is insufficient for `multiple` and `custom answer`.
2. The new runtime model must support:
   1. one preset option for `single`
   2. multiple preset options for `multiple`
   3. typed custom text when the chosen option is custom-answer
3. Analytics and respondent detail must remain readable after future text edits.
4. Custom-answer text must be stored in a form that preserves the full entered text shown in respondent detail, subject to the `1000` character cap.

### 5.4 Runtime state model

1. Runtime needs explicit transient state for unfinished steps:
   1. pending multi-select choices before submit
   2. waiting for custom free-text input
2. This state must be cancelable when the user chooses another valid path inside the current question.
3. No extra recovery action is required for questionnaire edits while waiting for custom text in this task.

### 5.5 Recommended architecture

1. The parser is a web-only draft transformation layer:
   1. it converts pasted plain text into draft questions/options in the builder
   2. it does not change persisted backend state until normal funnel save
2. The persisted answer model should use one final answer row per selected option instead of one row per step:
   1. `single` questions persist one answer row
   2. `multiple` questions persist one answer row per selected option
   3. `custom answer` persists one answer row for the custom option plus the captured custom-text snapshot
3. Transient questionnaire interaction state should live on the funnel run itself rather than in a separate table:
   1. store current pending step interaction state in `sales_bot_funnel_runs`
   2. the state may represent pending multi-select choices or waiting-for-text custom-answer mode
   3. only the current active step may have transient state
4. Callback protocol should distinguish interaction intent explicitly:
   1. option toggle/select action
   2. submit-current-step action for `checkbox`
5. Runtime text handling must check active questionnaire state before inbox routing:
   1. if the active run is waiting for custom text, inbound user text is consumed by questionnaire runtime
   2. otherwise inbound user text follows the existing inbox flow
6. Stale callbacks for already completed questions are read-only outcomes:
   1. no persisted state mutation
   2. no resend of next question
   3. no resend of completion outcome
   4. callback-query message only

## 6. Admin API and UI Scope

1. Funnel builder UI must be extended to:
   1. replace single-line question field with `textarea`
   2. show question length validation for `3000`
   3. expose selection mode toggle per question
   4. support adding a custom-answer option
   5. provide parser textarea plus parse action
2. Parser UX must:
   1. produce draft questions and options without immediately saving
   2. show parse errors with enough detail to fix malformed input
   3. reject malformed questionnaire text instead of guessing
   4. be available only when the questionnaire is empty
   5. operate independently from persisted backend schema changes until the admin explicitly saves the funnel
3. Campaign UI must:
   1. show copy success or failure feedback
   2. guard against saving campaigns with invalid entry funnel structure

## 7. Runtime Scope

1. Delivery for `single` questions remains callback-button based.
2. Delivery for `multiple` questions must re-render the same message keyboard with current selection markers and submit button.
3. Delivery for `custom answer` must:
   1. send the question options as usual
   2. on custom option click, prompt for text
   3. interpret the next inbound user text as questionnaire input instead of inbox message
   4. reject non-text inbound messages with an error while still waiting for text
   5. keep only the first `1000` characters of the entered text
4. Runtime must reject stale callbacks from already completed questions with a clear callback-query message and no data mutation.
5. Runtime must not resend the next question or completion outcome when handling stale callbacks from already completed questions.
6. Runtime finalization must clearly separate transient interaction state from persisted final answers:
   1. toggling multi-select options updates only transient run state
   2. `➡️ Проголосовать` writes final answer rows and advances the run
   3. choosing `custom answer` enters waiting-for-text state before any final answer is persisted

## 8. Analytics and Integrity Requirements

1. Structural validation still applies before activation or campaign linkage:
   1. at least one question
   2. each question has non-empty text
   3. each question has at least one answer option
   4. each answer option has non-empty text
2. Historical reporting must remain readable:
   1. preserve answer snapshots for preset options
   2. preserve entered text for custom answers
3. Multi-select analytics must count:
   1. one answered run per completed question
   2. per-option selections across runs
4. Custom-answer analytics must count selections of the custom-answer option without breaking entered texts into per-text aggregate buckets.
5. Campaign save errors around invalid funnels should be prevented as early as practical in the admin UI.

## 9. Non-goals

1. Syntax for declaring `checkbox` or `radio` inside the plain-text parser input.
2. Re-voting after the run has advanced past a question.
3. Branching or conditional questionnaire logic.
4. Free-form arbitrary parser grammar beyond `* question` and `- option`.
5. Migrating or preserving current test questionnaire data.
6. Reworking unrelated Sales Bot areas such as broadcasts, inbox workflows outside custom-answer interception, or publisher flows.

## 10. Implementation Sketch

1. Start with low-risk UX fixes:
   1. multiline question field
   2. `3000` character validation
   3. copy-link feedback
   4. clearer invalid-funnel guard in campaigns
2. Add parser support in builder as a draft-only transformation layer that is available only for empty questionnaires.
3. Redesign funnel question, option, answer, and transient runtime contracts for:
   1. `single`
   2. `multiple`
   3. `custom answer`
4. Persist transient current-step interaction state on funnel runs instead of introducing a separate pending-state table.
5. Extend Telegram runtime:
   1. toggle pending multi-select state
   2. submit finalized multi-select answer
   3. wait for typed custom text
   4. cancel waiting-for-text when another option is chosen
   5. reject non-text messages while waiting for custom text
   6. reject whitespace-only custom text while waiting for custom text
   7. reject empty multi-select submit while preserving current pending selection
   8. reject stale callbacks on completed questions with a callback-query message and no resend side effects
6. Change answer persistence so final stored answers are represented as one row per selected option, with custom-text snapshot support for the custom option.
7. Route inbound user text through questionnaire runtime first when a run is explicitly waiting for custom text, and only fall back to inbox handling otherwise.
8. Rework respondent detail and analytics to match the new answer model.
9. Skip migration work for current data and treat existing questionnaire data as disposable test data.
10. Lock all new behavior with backend and web regression tests before implementation is considered complete, including:
   1. empty multi-select submit
   2. non-text custom-answer input followed by valid text
   3. whitespace-only custom-answer input
   4. stale callback after the run already advanced
   5. respondent-detail rendering of multiple selected options
