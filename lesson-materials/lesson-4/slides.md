---
theme: default
title: Урок 4. Делаем репозиторий AI-Native
info: |
  Урок 4: подготовка репозитория к AI Coding, AGENTS.md, memory bank, onboarding и quality gates.
class: lesson-4
highlighter: shiki
drawings:
  persist: false
transition: slide-left
layout: default
mdc: true
---

# Урок 4

<div class="mt-10 text-6xl leading-tight">
Делаем репозиторий
<span class="text-blue-500">AI-Native</span>
</div>

<div class="mt-10 grid grid-cols-3 gap-4 text-xl font-bold">
  <div class="chip blue">instructions</div>
  <div class="chip green">memory bank</div>
  <div class="chip orange">feedback loop</div>
</div>

<!--
- Главная идея: агенту нужен не только prompt, а рабочая среда вокруг проекта.
-->

---
class: lesson-4
---

# Почему обычного repo недостаточно

<div class="mt-8 grid grid-cols-[1fr_1fr] gap-7">
  <section class="panel">
    <div class="label">В репозитории</div>
    <ul class="clean-list">
      <li>код</li>
      <li>README</li>
      <li>package scripts</li>
      <li>конфиги</li>
    </ul>
  </section>

  <section class="panel muted">
    <div class="label">В головах разработчиков</div>
    <ul class="clean-list">
      <li>как запускать</li>
      <li>где менять фичу</li>
      <li>что нельзя трогать</li>
      <li>продуктовые нюансы</li>
    </ul>
  </section>
</div>

<!--
- Проблема всех репозиториев в том, что бОльшая часть инфы о проекте не хранится в этом репозитории, а хранится в лучшем случае в jira / confluence, а в худшем - в головах синьоров или переписках в slack / telegram.
- Когда разработчик пытается поставить задачу AI агенту, то он часто представляет, что общается с коллегой, который как и он сам находится на таком же уровне понимания проекта. 
- Много инфы о проекте хранится на подсознательном уровне у разработчика в голове и при постановке задачи бывает сложно определить, какую инфу о проекте агент знает, а какую нет.
- Выход - делать репозиторий AI native – это значит дать в инструкциях к репозиторию всю необходимую информацию или ссылки и инструменты к другим хранилищам этой информации, куда агент смог бы добраться чтобы получить больше контекста о решаемой задаче
-->

---
class: lesson-4
---

# Harness Engineering

<div class="mt-10 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-4 text-center">
  <div class="node blue">человек задаёт рамки</div>
  <div class="arrow">→</div>
  <div class="node green">агент выполняет работу</div>
  <div class="arrow">→</div>
  <div class="node orange">проверки дают feedback</div>
</div>

<div class="mt-12 text-4xl font-bold leading-tight">
Не просто prompt,
а среда для предсказуемой работы.
</div>

<!--
- В феврале OpenAI выпустили хорошую статью которая систематизирует подходы которых я придерживался несколько месяцев до этой статьи
- Называется Harness Engineering
- Суть заключается в том, что человек задаёт направление, правила, ограничения и критерии качества для агента
- А агент выполняет работу внутри этой среды: читает контекст, пишет код, запускает проверки, исправляет ошибки.
-->

---
class: lesson-4
---

# AI Native Repo

```text
AI-Native Repo
├─ AGENTS.md
├─ .memory-bank/
├─ ...
└─ .tasks/
```

<div class="mt-8 text-3xl font-bold">
Это репозиторий, в котором может ориентироваться и агент, и новый разработчик
</div>

<!--
AI-Native repo — Это способ организовать проект так, чтобы в нём смог ориентироваться как агент, так и новый разработчик
-->

---
class: lesson-4
---

# Что существует для агента

<div class="mt-8 grid grid-cols-4 gap-4 text-center text-xl font-bold">
  <div class="tile blue">markdown файлы</div>
  <div class="tile green">API к сервисам</div>
  <div class="tile orange">MCP</div>
  <div class="tile purple">skills</div>
</div>

<div class="mt-12 text-4xl font-bold leading-tight">
Если агент не может это прочитать или получить через tool — он этого не знает
</div>

<!--
Что должно быть доступно для агента?

для агента существует только то, что он может прочитать или получить через tools.

- markdown файлы
- доступ по api к 3rd party services
- mcp
- skills

- Если знание лежит только в голове разработчика или в старом Slack-треде, агент его не знает.
- Наша цель как разраба – сделать проект читаемым.
-->

