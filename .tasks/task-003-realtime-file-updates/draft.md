# Real-time File Updates (Draft)

## 1. Goal

Add real-time updates for files opened inside a task card modal. When a watched task file changes on disk, LocalTasks should update the currently opened file preview without requiring a manual reload.

The first version should use WebSockets and only deliver updates for files that are currently opened in a card modal in the browser tab.

## 2. Scope

- Add a typed real-time protocol shared by frontend and backend.
- Add a WebSocket endpoint to the Bun API server.
- Add backend watcher management for project `.tasks` roots.
- Watch the active project's task root and filter file-system events by active file subscriptions.
- Use one WebSocket connection per browser tab and multiplex file subscribe/unsubscribe messages through it.
- Let the frontend subscribe when a card modal is open and a file is selected.
- Let the frontend unsubscribe when the selected file changes, the card modal closes, the project changes, or the WebSocket closes.
- Reconnect the WebSocket quietly with bounded backoff after transient disconnects.
- Push an update only when the changed file matches an active subscription.
- Include both the refreshed file payload and refreshed board payload in successful file update events.
- Debounce file-system events before reading and broadcasting file contents.
- Keep existing HTTP file open and file save flows working.
- Add user-facing handling for external disk changes while the opened file is in edit mode.
- Add tests for real-time subscription filtering, path safety, event payload shaping, and edit-conflict behavior.
- Update project memory-bank documentation for the new real-time data flow.

## 3. Non-goals

- No collaborative multi-user editing.
- No CRDT, operational transform, merge UI, or conflict resolution beyond warning the local editor user.
- No realtime updates for every task on the board when no card/file is open.
- No global board live-refresh for unrelated file changes.
- No realtime notifications for unopened files.
- No binary file preview support.
- No persistence of real-time subscription state across browser reloads.
- No fallback polling path.

## 4. Constraints and fixed decisions

- Use WebSockets for the realtime transport.
- Use one watcher per active project task root in the first version.
- The watcher observes `<repo>/<taskDirName>` and the backend filters events against active file subscriptions.
- A subscription is scoped to:
  - `projectId`
  - `cardRelativePath`
  - `fileRelativePath`
- The backend must validate all subscription paths against the project task root and must not allow paths outside `.tasks`.
- The backend must not broadcast raw file-system paths to clients.
- The backend should debounce watcher events before reading files and rebuilding the board.
- The event for a changed open file should include:
  - project id
  - card relative path
  - file relative path
  - refreshed `FileContentResponse`
  - refreshed `BoardResponse`
- If the selected file is not in edit mode, the UI should automatically update the preview and board state.
- If the selected file is in edit mode, the UI must not replace editor contents automatically. It should show that the file changed on disk and offer a reload action while allowing the user to keep editing.
- If the currently open file is deleted or becomes unreadable, the UI should show a clear file-level error state and refresh board state when possible.
- Realtime behavior must be idempotent for changes caused by LocalTasks itself through the existing save endpoint.
- Use `chokidar` as the watcher implementation and add it as a project dependency.
- Use one WebSocket connection per browser tab, not one connection per file.
- Define the first protocol with these message types:
  - client to server: `subscribe:file`, `unsubscribe:file`
  - server to client: `file:updated`, `file:deleted`, `subscription:error`, `connection:ready`
- If the WebSocket disconnects unexpectedly, the frontend should reconnect quietly with bounded backoff and resubscribe to the currently open file after reconnect.
- File changes caused by LocalTasks' own HTTP save flow may produce watcher echo events. The first version should handle these idempotently by accepting the repeated update instead of adding request-id echo suppression.

## 5. User journey / user-visible behavior

1. The user opens LocalTasks and selects a project.
2. The user opens a task card modal.
3. The user opens a markdown or text file in that card.
4. The browser subscribes to realtime updates for exactly that selected file.
5. The same file is changed on disk by an editor, script, git operation, or another local tool.
6. The backend receives the file-system event, debounces it, validates that the changed path matches an active subscription, reads the file, rebuilds the board, and sends a WebSocket event to matching clients.
7. If the user is reading the file, the visible preview updates automatically and card metadata such as timestamps, labels, and file tree state refresh with the board.
8. If the user is editing the file in LocalTasks, the editor text remains unchanged and the UI shows that a newer disk version exists.
9. The edit warning should use concise wording like `File changed on disk` and provide a `Reload from disk` action.
10. The user can reload the disk version into the editor or continue editing the current local text.
11. If the open file is deleted or becomes unreadable, the preview area shows a clear file-level error pane with the affected file path and the board refreshes when possible.
12. When the user switches to another file, closes the modal, or changes project, the previous file subscription is removed.

