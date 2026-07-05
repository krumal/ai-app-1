# Real-time File Updates (Implementation Plan)

## 1. Scope (what to implement)

Implement WebSocket-based realtime updates for the file currently opened inside a task card modal. The browser tab keeps one WebSocket connection, subscribes to the selected file, and receives updates only for that file. When the subscribed file changes on disk, the server sends refreshed file content plus refreshed board metadata. Reading mode updates automatically. Edit mode preserves unsaved editor text and shows a disk-change warning with a reload action.

In scope:

- Shared realtime protocol types.
- `chokidar` dependency and lockfile update.
- Bun WebSocket upgrade route.
- Backend subscription registry, watcher lifecycle, debounce, path safety, event shaping, and disconnect cleanup.
- Frontend WebSocket hook with quiet bounded-backoff reconnect and current-file resubscription.
- Card modal integration for automatic preview updates, stale-event guards, edit-mode warning, and deleted/unreadable file error state.
- Focused backend and frontend tests plus `bun run check`.
- Memory-bank documentation updates for realtime architecture and user story.

Out of scope:

- Collaborative editing, CRDT/OT, merge UI, global board live-refresh, polling fallback, binary preview support, and persisted subscription state across page reloads.

## 2. Fixed decisions (must follow)

- Do not introduce fallbacks or backward compatibility unless explicitly requested by the user.
- Use WebSockets for realtime transport.
- Use one WebSocket connection per browser tab, not one connection per open file.
- Use `chokidar` as the watcher implementation.
- Use one watcher per active project task root and filter watcher events against active subscriptions.
- A subscription is scoped by `projectId`, `cardRelativePath`, and `fileRelativePath`.
- Validate realtime subscription paths against the project task root; reject traversal, absolute paths, and system files rejected by existing file APIs.
- Do not broadcast raw absolute filesystem paths to clients.
- Debounce watcher events before reading file contents and rebuilding the board.
- Successful file update events include refreshed `FileContentResponse` and refreshed `BoardResponse`.
- The first client-to-server messages are `subscribe:file` and `unsubscribe:file`.
- The first server-to-client messages are `connection:ready`, `file:updated`, `file:deleted`, and `subscription:error`.
- Unexpected WebSocket disconnects reconnect quietly with bounded backoff and resubscribe to the currently open file.
- LocalTasks' own HTTP save flow may trigger watcher echo events; accept repeated updates idempotently instead of adding request-id suppression.
- Edit mode must never overwrite unsaved editor text automatically after an external disk change.
- The edit warning copy should be concise: `File changed on disk` with a `Reload from disk` action.
- Deleted or unreadable subscribed files show a clear file-level error pane with the affected relative path and refresh board state when possible.

## 3. Milestone rules (dependencies)

- Milestones run sequentially.
- Contract changes happen before backend and frontend consumers.
- Backend realtime behavior depends on shared protocol types and the watcher dependency.
- Frontend integration depends on stable shared protocol types and backend event semantics.
- Documentation and final verification happen after implementation surfaces are in place.

## 4. Milestone index

| ID | Name | Depends on | Notes |
| --- | --- | --- | --- |
| M1 | Contracts and dependency setup | none | Add shared protocol types and `chokidar`. |
| M2 | Backend realtime service | M1 | Add WebSocket route, subscriptions, watcher filtering, debounce, and backend tests. |
| M3 | Frontend realtime integration | M2 | Add hook, card modal integration, edit-conflict UX, and frontend tests. |
| M4 | Documentation and final verification | M3 | Update memory bank, run full checks, and simplify any rough edges. |
| M5 | Reviewer fix: sanitize errors and add frontend regressions | M4 | Address reviewer-blocking findings before rerun. |

## 5. Milestone details

### 5.1 M1 — Contracts and dependency setup

#### 5.1.1 Depends on

Depends on: none

#### 5.1.2 Scope

Contracts produced/changed:

- Add shared realtime protocol types to `shared/types.ts`.
- Add message types for `subscribe:file`, `unsubscribe:file`, `connection:ready`, `file:updated`, `file:deleted`, and `subscription:error`.
- Add typed payload shapes for file subscriptions, file update events, deleted/unreadable events, and subscription errors.
- Add `chokidar` to `dependencies` and update the Bun lockfile.

Contracts consumed:

