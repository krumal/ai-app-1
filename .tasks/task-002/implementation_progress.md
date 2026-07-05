# AI Scrum Poker estimate — Milestone 1

## Что сделано

- Добавлены shared-типы для оценки в [`shared/types.ts`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/shared/types.ts):
  - `EstimateParticipantRole`
  - `EstimateVote`
  - `TaskEstimate`
  - `GenerateEstimateRequest`
  - `GenerateEstimateResponse`
- Реализован модуль чистой серверной логики оценок в [`server/estimate.ts`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/server/estimate.ts):
  - валидация ролей участников и оценок
  - нормализация результатов после `Promise.allSettled`
  - расчет median и average (со округлением до 1 знака)
  - проверка минимального числа валидных голосов (минимум 3)
  - конструирование описания решения
  - безопасные `read`/`write` helperы для `estimate.json` в карточках задач
- Добавлены unit-тесты в [`server/estimate.test.ts`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/server/estimate.test.ts):
  - валидные/невалидные голоса
  - нормализация settled-результатов с отбрасыванием падений/невалидного контента
  - median (в т.ч. upper-middle на чётном числе)
  - average c точностью до 1 знака после запятой
  - сборка и сохранение `TaskEstimate`
  - проверка `estimate.json` read/write и безопасная обработка `..`

## Проблемы и решения

- Первично в `buildEstimateExplanation` случайно остался лишний `return`; исправил до одного финального возвращаемого значения.
- При первом черновике набросал неиспользуемый внутренний helper и лишнюю структуру; удалил, чтобы не захламлять модуль и не расширять API сверх нужного.

## Результат milestone 1

- Внутренний контракт по AI-оценке и детерминированной обработке голосов готов; можно переходить к milestone 2 (интеграция с board и системным файлом `estimate.json`).

## Milestone 2. Board integration and system-file safety

## Что сделано

- Расширил контракт карточки в [`shared/types.ts`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/shared/types.ts):
  - `BoardCard` теперь содержит поля `estimate`, `estimateEligible`, `estimateIneligibleReason`.
- Внедрил систему оценки на уровне доски в [`server/board.ts`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/server/board.ts):
  - добавлен `getCardEstimateEligibility(...)` как переиспользуемый helper для проверки условия оценки;
  - добавлены причины невалидности:
    - `Only task folders can be estimated.`
    - `Only Tasks list cards can be estimated.`
    - `Only root task cards can be estimated.`
    - `Task estimate requires task-* folder naming.`
    - `Task estimate requires draft.md.`
    - `Task estimate requires plan.md.`
  - для папок карточек теперь рассчитываются `estimate`, `estimateEligible`, `estimateIneligibleReason`;
  - для file-карточек фиксированные значения: `estimate = null`, `estimateEligible = false`, причина по типу.
- Добавил скрытие системного файла на уровне board:
  - корневой `estimate.json` не формирует `misc` карточку;
  - `estimate.json` не включается в `buildFileTree`;
  - `defaultOpenFilePath` и `createdAt/updatedAt` теперь считаются только по обычным файлам карточки (без `estimate.json`).
- Защитил чтение/запись файлов:
  - `readProjectFile` и `writeProjectFile` теперь отклоняют обращения к `estimate.json` с сообщением про системное управление.
- Добавил тесты в [`server/board.test.ts`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/server/board.test.ts):
  - проверка eligibility-правил;
  - чтение сохранённой оценки в `card.estimate`;
  - скрытие `estimate.json` из дерева и пути дефолтного открытия;
  - проверка, что `updatedAt` не зависит от `estimate.json`;
  - проверка блокировки редакторных read/write для `estimate.json`.

## Проблемы и решения

- При разборе milestone 2 нужно было аккуратно избежать дублирования путей: если добавлять `estimateIgnoredPaths` только на уровне корня карточки без учета вложенных каталогов, `estimate.json` мог пробиться в дерево при вложенных структурах. Решение — передавать единый `Set` относительных путей в рекурсивный `buildFileTree`.
- В первом проходе `isCardFilePresent` не был `await`-нут, что делало eligibility заведомо истиной при наличии файла. Исправлено на явный `await`.

