---
theme: default
title: Урок 5. Plan & Act
info: |
  Урок 5: ручной Plan & Act workflow, review loops, автоматизация и сравнение с готовыми фреймворками.
class: lesson-5
highlighter: shiki
drawings:
  persist: false
transition: slide-left
layout: default
mdc: true

---


# Урок 5

<div class="mt-10 text-6xl leading-tight font-medium">
Plan & Act
</div>

<div class="mt-10 grid grid-cols-5 gap-3 text-xl font-medium">
  <div class="chip blue">plan</div>
  <div class="chip green">act</div>
  <div class="chip orange">review</div>
  <div class="chip purple">feedback loop</div>
  <div class="chip gray">checks</div>
</div>

<!--
- В прошлых уроках мы говорили про skills, MCP, безопасность и AI-Native repo.
- Теперь говорим про процесс реализации задач.
- Главная идея: агенту нельзя просто сказать “сделай фичу” и надеяться, что он правильно понял весь контекст.
- Сначала нужно сформировать хороший план, а уже потом отдавать задачу в реализацию.
-->

---


# Типичный сценарий

<div class="mt-8 grid grid-cols-2 gap-6">
  <section class="panel good">
    <div class="label">как хочется</div>
    <div class="mt-5 text-3xl font-medium leading-tight">описал задачу → агент понял → сделал правильно</div>
  </section>
  <section class="panel bad">
    <div class="label">как часто бывает</div>
    <div class="mt-5 text-3xl font-medium leading-tight">агент понял по-своему → follow-up → переделки</div>
  </section>
</div>

<div class="mt-8 text-4xl font-medium leading-tight">
Сначала уточняем задачу и план
<br />
Потом пишем код
</div>

<!--
- Обычно - отправить задачу в AI и ждать результата
- В результате - идеальный сценарий - агент сразу понимает задачу
- Но часто - не понимает
- Результат юзера не устаривает и приходится исправлять косяки
- В AI coding такой подход не оптимален
- Эффективнее - планирование
- Именно про этот подход мы сейчас и поговорим.
-->

---


# Plan & Act

<div class="flow mt-10">
  <div class="node blue">обсуждение</div>
  <div class="arrow">→</div>
  <div class="node green">draft</div>
  <div class="arrow">→</div>
  <div class="node orange">plan</div>
  <div class="arrow">→</div>
  <div class="node purple">implementation</div>
  <div class="arrow">→</div>
  <div class="node gray">review</div>
  <div class="arrow">→</div>
  <div class="node red">fixes</div>
</div>

<div class="mt-10 grid grid-cols-2 gap-5 text-2xl font-medium">
  <div class="panel">по плану агент реализует задачу</div>
  <div class="panel accent">по плану другой агент проверяет результат</div>
</div>

<!--
- Это распространённый подход к работе с AI coding agents.
- Суть не в том, чтобы написать красивый документ.
- Суть в том, чтобы создать рабочий артефакт, по которому агент сможет реализовать задачу и по которому другой агент сможет проверить результат.
-->

---


# Определяем фичу

<div class="mt-8 grid grid-cols-[0.9fr_1.1fr] gap-7">
  <section class="panel accent">
    <div class="label">старт</div>
    <div class="big mt-4">Не идеальное ТЗ, а границы задачи</div>
  </section>
  <section class="list">
    <div>цель фичи</div>
    <div>пользовательский сценарий</div>
    <div>ограничения</div>
    <div>что точно не делаем</div>
    <div>ожидаемый результат</div>
  </section>
</div>

<!--
- На первом этапе мы формулируем идею
- Идеально - не обязательно
- Важно начать обсуждение и понять границы задачи
- Если задача большая, делаем draft, который будем дорабатывать
-->

---


# Обсуждаем задачу с агентом

