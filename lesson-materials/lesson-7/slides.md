---
theme: default
title: Урок 7. Обслуживаем AI-native репозиторий
info: |
  Урок 7: ускоренный SDLC, регулярное обслуживание AI-native репозитория, maintenance reviews и новая роль разработчика.
class: lesson-7
highlighter: shiki
drawings:
  persist: false
transition: slide-left
layout: default
mdc: true

---

# Урок 7

<div class="mt-8 text-5xl leading-tight font-medium">
Обслуживаем AI-native репозиторий
<br />
и входим в новую эпоху
</div>

<div class="mt-10 grid grid-cols-5 gap-3 text-xl font-medium">
  <div class="chip blue">SDLC</div>
  <div class="chip green">tech debt</div>
  <div class="chip orange">review</div>
  <div class="chip purple">refactoring</div>
  <div class="chip gray">new role</div>
</div>

<!--

-->

---

# SDLC ускорился

<div class="flow mt-7">
  <div class="node blue">обсуждаем</div>
  <div class="arrow">→</div>
  <div class="node green">планируем</div>
  <div class="arrow">→</div>
  <div class="node orange">пишем код</div>
  <div class="arrow">→</div>
  <div class="node purple">выпускаем</div>
</div>

<div class="flow mt-6">
  <div class="node blue">быстрее delivery</div>
  <div class="arrow">→</div>
  <div class="node orange">быстрее копятся решения</div>
  <div class="arrow">→</div>
  <div class="node red">быстрее копятся проблемы</div>
</div>

<div class="sdlc-conclusion mt-6 accent">
  Нельзя ускорить delivery и оставить maintenance на старой частоте
</div>

<!--
- С AI coding у нас ускорился SDLC, мы это знаем
- Из-за этого ускорилось накопление проблем, об этом мы забываем
-->

---

# Техдолг

<div class="mt-8 grid grid-cols-[1.05fr_0.95fr] gap-5">
  <section class="panel accent">
    <div class="label">смысл</div>
    <div class="mt-4 text-4xl leading-tight">
      это нормальная часть разработки
    </div>
  </section>
  <section class="panel bad">
    <div class="label">в AI coding</div>
    <div class="mt-4 text-4xl leading-tight">
      просто копится быстрее
    </div>
  </section>
</div>

<div class="mt-7 grid grid-cols-3 gap-4 text-xl font-medium">
  <div class="tile blue">быстрые решения</div>
  <div class="tile orange">временные компромиссы</div>
  <div class="tile purple">изменившиеся требования</div>
</div>

<!--
- Поэтому
- Техдолг стал ещё быстрее копиться
- И это нормально
- Принимали быстрые решения для задач
- Не оптимальные, но быстрые
- После выкатывания на прод теперь понятно какие бизнес требования у фичи
-->

---

# Новый ритм обслуживания

<div class="mt-8 grid grid-cols-[1fr_auto_1fr] gap-5 items-center">
  <section class="panel bad">
    <div class="label">раньше</div>
    <div class="mt-5 text-4xl leading-tight font-medium">раз в квартал</div>
  </section>
  <div class="arrow">→</div>
  <section class="panel good">
    <div class="label">AI-native repo</div>
    <div class="mt-5 text-4xl leading-tight font-medium">раз в неделю или две</div>
  </section>
</div>

<div class="mt-8 panel accent">
  <div class="text-4xl leading-tight">
    обслуживание должно ускориться вместе с разработкой
  </div>
</div>

<!--
- раньше рефаткоринг проводился 1 раз в квартал
- теперь стоит это делать чаще - раз в 1 или 2 недели
-->

---

# Агент помогает в maintenance

<div class="mt-8 grid grid-cols-[0.95fr_1.05fr] gap-5">
  <section class="panel accent">
    <div class="label">что даём агенту</div>
    <div class="mt-4 text-4xl leading-tight">
      инструкции для поиска проблем
    </div>
  </section>
  <section class="panel">
    <div class="label">что получаем</div>
    <div class="mt-4 text-4xl leading-tight">
      findings для review
    </div>
  </section>
</div>

<div class="flow mt-7">
  <div class="node blue">инструкция</div>
  <div class="arrow">→</div>
  <div class="node green">агент читает repo</div>
  <div class="arrow">→</div>
  <div class="node orange">ищет признаки</div>
  <div class="arrow">→</div>
  <div class="node purple">готовит report</div>
</div>

<!--
- Здесь агенты могут сильно помочь.
- Можем создать инструкции для поиска таких проблем
-->

---

# Что искать

<div class="mt-8 grid grid-cols-4 gap-4 text-xl font-medium">
  <div class="tile blue">code smells</div>
  <div class="tile green">duplicated logic</div>
  <div class="tile orange">inconsistent patterns</div>
  <div class="tile purple">over-engineering</div>
  <div class="tile red">missing tests</div>
  <div class="tile gray">stale docs</div>
  <div class="tile">unclear boundaries</div>
  <div class="tile">risky dependencies</div>
</div>

<div class="mt-8 text-3xl leading-tight font-medium">
Ищем конкретные признаки расхождения проекта
</div>