## Результат milestone 2

- Базовая интеграция с board и системной безопасностью выполнена:
  - estimate-информация пробрасывается в `BoardCard`,
  - `estimate.json` исключён из user-facing представления карточки и временных метрик,
  - read/write редакторные роуты блокируют прямую работу с `estimate.json`.

## Milestone 3. Digest exclusion

## Что сделано

- В [`server/digest.ts`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/server/digest.ts) добавлена жёсткая фильтрация `estimate.json` при сборе путей для AI digest:
  - на уровне task-карточек (`tasks`) список доступных файлов также исключает `estimate.json` даже если путь вдруг окажется в `FileTreeNode`;
  - на уровне общих карточек (`group/misc`) сбор текстовых файлов теперь фильтрует системный файл по basename.
- Обновлена логика проверки и тестов для исключения влияния системного файла на digest:
  - подтверждено, что изменение только `estimate.json` не поднимает `updatedAt` карточки в digest-preview;
  - подтверждено, что изменение обычного содержимого (`plan.md`) по-прежнему попадает в выборку digest;
  - подтверждено, что `includedFilePaths` digest не содержит `estimate.json`;
  - подтверждено, что в промпт генерации digest не утекает содержимое `estimate.json`.

## Проблемы и решения

- Во время правок пришлось аккуратно подстраховать фильтрацию для двух ветвей:
  - для `tasks`-карточек мы продолжаем целенаправленно собирать `plan.md`/`implementation_progress.md`, а не весь tree;
  - для остальных карточек фильтрация вынесена в общий guard по `basename`, чтобы случайно вложенный `estimate.json` тоже не прошёл.
- Для проверки контекста digest пришлось мокировать `createOpenAIClient` из `server/ai/openai` через `mock.module`, чтобы тестировать содержимое prompt без внешнего API-запроса.

## Результат milestone 3

- Защита от загрязнения digest системой `estimate.json` реализована полностью:
  - на выборке карточек по `updatedAt`,
  - на уровне списка файлов,
  - и в передаваемом в OpenAI контексте.

## Milestone 4. Estimate generation API

## Что сделано

- Добавлена генерация оценок в [`server/estimate.ts`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/server/estimate.ts):
  - константы участников и разрешённых story points вынесены в общий модуль;
  - реализован парсинг ответов участника и нормализация с ролью;
  - добавлен читатель обязательных файлов `draft.md` и `plan.md` + optional `implementation_progress.md`;
  - реализован `generateEstimate(...)`, который запускает 5 participant-запросов через OpenAI через `Promise.allSettled`, фильтрует валидные голоса и строит `TaskEstimate`.
- Добавлен API-роут в [`server/index.ts`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/server/index.ts):
  - `POST /api/projects/:id/estimate`;
  - валидация project / `cardRelativePath`;
  - проверка в board-данных `estimateEligible`;
  - чтение контекста карточки из `.tasks` (через безопасный резолв `resolveInsideRoot`);
  - сохранение `estimate.json` только после успешной генерации;
  - возврат свежих `{ ok: true, estimate, board }` с пересобранным board.
- Для тестируемости добавлен экспортируемый обработчик `apiHandler` и выключаемый запуск сервера по `LOCALTASKS_SKIP_SERVER=1`.
- Добавлены API-тесты в [`server/estimate.api.test.ts`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/server/estimate.api.test.ts):
  - успешная генерация при 5 валидных голосах;
  - успешный сценарий при 3 валидных + 2 сбоях;
  - провал при <3 валидных голосах;
  - не затирание существующей оценки при неуспехе;
  - защита от path traversal через `cardRelativePath`.

## Проблемы и решения