<div class="mt-8 grid grid-cols-[1fr_1.1fr] gap-7">
  <section class="panel accent">
    <div class="big">Research, not implementation</div>
    <div class="mt-5 text-2xl font-medium opacity-75">на этом этапе агент исследует, а не пишет фичу</div>
  </section>
  <section class="grid grid-cols-2 gap-4 text-xl font-medium">
    <div class="tile blue">изучить код</div>
    <div class="tile green">прочитать docs</div>
    <div class="tile orange">посмотреть в интернете</div>
    <div class="tile purple">посмотреть в других репо</div>
    <div class="tile gray">предложить варианты</div>
    <div class="tile">сравнить trade-offs</div>
  </section>
</div>

<!--
- Мы можем попросить агента изучить кодовую базу и понять, куда эта фича должна встроиться.
- Иногда нужно посмотреть документацию библиотек или актуальные best practices.
- Иногда полезно попросить агента предложить несколько вариантов реализации и сравнить trade-offs.
- На этом этапе мы ещё не реализуем, а исследуем задачу.
-->

---


# Draft задачи

<div class="mt-8 grid grid-cols-[0.8fr_1.2fr] gap-7">
  <section class="panel accent">
    <div class="label">draft</div>
    <div class="big mt-4">Контекст больше не живёт только в чате</div>
  </section>
  <section class="list">
    <div>контекст</div>
    <div>цель</div>
    <div>решения из обсуждения</div>
    <div>вопросы</div>
    <div>ограничения</div>
    <div>ссылки на код и документы</div>
  </section>
</div>

<!--
- После первичного обсуждения полезно зафиксировать всё в draft.md
- Драфт нужен, чтобы не держать контекст только в чате и чтобы у агента была возможность на что то опираться
-->

---


# Иногда нужен прототип

<div class="mt-8 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-4 text-center">
  <div class="node blue">идея</div>
  <div class="arrow">→</div>
  <div class="node orange">быстрый proof of concept</div>
  <div class="arrow">→</div>
  <div class="node green">ограничения для плана</div>
</div>

<div class="mt-10 grid grid-cols-4 gap-4 text-xl font-medium">
  <div class="tile">API</div>
  <div class="tile">UI-идея</div>
  <div class="tile">интеграция</div>
  <div class="tile accent">не финальная реализация</div>
</div>

<!--
- На этом этапе надо понять, как задача встроится в проект.
- Можно попросить агента сделать маленький прототип для проверки гипотезы
- Результат фиксируем в драфте
-->

---


# Открытые вопросы

<div class="mt-8 grid grid-cols-2 gap-6">
  <section class="panel">
    <div class="label">агент может закрыть</div>
    <div class="mt-5 text-3xl font-medium leading-tight">код, документация, похожие места, технические ограничения</div>
  </section>
  <section class="panel accent">
    <div class="label">человек должен решить</div>
    <div class="mt-5 text-3xl font-medium leading-tight">продуктовые решения, бизнес-границы, спорные trade-offs</div>
  </section>
</div>

<div class="mt-8 text-3xl font-medium leading-tight">
Хороший план не прячет неопределённость
</div>

<!--
- После того как мы определились на требованиях – открытые вопросы
- На часть вопросов агент скорее всего сможет ответить сам, а на другие ответить должны мы
- Мы можем просить совета у агента
- По окончанию этого процесса у нас не должно остаться неопределённостей
-->

---


# Перекрёстное review плана

<div class="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-5 text-center">
  <div class="node blue">draft / plan из текущего чата</div>
  <div class="arrow">→</div>
  <div class="node green">новый чат или другая модель</div>
</div>

<div class="mt-10 grid grid-cols-4 gap-4 text-xl font-medium">
  <div class="tile">fresh context</div>
  <div class="tile">открытые вопросы</div>
  <div class="tile">риски</div>
  <div class="tile accent">корректировки до реализации</div>
</div>

<!--
- Когда draft уже собран, можно получить ещё одно непредвзятое мнение со стороны.
- На этом этапе важно создать независимость от текущего чата в котором обсуждали решение
- Для этого открываем новый чат с агентом - либо тот же агент либо другой
- Просим ознакомиться с проектом и оценить наш драфт и найти открытые вопросы, неопределённости, минусы и т. д.
-->

---


# Консилиум моделей