- Existing `FileContentResponse`, `BoardResponse`, `ProjectConfig`, and project/task file path conventions.

Implementation notes:

- Keep message DTOs small and serializable.
- Use relative paths only in protocol payloads.
- Do not add generic event-bus abstractions beyond what the realtime implementation needs.

#### 5.1.3 Acceptance criteria

- Shared types compile and describe all first-version realtime messages.
- `chokidar` is installed as a runtime dependency.
- No product behavior changes yet.
- No fallback polling contract is introduced.

#### 5.1.4 Verification

1. Run `bun install` if adding the dependency does not update the lockfile automatically.
2. Run `bun run check`.

#### 5.1.5 Consumer surfaces impacted

- Backend imports shared realtime message types.
- Frontend imports shared realtime message types.
- Package dependency metadata changes.

#### 5.1.6 Pre-response/loading/success/error/empty states (when applicable)

Not applicable. This milestone defines contracts only.

### 5.2 M2 — Backend realtime service

#### 5.2.1 Depends on

Depends on: M1

#### 5.2.2 Scope

Contract sync:

- Confirm shared realtime message names and payload shapes before implementation.

Contracts produced/changed:

- Add a WebSocket endpoint, preferably `/ws`, to the Bun server.
- Add backend behavior for:
  - `connection:ready` after a socket opens.
  - `subscribe:file` validation and registration.
  - `unsubscribe:file` removal.
  - `subscription:error` for invalid messages, invalid project ids, unsafe paths, unsupported files, and unreadable subscription targets.
  - `file:updated` with refreshed file and board payloads.
  - `file:deleted` for deleted or unreadable subscribed files, with board payload when it can be rebuilt.

Contracts consumed:

- Shared realtime message types from M1.
- Existing config lookup, project summaries, `readProjectFile`, `buildBoard`, task root resolution, and system-file safety rules.

Implementation notes:

- Create a focused `server/realtime.ts` module for subscription registry, watcher lifecycle, debounce, path matching, and event creation.
- Keep Bun WebSocket upgrade code thin in `server/index.ts`; existing HTTP routes must continue to work.
- Maintain one watcher per project task root while there is at least one subscription for that project.
- Clean up subscriptions and close unused watchers when sockets disconnect or subscriptions are removed.
- Filter watcher events to exact active `fileRelativePath` subscriptions.
- Rebuild board once per debounced file event before broadcasting to matching sockets.
- Accept self-save watcher echo updates idempotently.

Excluded from this milestone:

- Frontend UI behavior.
- Documentation updates.

#### 5.2.3 Acceptance criteria

- WebSocket clients can connect and receive `connection:ready`.
- Invalid realtime messages do not crash the server and produce `subscription:error`.
- Path traversal and absolute paths are rejected.
- Subscriptions notify only matching project/file subscribers.
- Unrelated file changes do not broadcast to the subscribed file.
- Disconnected sockets are removed from the registry.
- Watchers are released when no subscriptions remain for a project.
- Deleted/unreadable subscribed files produce `file:deleted` or a clear subscription/error event without crashing the server.

#### 5.2.4 Verification

1. Run backend-focused tests with `bun test server`.
2. Run `bun run check`.
3. If Bun WebSocket testing is clean, include an integration-style test for connect/subscribe/change/broadcast. If it is brittle, keep WebSocket transport thin and cover `server/realtime.ts` directly with unit tests.

#### 5.2.5 Consumer surfaces impacted

- WebSocket API consumers in the local frontend.
- Existing HTTP API routes via shared `Bun.serve` startup code.
- Local filesystem watcher behavior for connected project task roots.

#### 5.2.6 Pre-response/loading/success/error/empty states (when applicable)

- Pre-response: a socket opens before any subscription exists and receives `connection:ready`.
- Success: subscribed file changes produce `file:updated`.
- Error: invalid message/project/path/read failure produces `subscription:error` or `file:deleted`.
- Empty: no active subscriptions means no broadcasts and no watcher kept alive for that project.

### 5.3 M3 — Frontend realtime integration

#### 5.3.1 Depends on

Depends on: M2

#### 5.3.2 Scope

Contract sync:

- Confirm backend WebSocket endpoint, message names, update payloads, deleted payloads, and error semantics before coding the hook.

Contracts produced/changed:

- Add a frontend realtime hook, such as `src/useTaskRealtime.ts`, that owns:
  - one WebSocket connection per browser tab/component tree
  - subscribe/unsubscribe messages for the current selected file
  - quiet bounded-backoff reconnect
  - resubscribe to the current selected file after reconnect
  - stale-event guards for project/card/file changes
  - callback delivery for updated/deleted/error events
- Extend card modal/file state handling for disk-change warning and reload action in edit mode.

Contracts consumed:

- Shared realtime message types from M1.
- Backend WebSocket behavior from M2.
- Existing `BoardResponse`, `FileContentResponse`, `fetchFile`, `updateFile`, card modal state, and editor state.

Implementation notes:

- Subscribe only when an active project, active card, and selected file exist.
- Unsubscribe when selected file changes, modal closes, project changes, or component unmounts.
- In reading mode, apply `file:updated` by replacing the open file payload and board state.
- In edit mode, keep `editContent` unchanged, store the latest disk payload, and show `File changed on disk` plus `Reload from disk`.
- `Reload from disk` replaces editor content with the latest disk payload and clears the warning.
- For `file:deleted`, show a file-level error pane with the relative path and apply any refreshed board payload.
- Ignore stale events that do not match the currently active project/card/file.
- Avoid visible connection-status chrome unless an error directly affects the open file.

Excluded from this milestone:

- Full collaborative conflict resolution or merge UX.
- Global board realtime updates when no file is open.

#### 5.3.3 Acceptance criteria

- Opening a file subscribes to exactly that file.
- Switching files unsubscribes the previous file and subscribes the new file.
- Closing the modal removes the active subscription.
- Changing the subscribed file on disk updates preview content and board metadata in reading mode.
- Changing another file does not replace the current preview.
- Edit mode external changes never overwrite unsaved editor text.
- Edit mode displays `File changed on disk` and `Reload from disk`.
- `Reload from disk` updates the editor from the newest disk payload.
- Deleted/unreadable subscribed files show a clear file-level error pane.
- Reconnect quietly resubscribes to the current open file.

#### 5.3.4 Verification

1. Run frontend/unit tests available in the repo with `bun test`.
2. Run `bun run check`.
3. Start the app with `bun dev` and manually verify:
   - open a task file, edit it externally, preview updates
   - open a task file in LocalTasks edit mode, edit it externally, warning appears and editor text is preserved
   - switch to another file, external changes to the old file do not update the new preview

#### 5.3.5 Consumer surfaces impacted

- Task card modal.
- File preview pane.
- File editor pane.
- Board/card metadata shown while a card is open.
- Browser WebSocket connection to the local API server.

#### 5.3.6 Pre-response/loading/success/error/empty states (when applicable)

- Pre-response/loading: existing file loading UI remains the source of truth before the first realtime event.
- Success: preview and board metadata update after `file:updated`.
- Error: file-level realtime errors show in the preview/editor area only when they affect the current file.
- Empty: no card/file open means no active subscription and no user-visible realtime UI.

### 5.4 M4 — Documentation and final verification

#### 5.4.1 Depends on

Depends on: M3

#### 5.4.2 Scope

Contract sync:

- Review the final implemented backend/frontend behavior and ensure docs match actual message semantics and user-visible states.

Contracts produced/changed:

- Update `.memory-bank/architecture/c4.md` with WebSocket realtime flow, backend watcher responsibility, and event payload behavior.
- Update `.memory-bank/product/user-stories.md` with a user story for realtime opened-file updates.
- Update `.memory-bank/index.md` if its table of contents should mention realtime updates.

Contracts consumed:

- Final behavior implemented in M2 and M3.

Implementation notes:

- Keep documentation concise and consistent with existing Russian-language memory-bank style.
- Perform a simplification pass over new code:
  - remove duplicated subscription logic
  - keep watcher lifecycle local to the realtime module
  - avoid speculative future abstractions
  - confirm no fallback polling path was added

#### 5.4.3 Acceptance criteria

- Memory-bank architecture describes the WebSocket flow and watcher filtering.
- Product stories include the realtime opened-file update journey and edit-conflict behavior.
- Final implementation follows DRY, KISS, and YAGNI.
- Full TypeScript check passes.
- Relevant automated tests pass.

#### 5.4.4 Verification

