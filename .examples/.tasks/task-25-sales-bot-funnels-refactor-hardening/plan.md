# Task-25 — Sales Bot funnels refactor hardening (Implementation Plan)

## 1. Scope (what to implement)

1. Harden the Sales Bot funnels flow so write paths and answer progression are reliable under failure.
2. Eliminate partial funnel writes during create/update:
   1. funnel metadata and structure must be persisted atomically
   2. validation and history-preservation checks must execute within the same write unit
3. Make answer progression retry-safe without adding a background outbox:
   1. accepted answers may still be committed before Telegram delivery
   2. duplicate callback deliveries for an already accepted answer must recover by resending the current active step or completion outcome instead of silently returning duplicate no-op
4. Remove ambiguous start behavior for campaign deep links:
   1. campaign start must require an explicit entry target
   2. generic welcome fallback for campaign starts must be removed
5. Tighten channel-scoped integrity for funnel completion assets:
   1. `completionTemplateId` must belong to the same channel as the funnel
6. Slim the heaviest admin query surfaces:
   1. funnel runs list must stop returning full answer history
   2. funnel run detail must fetch only the requested run
   3. campaign stats must stop using N+1 query aggregation
7. Reduce maintenance cost in the affected sales-bot modules:
   1. split oversized funnel backend modules by responsibility
   2. split oversized sales-bot route module by area
   3. split web funnels UI and normalization code so builder, respondents, and payload mapping are not coupled in one file

## 2. Fixed decisions (must follow)

1. Do not introduce fallbacks or backward compatibility unless explicitly requested by the user.
2. This task is refactor and hardening only:
   1. no new funnel product features
   2. no branching logic
   3. no new analytics dimensions beyond what already exists
3. Campaign start semantics become strict:
   1. a campaign deep link must resolve to exactly one explicit entry target
   2. remove the generic welcome fallback path for campaign starts
4. Retry-safety decision for accepted answers:
   1. do not add a background outbox in this task
   2. recover accepted-answer delivery by reloading current run state on duplicate callback and resending the current active step or completion outcome
5. Funnel writes must be atomic:
   1. create/update metadata and structure in one transaction
   2. no partial success states
6. Completion template integrity is strict:
   1. `completionTemplateId` must exist
   2. it must belong to the same channel as the funnel
   3. invalid completion template references must be rejected on save, not ignored at runtime
7. Funnel run DTO split is intentional:
   1. runs list returns summary only
   2. run detail returns full answer history
   3. web consumers must be updated in the same task
8. Preserve existing history-safety rules:
   1. answered steps/options cannot be destructively removed
   2. active-run current step references cannot be invalidated
   3. historical analytics must continue to use answer snapshots for historical wording
9. Keep current database model unless a small supporting index is clearly needed:
   1. no new tables in this task by default

## 3. Milestone rules (dependencies)

1. Milestones are sequential and dependency-aware.
2. Contract changes must land before consumer updates:
   1. runtime semantics and DTO changes first
   2. backend implementations second
   3. web consumers after backend contracts stabilize
3. Each milestone must keep the affected repo surface green before moving on.
4. Preserve task-24 business invariants while refactoring:
   1. channel-scoped funnels
   2. explicit `allowRestart`
   3. history-safe answers and analytics
5. Avoid mixed-purpose milestones:
   1. correctness hardening first
   2. performance/query slimming second
   3. module decomposition and cleanup after behavior is stable
6. Verification commands must be runnable from repo root.

## 4. Milestone index