<!--
- пересматриваем реализованные решения на основе новых имеющихся данных
- Дублирование логики.
- Разные паттерны для одинаковых задач.
- Слишком сложные абстракции.
- Непонятные границы модулей.
- Недостающие тесты.
- Устаревшую документацию.
- Решения, которые были нормальными неделю назад, но теперь выглядят лишними.
- Это не поиск виноватых. Это нормальная часть обслуживания ускоренного процесса.
-->

---

# Автоматизации по расписанию

<div class="flow mt-10">
  <div class="node blue">cron</div>
  <div class="arrow">→</div>
  <div class="node green">weekly review</div>
  <div class="arrow">→</div>
  <div class="node orange">autonomous report</div>
  <div class="arrow">→</div>
  <div class="node purple">issues / PR</div>
  <div class="arrow">→</div>
  <div class="node gray">human triage</div>
</div>

<div class="mt-10 text-3xl leading-tight font-medium">
Автоматизация ищет, человек решает приоритет
</div>

<!--
- Этот процесс можно запускать автономно по расписанию
-->

---

# Review под разными углами

<div class="review-principle mt-6 accent">
  <div class="label">принцип</div>
  <div class="mt-3 text-4xl leading-tight">
    один review = одна оптика
  </div>
</div>

<div class="review-optics-grid mt-5 grid grid-cols-3 gap-3 text-xl font-medium">
  <div class="card blue">Code smells<br /><small>duplication, coupling, weak tests</small></div>
  <div class="card green">Product<br /><small>journey, states, business rules</small></div>
  <div class="card orange">Security<br /><small>secrets, permissions, attack paths</small></div>
  <div class="card purple">Architecture<br /><small>boundaries, contracts, data flow</small></div>
  <div class="card gray">Docs<br /><small>memory bank, decisions, commands</small></div>
  <div class="card">Dependencies<br /><small>outdated, vulnerable, risky packages</small></div>
</div>

<div class="mt-5 text-2xl leading-tight opacity-80">
  Разные проблемы требуют разных режимов мышления
</div>

<!--
- Эффективнее такие проверки разделять и запускать отдельно
- Так мы позволим агенту фокусироваться на одной задаче
- Проверки нужно запускать под разными углами
-->

---

# Результат review

<div class="mt-8 grid grid-cols-3 gap-4 text-xl font-medium">
  <div class="tile blue">finding</div>
  <div class="tile green">evidence</div>
  <div class="tile orange">impact</div>
  <div class="tile purple">severity</div>
  <div class="tile gray">recommendation</div>
  <div class="tile">next action</div>
</div>

<div class="mt-8 text-3xl leading-tight font-medium">
Review должен заканчиваться пригодным к работе списком findings
</div>

<!--
- Результат таких ревью мы оцениваем вручную и решаем что из этого актуально и стоит чинить
- Для некоторых проблем можно автоматизировать процесс и дать агенту возможность передать эту проблему дальше по цепочке - чтобы другие агенты починили это
-->

---

# Спускаемся в поля

<div class="mt-8 grid grid-cols-[1.05fr_0.95fr] gap-5">
  <section class="panel accent">
    <div class="label">принцип</div>
    <div class="mt-4 text-4xl leading-tight">
      иногда стоит заглядывать в код
    </div>
  </section>

  <section class="panel">
    <div class="label">зачем</div>
    <div class="mt-4 text-4xl leading-tight opacity-85">
      чтобы увидеть реальные паттерны проблем
    </div>
  </section>
</div>

<div class="flow mt-6 manual-review-flow">
  <div class="node blue">заглянуть в код</div>
  <div class="arrow">→</div>
  <div class="node green">найти паттерны</div>
  <div class="arrow">→</div>
  <div class="node orange">обновить критерии</div>
  <div class="arrow">→</div>
  <div class="node purple">обновить skill</div>
</div>

<div class="mt-6 text-2xl leading-tight opacity-80">
  Так появляются новые критерии и обновляются review skills
</div>

<!--
- При этом иногда придётся всё же иногда спускаться "в поля" и заглядывать в код
- Чтобы находить новые паттерны проблем и обновлять skills для ревью
-->


---

# Maintenance как часть SDLC

<div class="flow mt-10">
  <div class="node blue">plan</div>
  <div class="arrow">→</div>
  <div class="node green">act</div>
  <div class="arrow">→</div>
  <div class="node orange">review</div>
  <div class="arrow">→</div>
  <div class="node purple">release</div>
  <div class="arrow">→</div>
  <div class="node gray">maintenance</div>
</div>

<div class="mt-10 text-4xl leading-tight font-medium">
Refactoring больше не редкое большое событие
</div>

<!--
- рефакторинг обязательно нужно встроить в свои процессы работы над репозиторием
-
-->

---

# Итог

<div class="course-summary-main mt-7 accent">
  <div>
    Работа разработчика смещается от написания кода к управлению разработкой
  </div>
</div>

<div class="course-summary-grid mt-6 grid grid-cols-3 gap-3 text-xl font-medium">
  <div class="tile blue">ставить задачи</div>
  <div class="tile green">организовывать процесс</div>
  <div class="tile orange">управлять агентами</div>
  <div class="tile purple">проверять результат</div>
  <div class="tile gray">использовать engineering practices</div>
  <div class="tile">опираться на опыт</div>
</div>

<!--
- работа разраба смещается к управлению
- чем более широкие знания есть, тем лучше
- программированию много десятков лет
- стоит использовать эти наработки
- чем больше опыта в разработке, тем лучше
-->