<div class="mt-8 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-4 text-center">
  <div class="node blue">одинаковый входной контекст</div>
  <div class="arrow">→</div>
  <div class="node green">3-5 независимых reports</div>
  <div class="arrow">→</div>
  <div class="node orange">итоговый report</div>
</div>

<div class="mt-10 grid grid-cols-2 gap-5 text-2xl font-medium">
  <div class="panel">повторяющиеся проблемы</div>
  <div class="panel accent">уникальные находки</div>
</div>

<!--
- Опционально – консилиум моделей
- Мы берём несколько моделей и параллельно просим каждую проверить план по одним и тем же критериям.
- На выходе получаем несколько независимых мнений
- Выделяем общие проблемы и смотрим на уникальные
- Opensource модели тут тоже пригождаются
- В моих кейсах это чаще всего избыточно, но для дорогих или рискованных изменений такой подход может быть полезен.
-->

---


# Чистовой план

<div class="mt-8 grid grid-cols-[0.8fr_1.2fr] gap-7">
  <section class="panel accent">
    <div class="label">plan.md</div>
    <div class="big mt-4">По нему можно реализовать и проверить задачу</div>
  </section>
  <section class="grid grid-cols-2 gap-4 text-lg font-medium">
    <div class="tile">описание задачи</div>
    <div class="tile">что сделать</div>
    <div class="tile">как работает</div>
    <div class="tile">что используем</div>
    <div class="tile">что не используем</div>
    <div class="tile">ограничения</div>
    <div class="tile accent">критерии приемки</div>
    <div class="tile accent">план тестирования</div>
  </section>
</div>

<!--
- Чистовик плана должен содержать детальное описание задачи и ожидаемого поведения.
- В нём нужно зафиксировать, какие подходы мы используем, а какие не используем.
- Важно закрыть открытые вопросы до передачи в реализацию.
- Ключевое - план должен быть самодостаточным.
- Все нюансы из обсуждений в текущем чате нужно отразить в плане
-->

---


# Декомпозиция задачи

<div class="mt-8 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-4 text-center">
  <div class="node blue">большой plan</div>
  <div class="arrow">→</div>
  <div class="node green">маленькие шаги</div>
  <div class="arrow">→</div>
  <div class="node orange">проще выполнить и проверить</div>
</div>

<div class="mt-10 grid grid-cols-4 gap-4 text-xl font-medium">
  <div class="tile">порядок</div>
  <div class="tile">зависимости</div>
  <div class="tile">результат шага</div>
  <div class="tile accent">оценка сложности</div>
</div>

<!--
- Как только есть план - делаем декомпозицию
- Декомпозиция позволяет эффективнее выполнять и проверять работу
-->

---


# Критерии приемки

<div class="mt-8 grid grid-cols-[0.8fr_1.2fr] gap-7">
  <section class="panel bad">
    <div class="label">плохо</div>
    <div class="big mt-4">“сделай нормально”</div>
  </section>
  <section class="list">
    <div>пользователь может сделать X</div>
    <div>система отвечает Y</div>
    <div>ошибка отображается Z</div>
    <div>старое поведение не ломается</div>
    <div>edge cases описаны явно</div>
  </section>
</div>

<!--
- Критерии приемки позволят правильно проверить результат
- По ним можно писать тесты.
- Чем конкретнее критерии, тем проще построить feedback loop.
-->

---


# План тестирования и документация

<div class="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-5 text-center">
  <div class="node blue">acceptance criteria</div>
  <div class="arrow">→</div>
  <div class="node green">test plan</div>
</div>

<div class="mt-10 grid grid-cols-6 gap-3 text-lg font-medium">
  <div class="tile">unit</div>
  <div class="tile">integration</div>
  <div class="tile">e2e / browser</div>
  <div class="tile">manual</div>
  <div class="tile">regression</div>
  <div class="tile accent">edge cases</div>
</div>

<!--
- На этом же этапе прорабатываем план тестирования
- У нас уже есть критерии приемки и по ним проще описывать тесты
- Так же на этом этапе необходимо определить, какая документация из memory bank будет обновлена
-->

---


# Implementation

