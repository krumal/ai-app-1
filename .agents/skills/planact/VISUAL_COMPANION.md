# Goal

1. Resolve UI decisions during Brainstorming by showing real comparable mockups or user-visible states.
2. Collect related visual decisions in one browser session.
3. Keep product decisions with the user and the Brainstorming process with the orchestrator.

# When To Use

Use Visual Companion only during Brainstorming and only when the user needs to see the decision:

1. alternative layouts in the real application shell
2. alternative user flows or navigation structures
3. default, loading, empty, error, success, popover, panel, or modal states
4. hierarchy, density, grouping, or interaction choices that prose cannot represent reliably

Do not use it for textual scope, API or data contracts, architecture choices without UI, simple yes/no questions, or choices that have no meaningfully different screen state.

# Task Directory Gate

1. Before spawning the worker, resolve the task folder from the request, repository conventions, or existing task numbering.
2. If the folder does not exist, create it before Visual Companion starts.
3. Session setup must not create or modify `draft.md`, `plan.md`, placeholder task files, a task branch, or commits. The orchestrator integrates submitted answers into `draft.md` during Brainstorming.
4. Keep the session under `<task-folder>/.planact/visual-companion/<session-id>/`.

# High-Level Flow

1. The orchestrator confirms that the current questions include one or more genuine visual decisions.
2. The orchestrator creates or resolves the task folder.
3. The orchestrator spawns `visual_companion_worker` with one coherent batch.
4. The worker inspects the existing interface and relevant components before designing variants.
5. The worker starts the local server, creates one self-contained HTML preview per option, writes `state/session.json`, and verifies every preview URL.
6. The worker returns the session URL and artifact paths.
7. The orchestrator gives the user the URL and runs the watcher.
8. The user selects and submits decisions in the browser.
9. The orchestrator integrates the submitted answers into `draft.md` and identifies any remaining Brainstorming questions.
10. Continue Brainstorming under `BRAINSTORM.md`; the visual session does not start planning or implementation.

# Storage Contract

The companion is strictly local: `--host` and `--url-host` accept only loopback
addresses (`127.0.0.1`, `localhost`, `::1`). Non-local values fail at startup.
Host/Origin checks reject unrelated browser requests, and mutation requests
require a matching Origin. It is not a publicly authenticated service; do not
publish it through an external proxy without a separate access design.
New session files are private to their owner. Preview HTML is served under a
sandbox policy without scripts or external resources, including direct opens.
Use self-contained HTML/CSS mockups; an isolated preview cannot call the
companion API. Filesystem links are not accepted as preview files.

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
    ├── <decision>-<option>.html
    └── ...
```

1. Every preview is a self-contained HTML document with inline CSS and no network dependency.
2. Runtime files are temporary and must never be committed.
3. Do not reuse an old text-question session after this visual-decision cutover.

# Orchestrator Input Contract

Pass:

1. `task_folder`
2. `ui_language`
3. `session_title`
4. `session_intro`
5. `product_context`
6. `visual_decisions`
7. `completion_rule`
8. `return_format`

Each visual decision must describe the user-visible decision, known product context, relevant route or component when discoverable, required states, and 2-3 materially different options. Do not provide prewritten text cards as a substitute for mockups.

Recommended payload:

```json
{
  "task_folder": "/abs/path/to/task-folder",
  "ui_language": "ru",
  "session_title": "Brainstorming: onboarding flow",
  "session_intro": "Сравните варианты интерфейса и выберите направление.",
  "product_context": {
    "repository_root": "/abs/path/to/repo",
    "current_surface": "Existing account onboarding",
    "relevant_paths": ["apps/web/src/routes/onboarding.tsx"]
  },
  "completion_rule": "all_required_decisions_answered",
  "return_format": "structured_json_plus_summary",
  "visual_decisions": [
    {
      "id": "journey_shape",
      "title": "Основной сценарий onboarding",
      "description": "Сравните два варианта в текущем shell приложения.",
      "required": true,
      "allow_free_text": true,
      "type": "single_choice",
      "required_states": ["default", "validation error", "success"],
      "options": [
        {
          "id": "wizard",
          "label": "Пошаговый wizard",
          "description": "Один смысловой шаг на экран"
        },
        {
          "id": "single_page",
          "label": "Одна страница",
          "description": "Все поля и результат в одном потоке"
        }
      ]
    }
  ]
}
```

# Worker Output Session Contract

The worker converts `visual_decisions` into `state/session.json`:

```json
{
  "session_title": "Brainstorming: onboarding flow",
  "session_intro": "Сравните варианты интерфейса и выберите направление.",
  "ui_language": "ru",
  "completion_rule": "all_required_decisions_answered",
  "decisions": [
    {
      "id": "journey_shape",
      "title": "Основной сценарий onboarding",
      "description": "Сравните варианты ниже.",
      "type": "single_choice",
      "required": true,
      "allow_free_text": true,
      "options": [
        {
          "id": "wizard",
          "label": "Пошаговый wizard",
          "description": "Один смысловой шаг на экран",
          "preview_file": "journey_shape-wizard.html"
        },
        {
          "id": "single_page",
          "label": "Одна страница",
          "description": "Все поля и результат в одном потоке",
          "preview_file": "journey_shape-single_page.html"
        }
      ]
    }
  ]
}
```

# Mockup Quality Contract

1. Inspect the current app shell, routes, components, tokens, labels, density, and interaction patterns before authoring previews.
2. Make options directly comparable:
   1. use the same viewport and application shell
   2. use the same realistic product data and terminology
   3. show the same required states
   4. change only the decision being compared
3. Render product UI, not explanatory cards:
   1. include recognizable application chrome and content hierarchy
   2. show controls, content, status, and feedback where they exist in the proposed state
   3. keep explanation outside the mockup in option label/description
4. A preview that is only prose, a question, a list of pros/cons, or a renamed option card is invalid.
5. If the worker cannot produce meaningful visual differences, it must return `not_visual` so the orchestrator asks the decision in chat.
6. Before returning `session_prepared`, verify that every `preview_file` exists, is served successfully, and contains a rendered product surface.

# Interaction And Completion

1. Each decision requires at least one selected visual option before submit and supports an optional note.
2. The page shows session instructions, progress, required state, and completion state.
3. Default completion rule: `all_required_decisions_answered`.
4. Write `completed.json` only when every required decision has a meaningful submitted answer.
5. The worker never submits decisions or writes `answers.json`/`completed.json` on the user's behalf.

# Worker Return Contract

Return only:

1. `status`: `session_prepared`, `not_visual`, or `error`
2. URL when prepared
3. session, answers, completed, and server-info paths
4. watcher command
5. one short instruction for the orchestrator

# Orchestrator Rules

1. Put all currently known related visual decisions into one session.
2. Use the chat language for the session UI.
3. Run `scripts/wait-for-visual-companion.sh` as the orchestrator after showing the URL.
4. Use returned answers to update `draft.md` as part of Brainstorming.
5. Do not let Visual Companion start Plan or implementation.