---
class: lesson-4
---

# AGENTS.md

<div class="mt-7 grid grid-cols-[0.7fr_1.45fr] gap-6">
  <section class="panel compact">
    <div class="mt-5 text-2xl font-bold leading-tight">
      короткий briefing
      для coding agent
    </div>
    <ul class="mt-6 space-y-2 text-xl font-bold opacity-80">
      <li>команды</li>
      <li>правила</li>
      <li>ссылки</li>
      <li>запреты</li>
    </ul>
  </section>

  <section>

```md
### Main commands

By default we're in discussion mode.
Don't apply code changes until I ask you.

- `pnpm qc:wrapped` - run quality checks
- `pnpm dev` - run development server
- `pnpm test:wrapped` - run tests

### Project-specific instructions

- `payloadcms/AGENTS.md` - Payload CMS conventions
- For `develop -> main-ci` release merges:
  always check `git status` and diff before push.

### When work with payloadcms

Use skill [payload](.claude/skills/payloadcms/SKILL.md).

### Posthog

- Use `posthog-cli` for production Posthog data
- `.tasks/` is temporary development context
```

  </section>
</div>

<!--
`AGENTS.md` — md файл который является способом задавать инструкции по проекту.

может содержать инфу:
- базовые инструкции по проекту
- базовые правила при общении с вами
- где искать документацию;
- какие команды использовать;
- правила проверки;
- куда идти за деталями.

- Если правило часто повторяется в задачах, его стоит перенести сюда.
- Агент читает `AGENTS.md` при старте сессии, чтобы понимать контекст проекта без повторного объяснения в каждом промпте.
-->

---
class: lesson-4
---

# Как подключается AGENTS.md

<div class="mt-7 grid grid-cols-[0.86fr_1.14fr] gap-6">
<section>

<div class="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-center text-sm font-bold">
  <div class="node small">~/.codex/ AGENTS.md</div>
  <div class="arrow">→</div>
  <div class="node small">repo/ AGENTS.md</div>
  <div class="arrow">→</div>
  <div class="node small">repo/apps/web/ AGENTS.md</div>
</div>

<div class="mt-7 rounded border border-blue-400/35 bg-blue-500/10 p-4 text-2xl leading-tight">
Пользовательская инструкция
в чате важнее проектных правил.
</div>

<div class="mt-4 rounded border border-green-400/35 bg-green-500/10 p-4">
  <div class="text-sm font-bold uppercase tracking-wide opacity-60">
    Самая полезная форма правил
  </div>
  <div class="mt-3 text-lg leading-snug">
    Конкретные команды и ограничения
  </div>
  <div class="mt-3 flex flex-col items-start gap-2 text-sm font-bold">
    <code>Use pnpm</code>
    <code>Run npm test</code>
    <code>Do not edit migrations</code>
  </div>
</div>

</section>
<section>

```md
# AGENTS.md instructions for /path/to/cwd

<INSTRUCTIONS>
# Global AGENTS.md
...текст global AGENTS...

--- project-doc ---

# Root AGENTS.md
...текст root AGENTS...

# services/payments/AGENTS.md
...текст nested AGENTS...
</INSTRUCTIONS>
```

</section>
</div>

<!--
Инструкции собираются слоями: от глобальных к локальным.

- `~/.codex/AGENTS.md` - Он применяется ко всем проектам пользователя.
- `repo/AGENTS.md`;
- `repo/apps/web/AGENTS.md`;
- Инструкции загружаются при старте сессии
- и склеиваются в один общий блок: сначала глобальные, потом проектные от корня к текущей директории.
-->

---
class: lesson-4 index-slide
---

# Инструкции рядом с кодом

```text
repo/
├─ AGENTS.md
├─ apps/web/AGENTS.md
├─ services/api/AGENTS.md
└─ infra/README.md
```

<div class="mt-8 text-3xl font-bold">
Общие правила в корне, локальные детали рядом с областью кода
</div>

<!--
Часть инструкций может жить рядом с конкретной областью проекта.

- инструкции в папках;
- локальные правила для frontend/backend/infra;
- Корневой файл задаёт общую карту, а локальные инструкции могут уточнять детали.
-->

---
class: lesson-4 memory-bank-slide
---

# Memory Bank

<div class="mt-6 grid grid-cols-[0.84fr_0.86fr] gap-6">
<section>

<div class="text-2xl font-bold leading-tight">
База знаний проекта, спроектированная как документация для человека
</div>