<div class="flow mt-8">
  <div class="node blue">читает план</div>
  <div class="arrow">→</div>
  <div class="node green">изучает файлы</div>
  <div class="arrow">→</div>
  <div class="node orange">вносит changes</div>
  <div class="arrow">→</div>
  <div class="node purple">запускает checks</div>
  <div class="arrow">→</div>
  <div class="node gray">фиксирует результат</div>
</div>

<div class="mt-10 text-3xl font-medium leading-tight">
Когда план хороший, агент меньше угадывает и больше выполняет
</div>

<!--
- На этом этапе у нас уже есть план того, что нам нужно делать.
- декомпозиция, тесты, документация
- сняли когнитивную нагрузку с имплементатора, ему не нужно думать, что и как можно сделать
- имплементацию можно делегировать менее умным моделям
- я использовал gpt-5.3-codex, сейчас - gpt 5.5 medium
- можно использовать китайские open source модели
-->

---


# Проверяем реализацию по плану

<div class="mt-8 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-4 text-center">
  <div class="node blue">plan</div>
  <div class="arrow">+</div>
  <div class="node green">diff / commits / код</div>
  <div class="arrow">→</div>
  <div class="node orange">issues</div>
</div>

<div class="mt-10 grid grid-cols-2 gap-5 text-2xl font-medium">
  <div class="panel">Вопрос: “код соответствует плану?”</div>
  <div class="panel bad">Это ещё не code review</div>
</div>

<!--
- код написано, что дальше?
- этап проверки
- сверяем план и реализованный код.
- просим независимого агента проверить код по плану и найти ошибки если они есть
- важно - не просить делать code review – только сверку с планом
- в ответе агент должен подготовить отчёт
-->

---


# Feedback loop

<div class="flow mt-12">
  <div class="node blue">review</div>
  <div class="arrow">→</div>
  <div class="node orange">issues</div>
  <div class="arrow">→</div>
  <div class="node green">fixes</div>
  <div class="arrow">→</div>
  <div class="node purple">repeat review</div>
</div>

<div class="mt-10 text-3xl font-medium leading-tight">
Проверяем не только фикс, но и задачу целиком
</div>

<!--
- Если агент нашёл проблемы, мы отправляем их на доработку имплементеру
- После исправлений нужно повторить review с учётом исправлений
-->

---


# Code review

<div class="mt-8 grid grid-cols-2 gap-5 text-2xl font-medium">
  <div class="panel">план: сделали ли обещанное?</div>
  <div class="panel accent">review: хорошо ли сделано?</div>
</div>

<div class="mt-8 grid grid-cols-6 gap-3 text-lg font-medium">
  <div class="tile">качество кода</div>
  <div class="tile">архитектурные границы</div>
  <div class="tile">maintainability</div>
  <div class="tile">testability</div>
  <div class="tile">стиль проекта</div>
  <div class="tile accent">side effects</div>
</div>

<!--
- теперь можно делать code review
- Проверка по плану отвечает на вопрос: “сделали ли мы то, что обещали?”
- Code review отвечает на другой вопрос: “хорошо ли это сделано?”
- Если у проекта есть критерии хорошего кода и архитектуры, агент может проверить реализацию по этим критериям.
- Найденные проблемы снова отправляются в feedback loop.
-->

---


# UI review

<div class="mt-8 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-4 text-center">
  <div class="node blue">Figma / screenshot</div>
  <div class="arrow">→</div>
  <div class="node green">browser check</div>
  <div class="arrow">→</div>
  <div class="node orange">visual issues</div>
</div>

<div class="mt-10 grid grid-cols-4 gap-4 text-xl font-medium">
  <div class="tile">responsive</div>
  <div class="tile">dark / light</div>
  <div class="tile">text overflow</div>
  <div class="tile accent">fix → repeat</div>
</div>

<!--
- Если задача связана с версткой, можно отдельно проверить UI.
- Агент может сравнить реализацию с Figma-макетом или скриншотом.
- Если есть проблемы, они исправляются и проверка повторяется.
- Этот этап опциональный, но очень полезный для frontend-задач.
-->

---


# QA по user stories