## 6. Testing expectations

- Unit tests for subscription registry behavior:
  - subscribe and unsubscribe by socket/client
  - filter events to matching `projectId` and `fileRelativePath`
  - do not notify unrelated cards, files, projects, or closed subscriptions
- Unit tests for path validation:
  - reject `..` traversal
  - reject absolute paths
  - reject system files that existing file APIs reject
- Backend tests for event shaping:
  - changed subscribed file returns `file:updated` with file payload and board payload
  - deleted or unreadable subscribed file returns a file-level error/deleted event without crashing the server
  - repeated watcher events are debounced
  - LocalTasks save echo events remain idempotent
- Frontend tests for realtime state handling:
  - non-edit preview updates automatically
  - edit mode preserves current editor content and shows disk-change warning
  - switching files sends a new subscription and ignores stale events
  - reconnect resubscribes to the currently open file
- Add an integration-style WebSocket test if Bun's test environment supports it cleanly. If that becomes brittle, keep WebSocket transport thin and cover the realtime module directly with unit tests.
- Existing checks must continue to pass with `bun run check`.

## 7. Documentation updates

- Update `.memory-bank/architecture/c4.md` with the WebSocket container/data-flow path.
- Update `.memory-bank/product/user-stories.md` with a new user story for realtime opened-file updates.
- Update `.memory-bank/index.md` if the architecture or product table of contents needs a mention of realtime updates.

## 8. Acceptance criteria

- Opening a file in a card modal subscribes only to that file.
- Changing that same file on disk updates the open preview without manual reload.
- Changing another file in the same task does not replace the currently open file preview.
- Changing a file in another task or project does not notify this open file subscription.
- Closing the modal or switching files stops updates for the previous selected file.
- Realtime update events refresh both file content and board metadata.
- In edit mode, external changes never overwrite unsaved editor text automatically.
- In edit mode, external changes are visible through a clear warning and a reload action.
- Deleted or unreadable open files show a clear file-level error pane instead of silently keeping stale content.
- Temporary WebSocket disconnects reconnect quietly and resubscribe to the current open file.
- LocalTasks' own save-triggered watcher echo does not create duplicate visible disruption.
- Path traversal attempts in realtime subscription messages are rejected.
- The server cleans up subscriptions when a WebSocket disconnects.
- The implementation has focused backend and frontend test coverage for the realtime contract.
- `bun run check` passes.

## 9. Open questions resolved during brainstorming

- Conflict while editing: show a warning and do not replace editor content automatically.
- Realtime payload: send refreshed file payload together with refreshed board payload.
- Watcher scope: use one watcher for the active project's `.tasks` root and filter events by active file subscriptions.
- Reconnect behavior: reconnect quietly with bounded backoff and resubscribe to the currently open file.
- Deleted or unreadable file behavior: show a clear file-level error pane with the affected path and refresh board state when possible.
- Local save echo behavior: accept watcher echo updates idempotently in the first version.
- Watcher dependency: use `chokidar`.
- Protocol shape: use `subscribe:file`, `unsubscribe:file`, `file:updated`, `file:deleted`, `subscription:error`, and `connection:ready`.
- WebSocket connection model: one connection per browser tab.
- Edit warning wording: use concise copy such as `File changed on disk` with a `Reload from disk` action.
- WebSocket testing depth: add an integration-style WebSocket test only if Bun supports it cleanly; otherwise keep transport thin and unit-test the realtime module.

## 10. Notes for planning

- A small `server/realtime.ts` module is likely the right place for subscription registry, watcher lifecycle, path matching, debounce, and event creation.
- A small frontend hook such as `useTaskRealtime` is likely the right place for WebSocket lifecycle, subscribe/unsubscribe messages, reconnect behavior, and stale-event guards.
- Shared WebSocket message types should live in `shared/types.ts` to keep client and server protocol aligned.
- The server startup code currently passes `apiHandler` directly to `Bun.serve`; planning should account for Bun's WebSocket upgrade API without disrupting existing HTTP routes.
- Existing `readProjectFile`, `buildBoard`, and path-safety helpers should be reused instead of duplicating file read logic.
- The current package does not include a watcher dependency. Planning should add `chokidar` and include the lockfile update.