### Лайфхак: проектировать memory bank как для человека

<div class="mt-6 grid grid-cols-2 gap-2 text-base font-bold">
  <div class="tile-sm">project overview</div>
  <div class="tile-sm">architecture</div>
  <div class="tile-sm">infrastructure</div>
  <div class="tile-sm">tech stack</div>
  <div class="tile-sm col-span-2">product features</div>
</div>

</section>
<section>

```md
.memory-bank/
├─ index.md
├─ architecture/
│  ├─ analytics-event-flow.md
│  └─ ...
├─ incidents/
│  ├─ index.md
│  └─ ...
├─ product/
│  ├─ analytics/
│  ├─ course-details/
│  ├─ funnels/
│  ├─ user-journeys/
│  ├─ analytics-surveys.md
│  └─ metrika-funnel.md
├─ steerings/
│  ├─ architecture-invariants.md
│  ├─ decompose-conventions.md
│  ├─ domain-invariants.md
│  ├─ project-commands.md
│  ├─ quality-and-style.md
│  ├─ risk-registry.md
│  └─ security-and-compliance.md
├─ legal-structure.md
└── verify-cli.md
```

</section>
</div>

<!--
memory bank — это база знаний проекта для агента.

В ней могут быть:
- обзор проекта;
- архитектура;
- описание инфры;
- tech stack;
- product features;
- Агент должен понимать не только код, но и почему проект устроен именно так.
- Документацию лучше делить семантически - по смыслу
- Лучший лайфхак - проектировать memory bank как для человека. Т. е. чтобы человек без использования AI мог бы пройтись по дереву документации и найти ответ на свой вопрос
- обязательно применять подход с progressive disclousre
-->

---
class: lesson-4
---


# index.md

<div class="mt-6 grid grid-cols-[0.68fr_1.32fr] gap-6">
<section>

<div class="grid gap-3 text-xl">
  <div class="step h-24">"Карта местности"</div>
</div>

<div class="mt-6 text-2xl leading-tight">
Контекст раскрывается слоями, а не грузится целиком при старте
</div>

</section>
<section>

```md
# Architecture Docs Index

Навигация по архитектурным документам проекта.

## Documents

- `analytics-event-flow.md` - analytics event propagation
- `cross-system-bus.md` - cross-system bus foundation
- `domain-map.md` - карта доменов, приложений, API-поверхностей и ключевых интеграционных границ
- `c4-model.md` - C4 L1-L2 model
- `landing-routes.md` - route map for landing surfaces
- `platform-api-contracts.md` - API contracts

## Recommended Reading Order

1. `domain-map.md`
2. `analytics-event-flow.md`
3. `cross-system-bus.md`
4. `c4-model.md`
5. `landing-routes.md`
6. `platform-api-contracts.md`
```

</section>
</div>

<!--
- Вот как это может выглядеть
- Это могут быть индексные файлы (index.md) которые будут являтся table of contents текущей директории (и возможно вложенных директорий тоже)

- Сначала агент читает короткий overview.
- Потом по ссылкам уходит в нужный раздел.
- Это экономит контекст, когнитивные способности агента и помогает ему не теряться в лишних деталях.
-->

---
class: lesson-4
---


# Что добавлять в memory bank

<div class="mt-8 grid grid-cols-[1.15fr_0.85fr] gap-6">
  <section class="panel">
    <div class="label">Стоит выносить из головы в текст</div>
    <div class="mt-5 grid grid-cols-2 gap-3 text-xl leading-tight">
      <div class="quality-card mini">продукт и user stories</div>
      <div class="quality-card mini">архитектурные границы</div>
      <div class="quality-card mini">интеграции</div>
      <div class="quality-card mini">инфраструктура</div>
      <div class="quality-card mini">команды и проверки</div>
      <div class="quality-card mini">trade-offs и ADR</div>
      <div class="quality-card mini col-span-2">неявные знания команды</div>
    </div>
  </section>

  <section class="panel accent">
    <div class="label">Простой критерий</div>
    <div class="mt-5 text-3xl leading-tight">
      если ответ приходится искать по коду дольше пары минут, его стоит описать
    </div>
  </section>
</div>