- В `generateEstimate` нужно было разделить этап чтения файлов и сборки голосов: иначе при отсутствии `implementation_progress.md` запросы зависали на ошибках чтения обязательных файлов. Решение — обязателен только `draft.md` + `plan.md`, `implementation_progress.md` опционален.
- В `index.ts` при добавлении нового обработчика пришлось аккуратно сохранить существующий роутинг и не дублировать валидацию доски; решение — переиспользовать `findBoardCard` и `buildBoard(project)` перед запуском генерации.
- Для тестов важным оказалось полностью исключить автозапуск `Bun.serve` во время unit-ранов; добавлен `LOCALTASKS_SKIP_SERVER` guard и прямые вызовы `apiHandler`.
- В `server/estimate.api.test.ts` часть тестов брала `projectId` как `config.projects[0]`. При наличии bootstrap-конфига в `~/.config/localtasks/config.json` это приводило к `404 Card ... not found` — запрос уходил в чужой проект. Решение: брать `config.activeProjectId` после `addProject`, так как он всегда указывает на созданный/актуальный проект.

## Результат milestone 4

- Реализован backend API для генерации/перегенерации оценки:
  - генерация идёт только для eligible карточек;
  - OpenAI-участники отрабатывают в `Promise.allSettled`;
  - `estimate.json` сохраняется только при успешном расчёте;
  - при ошибке ответ не затрагивает предыдущую оценку;
  - и после успеха возвращается свежая доска, включая `estimate` на карточке.

## Milestone 5. Task modal UI

## Что сделано

- Добавлен типизированный клиент в [`src/api.ts`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/src/api.ts):
  - `generateEstimate(projectId, { cardRelativePath })`.
- Обновлён `App.tsx`:
  - добавлены состояния для запроса оценки и открытия поповера решения (`estimateActionState`, `estimateLogOpen`);
  - добавлен обработчик `handleEstimateGenerate(...)`, который вызывает API и заменяет `boardState` свежими данными из ответа;
  - при открытии/закрытии карточки и смене активной карточки сбрасываются состояния оценки.
- `CardModal` расширен UI для оценок:
  - для `eligible` карточек показывается кнопка `Generate estimate`/`Regenerate estimate`;
  - для карточек с существующей оценкой показывается компактный бейдж `N pts`;
  - из бейджа открывается popover с детальной информацией:
    - финальный `storyPoints`, `median`, `average`;
    - объяснение решения;
    - участники, их голоса и причины;
    - список источников.
  - добавлены состояния загрузки и ошибки генерации, чтобы показать пользователю результат и не терять предыдущую сохранённую оценку при ошибке.
- Обновлены стили в [`src/styles.css`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/src/styles.css):
  - блок действий оценки в модалке карты;
  - badge для оценки;
  - поповер решения с секциями и списком голосов.

## Проблемы и решения

- На этапе интеграции Tailwind сборка упала на неизвестных utility-классах (`gap-0.2`, `gap-0.75`) в новых стилях поповера. Исправил их на валидные `gap-2`.
- Коротко проверил UX поповера: после успешной генерации всегда обновляю board из ответа API, чтобы бейдж и данные оценки появлялись без перезагрузки.

## Результат milestone 5

- UI-модалка задачи теперь полностью закрывает milestone 5:
  - можно запустить оценку для eligible задач;
  - видно бейдж и финальные данные оценки;
  - видно решение (median/average, голоса, объяснение, источники);
  - ошибки видны и не ломают уже сохранённую оценку;
  - после успеха обновлённый `boardState` сразу отражает результат в открытой карточке без перезагрузки.

## Milestone 6. Финальная проверка, документация и чистка

## Что сделано

