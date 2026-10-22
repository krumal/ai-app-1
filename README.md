# LocalTasks

Task tracker with a kanban board that reads local repository files from `.tasks/`.

## Stack

1. Bun for the backend API and dev orchestration
2. Vite + React + TypeScript for the frontend
3. Local JSON config in `~/.config/localtasks/config.json`

## Run

1. Install dependencies:

   ```bash
   bun install
   ```

2. Start frontend and backend together:

   ```bash
   bun dev
   ```

3. Open [http://127.0.0.1:5173](http://127.0.0.1:5173)

## Local access and file safety

LocalTasks is a single-user local application, not a public hosted service.
The API binds to `127.0.0.1`; HTTP and WebSocket requests reject non-local
hosts and unrelated browser origins. The frontend uses the Vite proxy on
port 5173, which now fails explicitly if that port is occupied. Wildcard
CORS is not enabled. Do not expose either server through a public proxy
without a separate authentication layer; local processes remain trusted.

Task directory names must be one directory name inside the selected repository.
Task roots, nested directories and files must not be symbolic links. This also
applies to `labels.json`, estimate files and AI input files. These checks prevent
following existing links; they are not a sandbox against a hostile local process
concurrently replacing filesystem paths.

AI digest and estimates still send their selected text to the configured model
provider only when requested. Use them only with data you may share with that
provider; these changes do not make that transmission local or redact secrets.

## Test worlds

Generate local development worlds under `.local/worlds/<name>`:

```bash
bun run world:create -- --preset rich --name dev-rich --clean
```

Useful presets:

1. `smoke` creates a tiny board for quick checks.
2. `rich` creates realistic tasks, incidents, reports, nested files, tables, and code blocks.
3. `edge` creates long names, sparse tasks, non-markdown files, and nested content.
4. `large` creates a bigger board for scroll and performance checks.

Use `--seed <number>` for deterministic output. Add `--register` only when you want the generated world to become the active project in `~/.config/localtasks/config.json`.

`--name` accepts a plain directory name, not a path. `--clean` replaces only
an existing generated world with a matching `.localtasks-world.json` marker;
it refuses symbolic links, other targets, and unmarked directories. Older worlds
without that marker are not removed automatically: use a new world name instead.

## Verify

```bash
bun test
bun run check
bun run build
```

## Data model

1. One project equals one repository.
2. Each project points to a `.tasks` folder inside that repository.
3. Root `task-*` directories are shown in the `Tasks` list.
4. Other root directories inside `.tasks` become separate lists such as `Incidents` or `Reports`.
5. Each card shows the file tree of its folder, and clicking a file opens a rendered markdown preview inside the card.

## Config file shape

```json
{
  "version": 1,
  "activeProjectId": "tg-channel-stats",
  "projects": [
    {
      "id": "tg-channel-stats",
      "name": "tg-channel-stats",
      "repoPath": "/Users/timurkhakhalev/dev/personal/tg-channel-stats",
      "taskDirName": ".tasks",
      "listOrder": ["tasks", "incidents"]
    }
  ]
}
```