<!--
- Что добавлять?
- добавляем то, что помогает агенту принимать правильные решения.
- код сам по себе является хорошей документацией к проекту, поэтому дублировать информацию из него не нужно.
- Но часто одного его недостаточно, и поэтому memory bank должен помогать агенту разобраться с проектом
- в memory bank может входить следующая инфа:
- как устроен продукт;
- основные user stories;
- архитектурные границы;
- интеграции;
- инфраструктура;
- команды и проверки;
- важные trade-offs (ADR).
- неявные знания (tacit knowledge)
- простое правило - если на поиск информации по коду вы тратите больше чем несколько минут и прыгаете по функциям и классам, то возможно эту информацию стоит вынести в memory bank
-->

---
class: lesson-4
---

# Что не добавлять в memory bank

<div class="mt-8 grid grid-cols-2 gap-5 text-center text-2xl font-bold">
  <div class="danger-tile">всё подряд</div>
  <div class="danger-tile">пересказ кода</div>
</div>

<div class="mt-12 text-4xl leading-tight">
Плохой memory bank начнёт мешать агенту
</div>

<!--
В memory bank не нужно добавлять всё подряд и дублировать код

- Частая проблема - устаревшие решения;

-->

---
class: lesson-4
---

# Документация должна обновляться

<div class="mt-6 text-4xl leading-tight">
Главная сложность memory bank — не написать, а поддерживать
</div>

<div class="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-5 text-center">
  <div class="node blue">обновлять во время задач</div>
  <div class="arrow">+</div>
  <div class="node green">периодически проверять drift</div>
</div>

<div class="mt-8 text-3xl leading-tight opacity-75">
Автоматизация может смотреть новые коммиты
и подсказывать, что пора обновить
</div>

<!--
Именно в обновлении документации заключается основная сложность при использовании подобных систем памяти.

- как это делать? проще всего обновлять документацию вместе с реализацией новых задач
- второй способ - создать automations которые будут раз в несколько дней проверять последние коммиты и смотреть что из документации стоит обновить
-->

---
class: lesson-4
---

# Проблема без onboarding

<div class="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-5">
  <section class="panel compact">
    <div class="label">Без onboarding</div>
    <div class="mt-4 text-3xl leading-tight">
      агент решает задачу
      кратчайшим путём,
      не зная карту проекта
    </div>
  </section>
  <div class="arrow">→</div>
  <section class="panel accent compact">
    <div class="label">Риск</div>
    <div class="mt-4 text-3xl leading-tight">
      дубли модулей,
      разъезд архитектуры,
      неверные решения
    </div>
  </section>
</div>

<div class="mt-10 text-4xl leading-tight">
Агенту нужно сначала войти в контекст проекта
</div>

<!--
- Перед тем как начать сессию, агент обязательно должен узнать о том, как именно у нас выглядит структура проекта, где у нас находится карта проекта.
- Если не использовать онбординг, то агент не узнает о верхнеуровневой картине нашего проекта.  
  
- Спустя время вы обнаружите, что у вас начали появляться дублирующие модули, например несколько папок с хелперами в разных частях проекта, а архитектура начала разъезжаться.  
  
- Все дело в том, что агент старается выполнить свою задачу, которую вы ему даете, кратчайшим путем и без понимания о том, как вообще устроен ваш проект.
-->

---
class: lesson-4 onboarding-example-slide
---

# Onboarding skill

<div class="mt-6 grid grid-cols-[0.9fr_1.1fr] gap-6">
<section>

<div class="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-center text-lg">
  <div class="node blue small">прочитать memory bank</div>
  <div class="arrow">→</div>
  <div class="node green small">посмотреть последние commits</div>
  <div class="arrow">→</div>
  <div class="node orange small">отчитаться о готовности</div>
</div>

<div class="mt-8 text-3xl leading-tight">
Skill заставляет агента
пройти этот ритуал
перед задачей.
</div>

</section>
<section>

```md
---
name: onboarding
description: "Run this skill to get familiar with the project"
---

Get familiar with this project by performing the following steps:

1. Read `.memory-bank/index.md` to understand the overall project idea,
   structure, architecture, code patterns and other important things.
2. Review recent code changes to understand the current development state.

After that, say "Onboarding complete" and briefly describe the project overview
and current status.
```

</section>
</div>

<!--
- Как провести онбординг?
- Положить нашу карту проекта в AGENTS.md, но если она становится объемной, то мы ее кладем в memory bank.
- В таком случае, при старте сессии необходимо заставить агента ознакомиться с этой картой репозитория. 
- И это называется onboarding. 
- Скилл на слайде просит агента пойти в memory bank, почитать его основной файл index.md, посмотреть последние гит-коммиты в ветке и отчитаться о текущем состоянии репо