| ID | Name | Depends on | Notes |
| --- | --- | --- | --- |
| M1 | Contracts and invariants alignment | none | Lock strict start semantics, duplicate-answer recovery behavior, and list/detail DTO split |
| M2 | Backend correctness hardening | M1 | Make funnel writes atomic, enforce completion template ownership, and implement retry-safe callback recovery |
| M3 | Query slimming and consumer contract update | M2 | Remove heavy run list payloads, add targeted run detail query, replace campaign stats N+1, update web consumers |
| M4 | Module decomposition and final verification | M3 | Split oversized backend/web modules after contracts and behavior are stable |
| M5 | Fix web funnel DTO strictness | M4 | Remove tolerant funnel DTO shims and require real run detail payload before rendering answers |
| M6 | Fix campaign-side funnel DTO strictness | M5 | Remove tolerant funnel list consumption from campaign-side selectors and lock it with tests |
| M7 | Fix campaign-side preload guard | M6 | Preserve strict funnel DTO handling while avoiding pre-response crashes in campaign-side selectors |
| M8 | Fix campaign entry-target integrity after template deletion | M7 | Prevent template deletion from orphaning campaigns and stop invalid campaign payloads from leaking to web consumers |

## 5. Milestone details

### 5.1 M1 — Contracts and invariants alignment

#### 5.1.1 Depends on

1. Depends on: none

#### 5.1.2 Scope

1. Contracts produced/changed:
   1. campaign start semantics:
      1. campaign deep link requires explicit `entryTemplateId` or `entryFunnelId`
      2. generic welcome fallback for campaign starts is removed
   2. funnel callback recovery semantics:
      1. first accepted answer persists and advances/completes the run
      2. duplicate callback for the same accepted answer must reload current run state and resend the current active step or completion outcome
   3. funnel run DTO split:
      1. runs list contract no longer includes full `answers`
      2. run detail contract keeps `answers`
   4. completion template integrity contract:
      1. save rejects `completionTemplateId` that is missing or belongs to another channel
2. Contract sync:
   1. review current backend schemas, route responses, web types, and tests that lock current funnel run list/detail payloads
   2. identify all places that currently depend on `answers` being present in runs list
3. Update backend and web contract definitions:
   1. backend schemas in `packages/backend/src/schemas/sales-bot.ts`
   2. serializers/types where needed
   3. web types and normalization rules
4. Explicitly excluded:
   1. write-path implementation changes
   2. query optimization implementation
   3. module/file split work

#### 5.1.3 Acceptance criteria

1. The refactor has one chosen semantic path for:
   1. campaign start behavior
   2. duplicate accepted-answer recovery
   3. run list versus run detail payload shape
2. Backend and web contracts reflect the chosen semantics.
3. No remaining contract shape depends on keeping generic campaign-start fallback behavior.

#### 5.1.4 Verification

1. `pnpm --filter @tg-channel-stats/backend test:run`
2. `pnpm --filter @tg-channel-stats/web test:run`
3. `pnpm -s typecheck`

### 5.2 M2 — Backend correctness hardening

#### 5.2.1 Depends on

1. Depends on: M1

#### 5.2.2 Scope

1. Contracts consumed:
   1. strict campaign start semantics from M1
   2. duplicate-answer recovery semantics from M1
   3. completion template integrity rule from M1
2. Contract sync:
   1. confirm final route/schema/type expectations from M1 before changing runtime behavior
3. Atomic write path:
   1. refactor funnel create to persist funnel row and structure in one transaction
   2. refactor funnel update to perform validation, history guards, metadata update, and structure update in one transaction
4. Runtime hardening:
   1. implement duplicate callback recovery for already accepted answers
   2. on duplicate answer, reload run state and resend current active step if the run is still active
   3. on duplicate final answer, resend completion outcome when applicable
5. Completion template validation:
   1. validate `completionTemplateId` on create/update through same-channel lookup
   2. reject invalid references with client-visible errors
6. Campaign start strictness:
   1. reject campaign starts with no explicit entry target
   2. remove generic welcome fallback from campaign start path
7. Tests:
   1. add backend coverage for duplicate callback recovery after accepted answer
   2. add backend coverage for atomic create/update failure behavior
   3. add backend coverage for invalid `completionTemplateId`
   4. add backend coverage for strict campaign start without fallback
8. Explicitly excluded:
   1. run list/detail query slimming
   2. route/module decomposition
   3. web component split

#### 5.2.3 Acceptance criteria

