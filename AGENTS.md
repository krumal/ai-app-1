# LocalTasks

LocalTasks — локальный task tracker для работы с задачами прямо внутри репозиториев.
Приложение читает папку `.tasks` выбранного проекта, строит kanban-доску из директорий и файлов,
показывает дерево файлов карточки и рендерит markdown-превью выбранных файлов.

## Технический стек

- Bun — backend API, dev orchestration и сборка серверной части.
- Vite + React + TypeScript — frontend-приложение.
- Tailwind CSS — стили интерфейса.
- React Markdown + remark-gfm — markdown-рендеринг с поддержкой GitHub Flavored Markdown.
- Локальный JSON-конфиг — список проектов и активный проект хранятся в `~/.config/localtasks/config.json`.
- Файловая модель данных — задачи, списки, labels и содержимое карточек читаются и записываются в `.tasks` внутри подключенных репозиториев.

## Knowledge Base

Knowledge base по проекту находится в `.memory-bank/index.md`. В каждой папке внутри memory bank будет index.md. Обязательно читай его прежде чем попасть в нужную тебе папку.

## Основные команды

- `bun install` — установить зависимости.
- `bun dev` — запустить frontend и backend вместе.
- `bun run dev:web` — запустить только Vite frontend.
- `bun run dev:server` — запустить только Bun API.
- `bun run check` — проверить TypeScript.
- `bun run build` — собрать frontend и backend.
- `bun run world:create -- --preset rich --name dev-rich --clean` — создать локальный тестовый мир в `.local/worlds`.