- Таким образом, агент входит в контекст проекта перед задачей.

-->

---
class: lesson-4
layout: center
---

# Архитектура как инструкция для AI

## Простая и понятная архитектура упрощает жизнь не только людям, но и агентам

<!--
дальше переходим от документации к самой структуре кода: для агента архитектура проекта становится одной из главных инструкций.

- до этого мы говорили о том, как дать агенту контекст через инструкции и документацию;
- но агент читает не только markdown-файлы, он читает сам код и структуру проекта;
- структура кода — это самый важный prompt, который проект даёт AI;
- Главная мысль: AI каждый раз заходит в проект как новый разработчик без накопленной памяти.
- Он не знает историю решений и не чувствует скрытые связи между модулями.
-->

---
class: lesson-4
---

# Архитектура для AI

<div class="mt-7 text-4xl leading-tight">
Хорошая архитектура помогает агенту
понять систему снаружи внутрь.
</div>

<div class="mt-8 grid grid-cols-2 gap-4 text-2xl">
  <div class="quality-card">понятные границы</div>
  <div class="quality-card">низкая связность</div>
  <div class="quality-card">предсказуемое направление зависимостей</div>
  <div class="quality-card">меньше неочевидных side effects</div>
</div>

<div class="mt-7 text-2xl opacity-75">
Clean Code, Clean Architecture, DDD и modular architecture становятся ещё полезнее.
</div>

<!--
- И в кодинге с агентами очень хорошо помогают подходы Clean Code, Clean Architecture, DDD и modular architecture;
- код с понятными границами, низкой связностью и предсказуемым направлением зависимостей становится ещё более полезным чем раньше
- Поэтому архитектура должна помогать агенту понять систему снаружи внутрь, а не заставлять трассировать неочевидные side effects по всему проекту.
-->

---
class: lesson-4
---

# Side effects должны быть явными

<div class="mt-8 grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
  <section class="panel">
    <div class="label">Понятно</div>
    <div class="mt-5 text-3xl leading-tight">
      input → output
      явные внешние вызовы
    </div>
    <div class="mt-4 text-xl opacity-70">изменения состояния видны в коде</div>
  </section>
  <div class="arrow">/</div>
  <section class="panel muted">
    <div class="label">Опасно</div>
    <div class="mt-5 text-3xl leading-tight">
      скрытая цепочка
      действий
    </div>
    <div class="mt-4 text-xl opacity-70">агенту приходится восстанавливать весь blast radius</div>
  </section>
</div>

<div class="mt-8 text-3xl leading-tight">
Чем меньше скрытых каскадов,
тем проще тесты, логи и локальная проверка.
</div>

<!--
код для AI должен минимизировать скрытые каскады и делать побочные эффекты видимыми.

- input и output понятны;
- внешние вызовы явно отделены;
- изменения состояния видны в коде;
- нет скрытых цепочек действий;
- меньше blast radius;
- проще локально проверить результат.

- Для человека скрытый side effect тоже проблема, но опытный разработчик может помнить контекст проекта.
- Агент такого контекста не чувствует. Он видит локальный участок кода и пытается вывести поведение из структуры.
- Если функция незаметно запускает цепочку действий в других частях системы, агенту нужно восстановить всю цепочку последствий.
- Чем меньше скрытых каскадов, тем безопаснее агенту менять код и тем проще построить feedback loop через тесты, логи и локальную проверку.
-->

---
class: lesson-4
---

# Progressive Disclosure of Complexity

<div class="mt-7 text-4xl leading-tight">
Архитектура должна раскрываться
по уровням детализации.
</div>

<div class="mt-8 grid grid-cols-[0.8fr_1fr_1.15fr_1.25fr_0.9fr] items-end gap-3 text-lg">
  <div class="step h-24">services</div>
  <div class="step h-32">interfaces</div>
  <div class="step h-40">contracts</div>
  <div class="step h-48">implementation</div>
  <div class="step h-28">tests</div>
</div>

<div class="mt-7 text-2xl opacity-75">
В реализацию агент проваливается только тогда, когда реально нужно менять код.
</div>

<!--
архитектура должна раскрываться по уровням детализации.

- top-level services;
- public interfaces;
- types / contracts;
- implementation;
- tests.

- На верхнем уровне агент должен видеть понятные сервисы и границы.
- Если нужно больше деталей, он идёт к контрактам и типам.
- В реализацию он проваливается только тогда, когда реально нужно менять код.
-->

