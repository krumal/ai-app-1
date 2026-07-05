Status: done

Milestone: M1 - Contracts and dependency setup

Summary:
- Added first-version shared realtime WebSocket protocol types in `shared/types.ts`.
- Added `chokidar` as a runtime dependency and updated `bun.lock`.

Preserved constraints/invariants:
- Protocol payloads use project/card/file relative path fields only and do not expose absolute filesystem paths.
- No fallback polling contract, event bus abstraction, runtime WebSocket behavior, or product behavior was introduced in M1.
- Existing `FileContentResponse` and `BoardResponse` contracts are reused for update events.

Issues encountered:
- None.

Verification:
- `bun add chokidar` completed successfully and saved the lockfile.
- `bun run check` passed: `tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.server.json`.

Commits:
- 13df2a2 (M1: add realtime contracts)

---

Status: done

Milestone: M2 - Backend realtime service

Summary:
- Added `/ws` WebSocket upgrade handling in `server/index.ts` and a focused `server/realtime.ts` service.
- Implemented `connection:ready`, subscribe/unsubscribe validation, subscription cleanup, chokidar watcher lifecycle, debounced exact-file broadcasts, `file:updated`, `file:deleted`, and `subscription:error`.
- Added backend realtime tests covering invalid messages/projects/paths, exact subscription filtering, unreadable/deleted events, watcher release, disconnect cleanup, and a Bun WebSocket `connection:ready` smoke test.

Preserved constraints/invariants:
- Subscriptions are scoped by `projectId`, `cardRelativePath`, and `fileRelativePath`.
- Unsafe subscription path errors do not echo absolute/traversal paths back to clients.
- Realtime event path fields remain relative; board payload root fields are sanitized for WebSocket messages.
- Watchers are one per subscribed project task root and are closed when the final project subscription is removed.
- No polling fallback, frontend behavior, documentation update, or product UI change was introduced in M2.

Issues encountered:
- Added board payload sanitization after verifying the existing `BoardResponse` shape contains absolute root metadata over HTTP.
- Adjusted tests to cover the `board: null` deleted-file branch when board refresh is unavailable.

Verification:
- `bun test server` passed: 53 tests, 0 failures.
- `bun run check` passed: `tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.server.json`.

Commits:
- 8b29dbe (M2: add backend realtime service)

---

Status: done

Milestone: M3 - Frontend realtime integration

Summary:
- Added `src/useTaskRealtime.ts` for a single WebSocket connection per active card modal/component tree, subscribe/unsubscribe messages, quiet bounded-backoff reconnect, resubscribe on reconnect, and stale event filtering.
- Wired card modal realtime events into existing file and board state: reading mode applies `file:updated`, edit mode preserves textarea text and shows `File changed on disk` with `Reload from disk`, and deleted/unreadable files show a file-level error pane.
- Added Vite `/ws` proxy configuration and compact styling for the disk-change warning.

Preserved constraints/invariants:
- The frontend subscribes only when project, card, and selected file are present.
- File changes, modal close, and unmount unsubscribe the previous file subscription.
- Stale events that do not match the active project/card/file are ignored before they reach UI state.
- Edit mode never overwrites unsaved editor text automatically.
- No global board realtime behavior, collaborative editing, polling fallback, or connection-status chrome was introduced.

Issues encountered:
- A fresh `bun dev` attempt could not bind 3001/5173 because an existing matching dev stack was already running; manual verification used the existing `http://127.0.0.1:5173` frontend and `http://127.0.0.1:3001` API.
- Playwright role lookup did not match the localized edit/reload controls reliably, so manual verification used stable class selectors for those existing controls.

Verification:
- `bun test` passed: 53 tests, 0 failures.
- `bun run check` passed: `tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.server.json`.
- Manual Playwright verification against the running app passed:
  - reading-mode external file edit updated preview content
  - edit-mode external file edit showed `File changed on disk` and preserved unsaved textarea text
  - `Reload from disk` replaced editor text with the latest disk payload
  - switching files ignored updates from the previously subscribed file
  - deleting the subscribed file showed the file-level deleted/unreadable error pane

Commits:
- fcf3e44 (M3: integrate frontend realtime updates)

---

Status: done

Milestone: M4 - Documentation and final verification

Summary:
- Updated memory-bank architecture docs with the `/ws` WebSocket flow, watcher lifecycle, exact-file filtering, realtime message behavior, sanitized board payload note, and user-visible states.
- Added a product user story for realtime opened-file updates, edit-mode disk conflict handling, reload from disk, file switch unsubscribe/stale guards, and deleted/unreadable file errors.
- Updated the memory-bank index to mention realtime opened-file updates.

Preserved constraints/invariants:
- Documentation describes WebSocket-only realtime behavior without polling fallback, global board realtime, collaborative editing, or connection-status chrome.
- Documentation keeps protocol scope to the currently opened task file subscription.
- Existing unrelated worktree changes and orchestrator-owned `plan.md` edits were not touched.

Simplification pass:
- Reviewed `server/realtime.ts`, `src/useTaskRealtime.ts`, and card modal wiring.
- No code simplification changes were needed: watcher lifecycle remains local to `server/realtime.ts`, browser WebSocket state remains local to the hook, subscriptions are not duplicated into a broader event bus, and no speculative fallback path exists.

Issues encountered:
- None.

Verification:
- `bun test` passed: 53 tests, 0 failures.
- `bun run check` passed: `tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.server.json`.
- `bun run build` passed: Vite client build and Bun server bundle completed successfully.
- Manual Playwright smoke verification against the running app passed:
  - realtime preview update for an externally changed subscribed file
  - edit-mode conflict warning plus `Reload from disk`
  - file switch stale guard for previous subscription
  - deleted subscribed file error state

Commits:
- c05297b (M4: document realtime updates)

---

Status: done

Milestone: M5 - Reviewer fix: sanitize errors and add frontend regressions

Summary:
- Changed unexpected backend realtime subscription-validation failures to return generic `subscription:error` message `Realtime subscription failed.` while preserving normalized relative subscription scope.
- Added backend regression coverage for an injected absolute-path failure to prove no filesystem path leaks through `subscription:error.message`.
- Extracted the frontend WebSocket lifecycle into `TaskRealtimeClient` and kept `useTaskRealtime` as a thin React wrapper.
- Added frontend regression tests for subscribe/unsubscribe on file change, reconnect resubscribe, stale event filtering, and edit-mode disk update preservation/reload behavior.

Preserved constraints/invariants:
- Existing specific invalid message/project/path/unsupported/system-file validation behavior remains intact.
- Realtime remains WebSocket-only with no polling fallback, global board realtime, collaborative editing, or connection-status chrome.
- `file:updated` still includes file payload and sanitized board payload.
- Edit mode still does not overwrite unsaved editor text automatically.

Issues encountered:
- Initial frontend tests under `src` were included by the app TypeScript config without Bun test types, so they were moved to `frontend-tests/` and continue to run under `bun test`.
- The fake WebSocket initially started as open, which duplicated pre-open subscribe sends in tests; the fake now starts closed until `open()` is triggered.

Verification:
- `bun test server` passed: 54 tests, 0 failures.
- `bun test` passed: 59 tests, 0 failures.
- `bun run check` passed: `tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.server.json`.
- `bun run build` passed: Vite client build and Bun server bundle completed successfully.

Commits:
- 567542f (M5: sanitize realtime errors and add frontend regressions)