- Обновлена архитектурная документация в [`/memory-bank/architecture/c4.md`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/.memory-bank/architecture/c4.md): добавлен маршрут `POST /api/projects/:id/estimate`, модуль `server/estimate.ts` и сквозной data flow Scrum Poker оценки.
- Обновлена пользовательская память в [`/memory-bank/product/user-stories.md`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/.memory-bank/product/user-stories.md): добавлен сценарий оценки задачи с eligibility, генерацией/регенерацией и popover-логом решения.
- Обновлен [`/memory-bank/index.md`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/.memory-bank/index.md): добавлены ссылки/упоминания по оценкам.
- Пройдено ручное ревью измененных участков: системные файлы (`estimate.json`) закрыты для редактирования как file API, не влияют на digest и не ломают доску.

## Проблемы и решения

- В процессе документации нужно было аккуратно встроить estimate-расширение в уже существующий C4 narrative без расширения в противоречивые описания. Решено добавлять точечные пункты в L2/L3 и data flow.
- Для `implementation_progress.md` в milestone 6 не требовалось новых технических рисков; основной контроль был в корректности статей/ссылок и последовательности milestone-описания.

## Результат milestone 6

- Подтверждено: AI Scrum Poker estimation интегрирован во все ключевые места и отражён в памяти проекта.
- Подтверждено завершением финальной проверки: `bun run check`, `bun test` (36 passed), `bun run build`.

## Post-review fixes

## Что исправлено

- Исправлена изоляция API-тестов: [`server/config.ts`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/server/config.ts) теперь вычисляет путь к `~/.config/localtasks/config.json` лениво на каждый вызов, поэтому `process.env.HOME` из теста применяется корректно даже если модуль был импортирован раньше.
- В [`server/estimate.api.test.ts`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/server/estimate.api.test.ts) добавлена регрессия: `getConfigPath()` должен указывать в temp HOME теста.
- Первичная фильтрация системного файла была усилена в [`server/board.ts`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/server/board.ts), но последующее ревью уточнило, что глобальная резервация basename `estimate.json` слишком широкая. Это исправлено в следующем post-review блоке.
- В [`server/board.test.ts`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/server/board.test.ts) были добавлены регрессии на системный файл; затем они уточнены под root task-only модель.
- Очищен реальный локальный конфиг от 40 тестовых записей `Estimate API Project`, которые были созданы старой версией теста. После повторного запуска API-теста новых записей не появляется.

## Проверка после ревью

- `bun test server/board.test.ts server/estimate.api.test.ts server/config.test.ts` — pass.
- `bun test` — pass, 38 tests.
- `bun run check` — pass.
- `bun run build` — pass.
- Повторный запуск `bun test server/estimate.api.test.ts` не добавляет `Estimate API Project` в настоящий `~/.config/localtasks/config.json`.

## Second post-review fixes

## Что исправлено

- Уточнен scope системного `estimate.json`: системным считается только путь вида `task-*/estimate.json` в корне task card. Файлы `.tasks/estimate.json`, `reports/estimate.json` и `task-*/nested/estimate.json` снова остаются обычными пользовательскими файлами.
- В [`server/board.ts`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/server/board.ts) добавлены root task-only predicates для board tree, чтения estimate metadata и file read/write защиты.
- Ошибка отсутствующего `OPENAI_API_KEY` в [`server/ai/openai.ts`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/server/ai/openai.ts) стала feature-neutral: `OPENAI_API_KEY is required to use AI features.`
- [`server/estimate.ts`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/server/estimate.ts) теперь переиспользует `DIGEST_MODEL` из OpenAI-модуля вместо собственного hardcode модели.
- Добавлены endpoint-level тесты в [`server/estimate.api.test.ts`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/server/estimate.api.test.ts) для ineligible карточек: task без `plan.md`, misc file и grouped task folder.
- Добавлен [`server/openai.test.ts`](/Users/timurkhakhalev/dev/courses/demo/tasktracker/server/openai.test.ts) для feature-neutral ошибки API key.

## Проверка после второго ревью

- `bun test server/board.test.ts server/estimate.api.test.ts server/openai.test.ts` — pass.
- `bun test` — pass, 44 tests.
- `bun run check` — pass.
- `bun run build` — pass.
