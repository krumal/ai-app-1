# Goal

1. Provide a visual companion for `planact` Brainstorming.
2. Collect all related visual questions in one browser session instead of one question per chat turn.
3. Keep user interaction under the orchestrator instead of letting the worker complete the session on the user's behalf.

# When To Use

Use the visual companion only during Brainstorming, and only when the user would understand the decision better by seeing it than by reading it.

Good fits:

1. user journey comparisons
2. layout or flow comparisons
3. visual grouping of multiple related product choices
4. UX direction selection where text alone would be ambiguous

Do not use it for:

1. purely textual scope questions
2. API or contract decisions that are clearer in prose
3. simple yes/no clarifications better handled through `request_user_input`
4. abstract product choices that do not depend on visual layout, hierarchy, or flow

# High-Level Flow

1. The orchestrator decides a visual batch is worth using.
2. The orchestrator spawns `visual_companion_worker`.
3. The worker creates a visual-companion session inside the task folder.
4. The worker starts the local server.
5. The worker writes `session.json` with all visual questions for the batch.
6. The worker returns session details to the orchestrator immediately after the session is ready.
7. The orchestrator gives the user the URL and instructions.
8. The user answers all required questions in the browser UI.
9. The orchestrator runs `scripts/wait-for-visual-companion.sh --session-dir <session_dir>`.
10. The watcher blocks until `completed.json` exists, then prints `answers.json`.
11. The orchestrator reads the answers and integrates them into `draft.md`.

# Task-Folder Storage Contract

Store each session in:

```text
<task-folder>/.planact/visual-companion/<session-id>/
├── state/
│   ├── session.json
│   ├── answers.json
│   ├── status.json
│   ├── completed.json
│   ├── events.jsonl
│   └── server-info.json
└── content/
```

Rules:

1. Keep all artifacts inside the task folder.
2. Do not write companion state to repo-global temp folders when the task folder is known.
3. The worker may reuse the latest unfinished session only when doing so is clearly safer than starting a fresh one.

# Orchestrator -> Worker Input Contract

Pass the worker:

1. `task_folder`
2. `ui_language`
3. `session_title`
4. `session_intro`
5. `ui_brief`
6. `questions`
7. `completion_rule`
8. `return_format`

Recommended payload shape:

```json
{
  "task_folder": "/abs/path/to/task-folder",
  "ui_language": "ru",
  "session_title": "Brainstorming: onboarding flow",
  "session_intro": "Ответь на все визуальные вопросы ниже. После этого я продолжу следующий этап автоматически.",
  "ui_brief": "Compact decision UI, clear grouping, cards for options, no unnecessary chrome.",
  "completion_rule": "all_required_answered",
  "return_format": "structured_json_plus_summary",
  "questions": [
    {
      "id": "journey_shape",
      "title": "Какой сценарий берем?",
      "description": "Выбери основной user flow для новой фичи.",
      "type": "single_choice",
      "required": true,
      "allow_free_text": true,
      "options": [
        {
          "id": "wizard",
          "label": "Wizard",
          "description": "Пошаговый guided flow"
        },
        {
          "id": "sheet",
          "label": "Single sheet",
          "description": "Всё на одном экране"
        }
      ]
    }
  ]
}
```

# UI Contract

The worker must generate one page containing all visual questions in the batch.

Every question must support:

1. localized title and description
2. explicit required/optional state
3. answer options
4. optional free-text note
5. a per-question `Submit` action

The page must also show:

1. session title
2. short intro/instructions
3. progress summary
4. completed-state banner once all required answers are submitted

# Language Rules

1. The interface language must match the language used in the chat with the user.
2. The orchestrator should pass `ui_language` explicitly instead of making the worker infer it.
3. System strings such as `Submit`, `Required`, `Optional note`, and completion banners must be localized by the worker.

# Completion Rules

Default rule: `all_required_answered`

This means:

1. every required question has a submitted answer
2. per-question free text is optional unless the orchestrator explicitly requires it
3. once all required questions are answered, the orchestrator watcher may stop waiting and return

`completed.json` should be written only when the completion rule is satisfied.

# Worker Output Contract

Return:

1. `status`
2. `url`
3. `artifacts`
4. `instructions`

Recommended shape:

```json
{
  "status": "session_prepared",
  "url": "http://localhost:58264",
  "artifacts": {
    "session_dir": "/abs/path/to/session",
    "server_info_file": "/abs/path/to/session/state/server-info.json",
    "answers_file": "/abs/path/to/session/state/answers.json",
    "completed_file": "/abs/path/to/session/state/completed.json",
    "session_file": "/abs/path/to/session/state/session.json",
    "watch_command": "scripts/wait-for-visual-companion.sh --session-dir /abs/path/to/session"
  },
  "instructions": "Show the URL to the user, run the watcher command, then use its output as answers."
}
```

# Worker Responsibilities

1. Start the server using `scripts/start-visual-companion.sh`.
2. Write `state/session.json`.
3. Read `state/server-info.json` and return the URL and file paths to the orchestrator.
4. Include the watcher command for the orchestrator.
5. Stop after the session is ready.
6. Do not watch for completion.
7. Do not make product decisions that the user did not make.
8. Do not continue into planning or implementation.
9. Never answer questions on the user's behalf.
10. Never call `/api/submit-answer`.
11. Never write `answers.json` or `completed.json` directly.

# Implementation Notes

1. Keep this companion focused on the local `planact` workflow and do not add cross-harness guidance here.
2. Prefer `scripts/wait-for-visual-companion.sh` over ad-hoc polling in prompts.
3. The orchestrator, not the worker, owns the interactive wait loop.