1. Funnel create/update cannot leave partially updated state.
2. Accepted-answer retry path can recover delivery through duplicate callback handling without mutating state again.
3. Saving a funnel with a foreign or missing completion template fails fast.
4. Campaign deep links without an explicit entry target no longer send the generic welcome fallback.

#### 5.2.4 Verification

1. `pnpm --filter @tg-channel-stats/backend test:run`
2. `pnpm -s typecheck`

### 5.3 M3 — Query slimming and consumer contract update

#### 5.3.1 Depends on

1. Depends on: M2

#### 5.3.2 Scope

1. Contracts consumed:
   1. run list/detail DTO split from M1
   2. hardened backend behavior from M2
2. Contract sync:
   1. confirm that runs list no longer needs full `answers`
   2. confirm web respondents screens use run detail for full history
3. Funnel query changes:
   1. make runs list query return summary-only payload
   2. implement targeted run detail query by `runId` instead of loading full funnel history
   3. keep results analytics history-safe
4. Campaign query changes:
   1. replace per-campaign stats N+1 with grouped aggregation
5. Web consumer updates:
   1. update hooks, types, and normalization to the summary/detail split
   2. update respondents UI so list view no longer depends on embedded full answers
   3. keep run detail view fully functional
6. Tests:
   1. backend tests for new list/detail query shapes
   2. backend tests for grouped campaign stats behavior
   3. web tests for respondents list/detail under the new DTO split
7. Explicitly excluded:
   1. major file/module decomposition
   2. visual redesign

#### 5.3.3 Acceptance criteria

1. Funnel runs list no longer scales with full answer history payload size.
2. Single run detail no longer loads all funnel runs in memory.
3. Campaign stats no longer execute one stats query pair per campaign.
4. Web respondents UI works against the new summary/detail DTO split.

#### 5.3.4 Verification

1. `pnpm --filter @tg-channel-stats/backend test:run`
2. `pnpm --filter @tg-channel-stats/web test:run`
3. `pnpm -s typecheck`

### 5.4 M4 — Module decomposition and final verification

#### 5.4.1 Depends on

1. Depends on: M3

#### 5.4.2 Scope

1. Contracts consumed:
   1. stable backend/runtime/query contracts from M1-M3
2. Contract sync:
   1. freeze the contract surface from M1-M3 before moving files around
3. Backend decomposition:
   1. split `packages/backend/src/domain/sales-bot/funnels.ts` into focused modules for:
      1. structure writes
      2. history guards
      3. runs queries
      4. results queries
   2. split `packages/backend/src/domain/sales-bot/funnel-runtime.ts` so progression logic is separated from Telegram delivery helpers
   3. split `packages/backend/src/routes/sales-bot.ts` into smaller route modules by area
4. Web decomposition:
   1. split `FunnelsSection.tsx` into builder, results, and respondents panes
   2. extract funnel draft payload mapping into a dedicated helper or hook
   3. split funnel normalizers away from unrelated sales-bot normalizers where practical
   4. replace native confirm usage in the affected funnels flows with the app dialog pattern already used by the repo
5. Final verification and cleanup:
   1. remove dead code left from old fallback/list-contract behavior
   2. run full repo checks
6. Explicitly excluded:
   1. new business capabilities
   2. unrelated sales-bot tabs beyond the contract/module changes required by this refactor

#### 5.4.3 Acceptance criteria

1. Backend funnel code no longer concentrates write path, read path, analytics, and runtime delivery in the same files.
2. Web funnels UI no longer concentrates builder, respondents, and payload mapping in one component.
3. The affected sales-bot route area is split into smaller modules without changing final behavior from M1-M3.
4. Full repo verification passes.

#### 5.4.4 Verification

1. `pnpm --filter @tg-channel-stats/backend test:run`
2. `pnpm --filter @tg-channel-stats/web test:run`
3. `pnpm -s typecheck`
4. `pnpm -s test:run`

### 5.5 M5 — Fix web funnel DTO strictness