1. Run `bun test`.
2. Run `bun run check`.
3. Run `bun run build` if realtime server startup or bundling changed in a way that could affect production build.
4. Manually smoke-test realtime update, edit conflict, file switch unsubscribe, and deleted/unreadable file handling.

#### 5.4.5 Consumer surfaces impacted

- Project memory bank.
- Developer onboarding context for future realtime work.
- Final app runtime.

#### 5.4.6 Pre-response/loading/success/error/empty states (when applicable)

- Documentation must describe reading-mode success, edit-mode conflict warning, deleted/unreadable error state, and empty no-subscription state.

## 6. Execution order (derived from dependencies)

1. M1 — Contracts and dependency setup.
2. M2 — Backend realtime service.
3. M3 — Frontend realtime integration.
4. M4 — Documentation and final verification.
5. M5 — Reviewer fix: sanitize errors and add frontend regressions.

Critical run/test commands:

1. `bun install`
2. `bun test server`
3. `bun test`
4. `bun run check`
5. `bun run build`

### 6.1 M5 — Reviewer fix: sanitize errors and add frontend regressions

#### 6.1.1 Depends on

Depends on: M4

#### 6.1.2 Scope

What changes now:

- Fix the backend realtime error path so unexpected subscription-validation failures cannot leak absolute filesystem paths or raw OS error strings through `subscription:error`.
- Preserve existing specific validation behavior for invalid message shape, invalid project id, invalid/absolute/traversal paths, unsupported files, and system files.
- Add a regression test proving an unexpected backend validation failure returns a generic realtime-safe message without absolute path leakage.
- Add focused frontend realtime regression tests covering the hook/modal contract enough to satisfy the planned frontend test requirement:
  - subscribe/unsubscribe on selected file changes
  - reconnect resubscribe for the current file
  - stale-event filtering for previous files
  - edit-mode disk update preservation/reload behavior or the smallest extracted frontend state helper that drives it
  - deleted-file event handling or the smallest extracted frontend state helper that drives it

What must remain true:

- No polling fallback, collaborative editing, global board realtime, or connection-status chrome.
- One WebSocket connection per active modal/component tree.
- Realtime payloads use relative project/card/file path fields only.
- Successful `file:updated` board payloads remain sanitized for WebSocket use.
- Edit mode never overwrites unsaved editor text automatically.
- The fix must not broaden error handling into backward compatibility shims or dual behavior.

Contracts produced/changed:

- Backend `subscription:error` unexpected-failure semantics become generic and safe.
- Frontend realtime regression tests become part of the repository test suite.

Contracts consumed:

- Existing realtime shared message types.
- Existing `/ws` backend message semantics.
- Existing frontend realtime hook and modal state behavior.

#### 6.1.3 Acceptance criteria

- Injected unexpected backend validation errors cannot expose absolute filesystem paths in `subscription:error.message`.
- Invalid path/traversal/absolute subscription payload tests continue to reject the request without echoing unsafe input.
- Successful `file:updated` payloads still include file and sanitized board payloads.
- Frontend tests cover subscription lifecycle and at least one edit/deleted state path without requiring a browser-only manual check.
- `bun test server`, `bun test`, `bun run check`, and `bun run build` pass.

#### 6.1.4 Verification

1. Run `bun test server`.
2. Run `bun test`.
3. Run `bun run check`.
4. Run `bun run build`.

#### 6.1.5 Consumer surfaces impacted

- Backend realtime subscription error messages.
- Frontend realtime hook/modal regression test coverage.
- Developer confidence in the realtime contract.

#### 6.1.6 Pre-response/loading/success/error/empty states (when applicable)

- Error: unexpected backend validation failures return a generic safe `subscription:error` message.
- Success/empty/loading states remain unchanged from M2/M3.

## Orchestration (managed by orchestrator)

| Milestone | Status | Commits |
| --- | --- | --- |
| M1 — Contracts and dependency setup | done | 13df2a2, 9469cd9 |
| M2 — Backend realtime service | done | 8b29dbe, a1701fc |
| M3 — Frontend realtime integration | done | fcf3e44, d4a9bb5 |
| M4 — Documentation and final verification | done | c05297b, 5a7a82e |
| M5 — Reviewer fix: sanitize errors and add frontend regressions | done | 567542f, 83b2465 |
| Reviewer | done | |
| Code Reviewer | done | |