<div class="mt-8 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-4 text-center">
  <div class="node blue">user story</div>
  <div class="arrow">→</div>
  <div class="node green">browser / API</div>
  <div class="arrow">→</div>
  <div class="node orange">bug report</div>
</div>

<div class="mt-10 grid grid-cols-4 gap-4 text-xl font-medium">
  <div class="tile">test data</div>
  <div class="tile">happy path</div>
  <div class="tile">edge cases</div>
  <div class="tile accent">feedback loop глазами пользователя</div>
</div>

<!--
- Если в плане описан пользовательский сценарий, мы можем провести QA
- Агент может пройти flow в браузере, отправить запросы на backend, проверить состояние данных.
- Найденные проблемы снова возвращаются в доработку.
- Это тот же feedback loop, просто с точки зрения пользователя.
-->

---


# Схема процесса

<div class="schema-frame">
  <img src="./planact-schema.png" alt="Схема Plan & Act процесса" class="process-schema" />
</div>

<!--
- На этой схеме можно увидеть весь процесс целиком.
- Сначала мы формируем требования, draft и чистовой план.
- После этого отдаём задачу в реализацию.
- Затем запускаем проверки: соответствие плану, code review, UI review или QA, если они нужны.
- Все найденные проблемы возвращаются в feedback loop: issues, fixes, повторная проверка.
-->

---


# Финальный review

<div class="mt-8 grid grid-cols-5 gap-4 text-lg font-medium">
  <div class="tile blue">план выполнен</div>
  <div class="tile green">тесты проходят</div>
  <div class="tile orange">код не разъехался</div>
  <div class="tile purple">архитектура цела</div>
  <div class="tile gray">docs актуальны</div>
</div>

<div class="mt-10 text-4xl font-medium leading-tight">
Последняя защита от fixes, которые создали новую проблему
</div>

<!--
- Если в процессе review и QA мы что-то исправляли, в конце стоит провести финальную проверку.
- Цель — убедиться, что после всех изменений код и архитектура проекта не разъехались.
- Это последняя защита от ситуации, когда локальные fixes создали новую проблему.
-->

---


# Дополнительные проверки

<div class="mt-8 grid grid-cols-6 gap-3 text-lg font-medium">
  <div class="tile">docs</div>
  <div class="tile">memory bank</div>
  <div class="tile">security</div>
  <div class="tile">performance</div>
  <div class="tile">observability</div>
  <div class="tile accent">migrations</div>
</div>

<div class="mt-10 text-4xl font-medium leading-tight">
Добавляем только те проверки, которые важны конкретному проекту
</div>

<!--
- Мы не ограничивается одним review.
- В зависимости от проекта можно добавить проверку документации, безопасности, производительности и т. д.
- Важно, чтобы эти проверки были явно описаны и могли повторяться.
-->

---


# Роль человека

<div class="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-5 text-center">
  <div class="node blue">начало: что хотим получить</div>
  <div class="arrow">↔</div>
  <div class="node green">конец: принять результат</div>
</div>

<div class="mt-10 grid grid-cols-5 gap-3 text-lg font-medium">
  <div class="tile">требования</div>
  <div class="tile">продуктовые решения</div>
  <div class="tile">открытые вопросы</div>
  <div class="tile">приёмка</div>
  <div class="tile accent">ручная проверка</div>
</div>

<!--
- Ключевая особенность подхода в том, что многие этапы можно делать автономно.
- Но человек всё ещё нужен в самом начале на определении shape и требований
- И в конце, когда нужно принять результат или проверить то, что нельзя полностью доверить агенту.
-->

---


# Что можно автоматизировать

<div class="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-5 text-center">
  <div class="node blue">понятный plan</div>
  <div class="arrow">→</div>
  <div class="node green">повторяемый workflow</div>
</div>

<div class="mt-10 grid grid-cols-7 gap-3 text-base font-medium">
  <div class="tile">implementation</div>
  <div class="tile">plan review</div>
  <div class="tile">code review</div>
  <div class="tile">fixes</div>
  <div class="tile">UI review</div>
  <div class="tile">QA</div>
  <div class="tile accent">final review</div>