---
class: lesson-4
---

# C4 model

<div class="c4-onion">
  <div class="c4-ring c4-l1">
    <span class="c4-label">L1: Context</span>
    <div class="c4-ring c4-l2">
      <span class="c4-label">L2: Containers</span>
      <div class="c4-ring c4-l3">
        <span class="c4-label">L3: Components</span>
        <div class="c4-ring c4-l4">
          <span class="c4-label">L4: Code</span>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="mt-6 text-3xl">
Карта системы от общего к частному.
</div>

<!--
C4 model помогает дать агенту карту системы от общего к частному.

- L1: Context;
- L2: Containers;
- L3: Components;
- L4: Code;

- C4 хорошо ложится на Progressive Disclosure.
- Сначала агент смотрит context, потом containers, потом components.
- Это особенно полезно для больших проектов и интеграций.
-->

---
class: lesson-4
---

# Продуктовые фичи

<div class="mt-8 grid grid-cols-2 gap-5 text-2xl">
  <div class="quality-card">user roles</div>
  <div class="quality-card">user stories</div>
  <div class="quality-card">core flows</div>
  <div class="quality-card">business rules</div>
  <div class="quality-card">edge cases</div>
  <div class="quality-card">examples</div>
</div>

<!--
Агенту нужно понимать продукт, а не только техническую структуру.
Очень полезно в memory bank хранить:
- user roles;
- user stories;
- core flows пользователя;

- Как только мы даем агенту более богатый контекст о нашем проекте – т. е. дополняем это инфой о продукте, то становится проще работать с проектом и реализовывать наши идеи
- Многие ошибки агента происходят из-за непонимания продукта.
- Если есть описание фич, ролей и бизнес-правил, агенту проще менять код осмысленно.
- Продуктовая документация должна быть такой же доступной, как техническая.
-->

---
class: lesson-4
---

# Внешние источники знаний

<div class="mt-7 text-4xl leading-tight">
Не все знания о проекте могут лежать в репозитории
</div>

<div class="mt-7 grid grid-cols-[1.05fr_0.95fr] gap-6">
  <section class="panel">
    <div class="label">Где искать</div>
    <div class="mt-5 grid grid-cols-2 gap-3 text-xl">
      <div class="quality-card mini">Confluence</div>
      <div class="quality-card mini">Jira</div>
      <div class="quality-card mini">GitHub issues</div>
      <div class="quality-card mini">Slack decisions</div>
      <div class="quality-card mini">design docs</div>
      <div class="quality-card mini">API docs</div>
    </div>
  </section>

  <section class="panel accent">
    <div class="label">Что важно</div>
    <div class="mt-5 text-3xl leading-tight">
      дать агенту
      доступ к этим знаниям
    </div>
    <div class="mt-5 text-2xl opacity-75">
      MCP / Skills
    </div>
  </section>
</div>

<!--
Не всё может лежать в репозитории, но агенту нужно знать, где искать.

- Confluence;
- Jira;
- GitHub issues;
- Slack decisions;
- design docs;
- API docs.

- Если часть знаний живёт во внешних системах, нужно дать агенту доступ или инструкции.
- Используйте MCP или Skills как инструмент для доступа к внешним системам
-->

---
class: lesson-4
---

# С чего начать

<div class="mt-8 grid grid-cols-2 gap-4 text-xl">
  <div class="quality-card">описать стек и инфру</div>
  <div class="quality-card">сделать C4 L1-L3</div>
  <div class="quality-card">описать user stories</div>
  <div class="quality-card">найти внешнюю документацию</div>
  <div class="quality-card">залинковать skills</div>
  <div class="quality-card">собрать .memory-bank/index.md</div>
</div>

<!--
- С чего начать процесс превращения репо в AI Native репо?

1. Описать тех стек и инфру
2. Попросить агента изучить репозиторий top down и создать c4 l1-l3 level архитектуру для основных модулей проекта
3. Описать основные user stories:
>Как голодный пользователь,Я хочу отфильтровать рестораны по времени доставки «до 30 минут»,Чтобы успеть поесть во время моего короткого перерыва.
4. Проверить, какая ещё документация о проекте уже существует и подумать, как можно было бы дать агенту доступ к ней
5. если есть уже skills с code guidelines, code review, etc, то залинковать их в этом memory bank
6. Составить .memory-bank/index.md и другие index.md с table of contents для навигации по репозиторию и memory bank
-->