#### 5.5.1 Depends on

1. Depends on: M4

#### 5.5.2 Scope

1. Trigger:
   1. Reviewer found a high-severity contract violation after M1-M4 completion
   2. funnel-specific web consumers still accept legacy/tolerant payload envelopes and synthesize detail from summary rows
2. What must change:
   1. remove funnel-specific raw-array and `{ data: ... }` fallback handling from the funnel DTO normalization path
   2. keep funnel run detail `null` or loading until `useSalesBotFunnelRun` returns the actual detail payload
   3. ensure respondents UI does not fabricate `answers: []` from summary rows
   4. keep funnel list contract aligned with backend `{ items: ... }` response shape only
3. What must remain true:
   1. runs list remains summary-only and must not regain embedded `answers`
   2. run detail remains the only source of full `answers`
   3. no backward compatibility or fallback DTO path is introduced
   4. M1-M4 runtime, query, and decomposition behavior remains unchanged beyond the narrow web contract fix
4. Tests:
   1. update web tests to lock strict funnel DTO handling
   2. verify respondents detail flow waits for real detail payload instead of fabricating one

#### 5.5.3 Acceptance criteria

1. Funnel-specific web normalization rejects legacy/tolerant DTO envelopes instead of silently accepting them.
2. Respondents UI waits for actual run detail payload before rendering answer history.
3. No code path reintroduces `answers` into run list summaries.
4. Web tests cover the strict DTO behavior and real-detail rendering flow.

#### 5.5.4 Verification

1. `pnpm --filter @tg-channel-stats/web test:run`
2. `pnpm -s typecheck`
3. `pnpm -s test:run`

### 5.6 M6 — Fix campaign-side funnel DTO strictness

#### 5.6.1 Depends on

1. Depends on: M5

#### 5.6.2 Scope

1. Trigger:
   1. reviewer found that campaign-side funnel selection still consumes funnel list payloads through a tolerant normalization path after M5
2. What must change:
   1. update campaign-side funnel list consumption to use strict funnel list normalization aligned to backend `{ items: ... }`
   2. remove campaign-side reliance on tolerant `toSalesBotItems` handling for funnel lists
   3. add a regression test proving raw-array and `{ data: ... }` funnel list payloads are not accepted in the campaign-side consumer path
3. What must remain true:
   1. M5 strict respondents/detail behavior remains unchanged
   2. runs list stays summary-only
   3. run detail remains the only source of `answers`
   4. no fallback or backward-compatible funnel DTO handling is reintroduced anywhere in funnel consumers
   5. backend/runtime/query behavior from M1-M4 remains unchanged
4. Tests:
   1. update campaign-side UI or normalization tests to lock strict funnel list consumption

#### 5.6.3 Acceptance criteria

1. Campaign-side funnel selectors consume only the strict funnel list `{ items: ... }` contract.
2. No campaign-side code path accepts raw-array or `{ data: ... }` funnel list payloads.
3. Regression tests cover the campaign-side strictness behavior.
4. Existing M5 fixes remain intact.

#### 5.6.4 Verification

1. `pnpm --filter @tg-channel-stats/web test:run`
2. `pnpm -s typecheck`
3. `pnpm -s test:run`

### 5.7 M7 — Fix campaign-side preload guard

#### 5.7.1 Depends on

1. Depends on: M6

#### 5.7.2 Scope

1. Trigger:
   1. reviewer found that the M6 campaign-side strict normalizer is called before SWR data is available, creating a loading-state crash risk
2. What must change:
   1. guard campaign-side funnel list normalization for the pre-response loading state
   2. preserve strict `{ items: ... }` handling once data exists
   3. add regression coverage for `data: undefined` during initial loading
3. What must remain true:
   1. no raw-array or `{ data: ... }` fallback is reintroduced
   2. campaign-side funnel selectors still consume only the strict funnel list contract after data arrives
   3. M5 respondents/detail strictness remains unchanged
   4. M1-M6 backend/runtime/query behavior remains unchanged