</div>

<!--
- Почти все этапы после постановки требований можно автоматизировать.
- Для этого нужен понятный входной артефакт: plan.
- И нужны повторяемые проверки, которые агент умеет запускать.
- В этом уроке мы пройдём процесс вручную, чтобы понять механику.
- На следующем поговорим про создание автоматизации
-->

---


# Готовые фреймворки

<div class="mt-8 text-4xl font-medium leading-tight">
Это разные автоматизации одного базового паттерна
</div>

<div class="mt-8 grid grid-cols-4 gap-4 text-xl font-medium">
  <div class="tile blue">OpenSpec</div>
  <div class="tile green">Spec Kit</div>
  <div class="tile orange">GSD</div>
  <div class="tile purple">BMAD</div>
  <div class="tile gray">Superpowers</div>
  <div class="tile">Codex /goal</div>
  <div class="tile">Ralph loop</div>
</div>

<div class="mt-8 flow">
  <div class="node">requirements</div>
  <div class="arrow">→</div>
  <div class="node">plan</div>
  <div class="arrow">→</div>
  <div class="node">implementation</div>
  <div class="arrow">→</div>
  <div class="node">review</div>
</div>

<!--
- Всё, что мы сейчас описали вручную, уже пытаются упаковать в готовые фреймворки и workflows.
- У них общий корень: сначала требования и план, потом реализация, потом проверка результата.
- Отличаются они тем, где делают акцент: на требованиях, ролях, автономном исполнении, skills, fresh context или долгом loop.
-->

---


# OpenSpec

<div class="mt-7 grid grid-cols-[0.9fr_1.1fr] gap-6">
  <section class="panel">
    <div class="label">как работает</div>
    <div class="steps mt-5">
      <div>01 описываем изменение</div>
      <div>02 уточняем требования</div>
      <div>03 реализуем</div>
      <div>04 сверяем результат</div>
    </div>
  </section>
  <section class="grid gap-4">
    <div class="card good">Хвалят: легче больших комбайнов, можно встроить в existing project</div>
    <div class="card bad">Критикуют: слабее technical plan, много текста и токенов</div>
    <div class="card bad">Не заменяет полноценную memory проекта</div>
  </section>
</div>

<!--
- В OpenSpec сначала мы описываем, что именно должно измениться и зачем.
- Потом агент помогает уточнить требования и только после этого переходит к реализации.
- Его плюс в том, что он хорошо закрывает бизнес-требования и помогает не потерять смысл изменения.
- Но техническая часть может быть слабой: часто это список задач, а не полноценный implementation plan.
- Ещё одна проблема — overhead: много spec-артефактов, много проходов через агента, много токенов.
- И OpenSpec сам по себе не заменяет техническую базу знаний о проекте: архитектуру и причины решений всё равно нужно вести отдельно.
-->

---


# Spec Kit

<div class="mt-7 grid grid-cols-[0.9fr_1.1fr] gap-6">
  <section class="panel">
    <div class="label">как работает</div>
    <div class="steps mt-5">
      <div>01 принципы проекта</div>
      <div>02 описание фичи</div>
      <div>03 technical plan</div>
      <div>04 задачи и реализация</div>
    </div>
  </section>
  <section class="grid gap-4">
    <div class="card good">Хвалят: строгая структура и меньше хаоса</div>
    <div class="card good">Лучше подходит для больших feature-workflows</div>
    <div class="card bad">Критикуют: много ceremony, docs и babysitting между фазами</div>
  </section>
</div>

<!--
- Spec Kit сначала фиксируются принципы проекта: качество, тесты, UX, ограничения, архитектурные ожидания.
- Потом фича проходит через уточнение требований, технический план и декомпозицию на задачи.
- Это полезно, когда задача большая и нужно заранее поймать продуктовые и архитектурные решения.
- Но цена — бюрократия.
- Маленькая фича может быстро превратиться в гору документов.
- На реальных длинных проектах specs могут drift-иться, и тогда приходится поддерживать документы почти как отдельный продукт.
-->

---


# GSD

<div class="mt-7 grid grid-cols-[0.9fr_1.1fr] gap-6">
  <section class="panel">
    <div class="label">как работает</div>
    <div class="steps mt-5">
      <div>01 изучает проект</div>
      <div>02 задаёт вопросы</div>
      <div>03 строит план</div>
      <div>04 запускает агентов и verify</div>
    </div>
  </section>
  <section class="grid gap-4">
    <div class="card good">Хвалят: fresh context и хорошие вопросы в начале</div>
    <div class="card bad">Критикуют: токены, subagents, раздутые задачи</div>
    <div class="card bad">Боль: слабая живая база знаний проекта</div>
  </section>
</div>

<!--
- GSD пытается организовать длинную работу: собрать контекст, обсудить серые зоны, распланировать фазу, запустить агентов и потом проверить результат.
- В начале это может сильно помогать, потому что фреймворк задаёт вопросы, о которых человек не подумал.
- Но отзывы показывают и обратную сторону: процесс может искусственно раздувать даже простые задачи.
- Subagents и повторные проверки быстро сжигают токены.
- Появляется много markdown-документов, которые сложно реально вычитать.
- И если проект становится сложнее, начинает мешать отсутствие живой базы знаний: артефакты есть, но они не всегда превращаются в понятную память об архитектуре и решениях.
- GSD соскамился
-->

---


# BMAD

<div class="mt-7 grid grid-cols-[0.9fr_1.1fr] gap-6">
  <section class="panel">
    <div class="label">как работает</div>
    <div class="steps mt-5">
      <div>01 бизнес-контекст</div>
      <div>02 требования</div>
      <div>03 архитектура и stories</div>
      <div>04 разработка и QA</div>
    </div>
  </section>
  <section class="grid gap-4">
    <div class="card good">Хвалят: закрывает продукт, архитектуру, реализацию и review</div>
    <div class="card good">Силен для проекта с нуля</div>
    <div class="card bad">Критикуют: тяжёлый ролевой комбайн и высокая ceremony</div>
  </section>
</div>

<!--
- BMAD можно объяснить как ролевой процесс.
- Там есть условные роли: продукт, аналитик, архитектор, разработчик, QA.
- Сначала собирается бизнес-контекст и требования.
- Потом отдельно прорабатывается архитектура и stories для разработки.
- После этого агент пишет код, а финальный слой проверяет результат.
- Плюс BMAD в полноте: для проекта с нуля он может закрыть весь путь от идеи до реализации.
- Минус — вес процесса. Нужно отвечать на много вопросов, читать много промежуточных материалов, и для инженера это может быть лишней ceremony.
-->

---


# Superpowers

<div class="mt-7 grid grid-cols-[0.9fr_1.1fr] gap-6">
  <section class="panel">
    <div class="label">как работает</div>
    <div class="steps mt-5">
      <div>01 brainstorming</div>
      <div>02 план</div>
      <div>03 маленькие шаги</div>
      <div>04 review</div>
    </div>
  </section>
  <section class="grid gap-4">
    <div class="card good">Хвалят: дисциплина, TDD, отдельный review</div>
    <div class="card bad">Критикуют: душность, token burn, лишние варианты и документы</div>
    <div class="card bad">Риск: skills не всегда срабатывают в нужный момент</div>
  </section>
</div>

<!--
- В Superpowers работает так
- Агент сначала обсуждает идею, предлагает варианты, пишет план, а потом реализует его маленькими шагами.
- В хороших сценариях это добавляет дисциплину: не кодить сразу, сначала понять задачу и согласовать направление.
- Но многие критикуют Superpowers за душность.
- Он может задавать слишком много вопросов, генерировать лишние варианты и создавать документы, которые никто не будет читать.
- Также skill-based workflow работает только если skills реально срабатывают в нужный момент.
- Иначе это превращается в красивую методологию, которая не всегда влияет на поведение агента.
-->

---


# Codex `/goal`

<div class="mt-8 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-4 text-center">
  <div class="node blue">clear goal</div>
  <div class="arrow">→</div>
  <div class="node green">iteration</div>
  <div class="arrow">→</div>
  <div class="node orange">evidence check</div>