4. Tests:
   1. update campaign-side tests to cover loading-state rendering with `data: undefined`

#### 5.7.3 Acceptance criteria

1. Campaign-side funnel selector does not throw before the strict payload arrives.
2. Strict `{ items: ... }` funnel DTO handling remains intact after data arrives.
3. Regression tests cover the loading-state guard.
4. No tolerant funnel DTO path is reintroduced.

#### 5.7.4 Verification

1. `pnpm --filter @tg-channel-stats/web test:run`
2. `pnpm -s typecheck`
3. `pnpm -s test:run`

### 5.8 M8 — Fix campaign entry-target integrity after template deletion

#### 5.8.1 Depends on

1. Depends on: M7

#### 5.8.2 Scope

1. Trigger:
   1. verified runtime error: `Invalid sales bot payload: campaign.entryTarget must be exactly one non-null entryTemplateId or entryFunnelId`
   2. verified backend integrity gap: deleting a template currently clears `campaign.entryTemplateId`, which can leave a campaign with no entry target
2. What must change:
   1. reject template deletion when the template is still referenced as a campaign entry target
   2. ensure campaign serialization/listing fails fast instead of emitting invalid entry-target payloads to the web layer
   3. return client-visible errors for destructive template operations or invalid persisted campaign rows rather than allowing an uncaught frontend payload crash
3. What must remain true:
   1. strict campaign xor contract stays intact: exactly one of `entryTemplateId` or `entryFunnelId`
   2. no fallback or backward-compatible campaign payload handling is introduced
   3. M1-M7 runtime, query, and UI contract behavior remains unchanged beyond this narrow integrity fix
   4. funnel/template deletion rules stay channel-scoped and explicit
4. Tests:
   1. backend tests for rejecting template deletion when a campaign depends on that template
   2. backend tests for failing fast on invalid persisted campaign entry-target state
   3. verification that campaign-facing web consumers no longer receive invalid payloads from the backend path

#### 5.8.3 Acceptance criteria

1. Deleting a template that is still used by a campaign entry target fails fast with a client-visible error.
2. Backend campaign payloads do not leak invalid xor state to the web consumer path.
3. Existing strict frontend normalization remains valid and does not need compatibility relaxation.
4. Verification passes without reopening earlier milestone semantics.

#### 5.8.4 Verification

1. `pnpm --filter @tg-channel-stats/backend test:run`
2. `pnpm --filter @tg-channel-stats/web test:run`
3. `pnpm -s typecheck`
4. `pnpm -s test:run`

## 6. Execution order (derived from dependencies)

1. M1 — Contracts and invariants alignment
2. M2 — Backend correctness hardening
3. M3 — Query slimming and consumer contract update
4. M4 — Module decomposition and final verification
5. M5 — Fix web funnel DTO strictness
6. M6 — Fix campaign-side funnel DTO strictness
7. M7 — Fix campaign-side preload guard
8. M8 — Fix campaign entry-target integrity after template deletion

## Orchestration (managed by orchestrator)

| Milestone | Status | Commits |
| --- | --- | --- |
| M1 — Contracts and invariants alignment | done | d2fc0e8, 18c882a |
| M2 — Backend correctness hardening | done | b94e641, a968d4b |
| M3 — Query slimming and consumer contract update | done | 070afb0, 2112d61, df3386c |
| M4 — Module decomposition and final verification | done | d5ff1fe, 4866905, 0f7ed81, 96c90c0 |
| M5 — Fix web funnel DTO strictness | done | dfa89a0, e81939d |
| M6 — Fix campaign-side funnel DTO strictness | done | f7e87ec, 2793af5, 9b430e7 |
| M7 — Fix campaign-side preload guard | done | 7eafc3e, 073809c, 3c9c2da, 615ae3c |
| M8 — Fix campaign entry-target integrity after template deletion | done | f64b16e, d5a9c26, 25069ee |
| Reviewer | done | PASS |