</div>

<div class="mt-10 grid grid-cols-3 gap-5 text-2xl font-medium">
  <div class="card good">bug hunt</div>
  <div class="card good">migrations</div>
  <div class="card bad">без clear done condition loop ходит кругами</div>
</div>

<!--
- помимо этих фреймворков, есть ещё и встроенная фича от codex - `/goal`
- Он полезен, когда у нас уже есть понятный финиш: тесты зелёные, grep ничего не находит, benchmark достиг нужного значения.
- Тогда Codex может работать не одним ответом, а несколькими итерациями.
- После каждой итерации он проверяет evidence и решает, продолжать или завершать.
- Это удобно для задач с ясной метрикой готовности.
- Но если цель расплывчатая, loop может начать ходить кругами или добавлять лишний код.
- Поэтому `/goal` усиливает Plan & Act, но не отменяет хороший план.
-->

---


# Ralph loop

<div class="mt-8 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-4 text-center">
  <div class="node blue">state в файлах</div>
  <div class="arrow">→</div>
  <div class="node green">fresh context</div>
  <div class="arrow">→</div>
  <div class="node orange">следующая итерация</div>
</div>

<div class="mt-10 grid grid-cols-3 gap-5 text-2xl font-medium">
  <div class="card good">борется с context rot</div>
  <div class="card good">подходит для long-running work</div>
  <div class="card bad">не спасает слабый план</div>
</div>

<!--
- Ralph loop — это подход, где состояние задачи хранится не в истории чата, а в файлах проекта.
- Каждая итерация запускает агента заново со свежим контекстом.
- Агент берёт следующую задачу, реализует её, запускает проверки и обновляет progress.
- Главный плюс — борьба с context rot на длинных задачах.
- Но сам loop не делает работу умнее.
- Если план слабый, агент просто будет быстрее повторять ошибки.
- Поэтому Ralph loop полезен только поверх хорошей декомпозиции, тестов, progress tracking и понятного stop condition.
-->

---


# Как выбирать подход

<div class="mt-8 grid grid-cols-[0.9fr_1.1fr] gap-7">
  <section class="panel accent">
    <div class="big">Overhead должен окупаться контролем</div>
  </section>
  <section class="grid grid-cols-2 gap-4 text-lg font-medium">
    <div class="tile">small task → plan mode</div>
    <div class="tile">big feature → draft → plan → review</div>
    <div class="tile">critical task → cross-review</div>
    <div class="tile">long-running → /goal или Ralph loop</div>
    <div class="tile">greenfield → BMAD / GSD</div>
    <div class="tile accent">existing project → lightweight workflow</div>
  </section>
</div>

<!--
- Главный вывод не в том, что нужно срочно выбрать один фреймворк.
- Скорее наоборот: сначала нужно понять базовый ручной процесс.
- Для маленькой задачи тяжёлый SDD-фреймворк часто не нужен.
- Для большой задачи уже полезны draft, план, acceptance criteria и отдельный review.
- Для long-running задач можно добавить `/goal` или Ralph loop.
- Для сложного greenfield можно смотреть на BMAD или GSD, но нужно понимать цену в токенах, документах и контроле.
- И почти всегда хорошая инженерная декомпозиция остаётся важнее, чем название фреймворка.
-->

---


# Что дальше

<div class="mt-10 text-5xl font-medium leading-tight">
Сначала вручную
<br />
Потом — skill
</div>

<div class="mt-10 flow">
  <div class="node blue">понять шаги</div>
  <div class="arrow">→</div>
  <div class="node green">описать workflow</div>
  <div class="arrow">→</div>
  <div class="node orange">упаковать в skill</div>
  <div class="arrow">→</div>
  <div class="node purple">повторять автономно</div>
</div>

<!--
- На текущем уроке мы разберём этот процесс в ручном режиме.
- Это нужно, чтобы понять, из каких шагов он состоит и где появляются feedback loops.
- На следующем уроке мы составим skill для этого процесса и сделаем его более автономным.
-->
