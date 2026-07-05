## M1 — Contracts and persistence foundation

Status: done

1. Summary of changes:
1. Updated DB contracts in `sales_bot_funnel_steps`, `sales_bot_funnel_step_options`, `sales_bot_funnel_runs`, and `sales_bot_funnel_answers` for `selectionMode`, `kind`, transient run interaction state, multi-row answers, and `customTextSnapshot`.
2. Replaced answer uniqueness from `(runId, stepId)` to `(runId, stepId, optionId)` and kept active-run uniqueness plus ordered step/option integrity constraints intact.
3. Synced backend/web contracts and normalizers/serializers for the new step/option/answer/run interaction shapes, and updated touched tests that encoded old questionnaire payload assumptions.

2. Preserved constraints/invariants:
1. No compatibility/fallback fields were introduced; new behavior is represented via explicit fields and strict enum-like contracts.
2. Run-level active uniqueness and ordered funnel step/option structure integrity remain preserved.
3. History-safe answer snapshots remain preserved (`questionTextSnapshot`, `optionTextSnapshot`) and were extended with `customTextSnapshot`.

3. Issues encountered and resolution:
1. `db:migrate` cannot connect to local Postgres in this environment (`connect EPERM ::1/127.0.0.1:5432`); migration artifacts were still generated successfully via Drizzle.
2. `pnpm qc` initially surfaced backend test payload type drift after contract tightening; updated `funnels.test.ts` payloads to include new required questionnaire fields.
3. Git metadata directory is not writable in this environment (`Operation not permitted` on `.git/index.lock`), so staging/commit creation could not be completed here.

4. Verification commands and outcomes:
1. `pnpm --filter @tg-channel-stats/database build` — pass.
2. `pnpm --filter @tg-channel-stats/database db:generate` — pass (generated `0016_large_arclight.sql`, then no-op on rerun).
3. `set -a && source packages/backend/.env && set +a && pnpm --filter @tg-channel-stats/database db:migrate` — fail in environment (`EPERM` connection to localhost Postgres).
4. `pnpm -s typecheck` — pass.
5. `pnpm qc` — pass.

5. Commits:
1. none (blocked by `.git` write restriction in current environment)

## M2 — Runtime answering and webhook routing

Status: done

1. Summary of changes:
1. Implemented strict funnel callback protocol with explicit actions: `select` and `submit` (`fa:<channelId>:<runId>:<stepId>:select:<optionId>` and `fa:<channelId>:<runId>:<stepId>:submit`).
2. Added runtime behavior for `multiple` steps: pending toggle state on run, inline keyboard refresh with `✅` markers, explicit `➡️ Проголосовать` submit button, empty-submit rejection message, and submit-time persistence with one answer row per selected option.
3. Added runtime behavior for `custom` answers: entering waiting-for-text mode, `Введите ваш вариант ответа` prompt, interception of the next inbound private-chat text/non-text while waiting, whitespace rejection, custom-text truncation to 1000 chars, and advancement/completion after valid text.
4. Implemented strict stale callback rejection for completed steps with `Нельзя изменить ответ на уже пройденный вопрос`, no state mutation, and no resend of next-step/completion payloads.
5. Synced touched runtime tests/contracts for new callback shape and M2 behavior (`webhook.test.ts`, `utils.test.ts`) while keeping non-funnel Sales Bot surfaces unchanged.

2. Preserved constraints/invariants:
1. No fallback/backward-compatible callback parsing or runtime branching behavior was introduced.
2. Questionnaire progression remains linear with single active run uniqueness, atomic progression writes, idempotent duplicate-callback handling, and history-safe snapshots.
3. M1 contracts were consumed as-is (`selectionMode`, `option.kind`, multi-row answers, run interaction state fields).

3. Issues encountered and resolution:
1. Backend test commands requiring Vitest global setup were blocked by missing container runtime (`testcontainers` could not start Postgres). Captured as environment limitation; no runtime fallback was introduced.
2. `pnpm qc` surfaced a strict type mismatch between DB client and transaction callback type in `funnel-runtime-progression.ts`; fixed by typing the helper transaction parameter as inferred transaction type.
3. Git index locking was intermittently blocked for direct `git add` (`Operation not permitted` on `.git/index.lock`); resolved by committing tracked pathspecs directly.
4. Follow-up regression from orchestrator hooks in `webhook.test.ts` was caused by the completion idempotency test capturing `/start` result into `finalCallbackResult`; corrected callback result variable assignment to assert against the actual final-step callback response shape.

4. Verification commands and outcomes:
1. `pnpm --filter @tg-channel-stats/backend test:run -- webhook.test.ts` — fail in environment (`Could not find a working container runtime strategy`).
2. `pnpm --filter @tg-channel-stats/backend test:run -- bot/sales-bot.test.ts` — fail in environment (same `testcontainers` runtime issue).
3. `pnpm --filter @tg-channel-stats/backend test:run` — fail in environment (same `testcontainers` runtime issue).
4. `pnpm -s typecheck` — pass.
5. `pnpm --filter @tg-channel-stats/backend type-check` — pass.
6. `pnpm qc` — pass.
7. `pnpm test:run` — pass (Turbo replay included successful `@tg-channel-stats/backend` run with `src/domain/sales-bot/webhook.test.ts` passing).

5. Commits:
1. `a3318a8a8cd54f101e40a6c3d3b86196dc30ce3a` — M2 runtime/webhook implementation baseline.
2. `3c86273f2c7e3eb6fcf4ae915f03392e3a6c46cb` — completion callback regression fix in `webhook.test.ts` + progress log update.

## M3 — Admin API, validation, and reporting contracts

Status: done

1. Summary of changes:
1. Extended funnel read contracts with explicit `structuralValidity` in backend schemas/DTO serialization for both list and detail responses, and synced web sales-bot types/normalizers to consume it.
2. Added strict server-side builder guards: reject more than one `custom` option per step, and reject `selectionMode` changes on steps that already have persisted answers.
3. Kept activation/campaign structural validation strict by validating custom-option cardinality in addition to required step/question/option structure.
4. Updated respondent-detail runtime reporting contract to grouped question-level answers with per-selection snapshots, including full stored `customTextSnapshot`, and synced backend/web consumers.
5. Added/updated tests across backend domain/routes/schemas and web normalization/UI tests to cover M3 contracts: structural validity exposure, guard enforcement, multi-select/custom aggregation, and grouped respondent detail.

2. Preserved constraints/invariants:
1. No fallback/backward-compatibility branches were introduced; contracts are explicit and strict.
2. Linear questionnaire progression and M1/M2 runtime persistence semantics remain unchanged.
3. Task-24/task-25 invariants remain intact: channel scope, allowRestart semantics, atomic structure writes, callback idempotency guarantees, and snapshot-driven history/reporting.

3. Issues encountered and resolution:
1. Backend Vitest commands still require a container runtime; targeted backend test commands and `pnpm test:run` fail in this environment with `Could not find a working container runtime strategy`.
2. `pnpm qc` initially surfaced TypeScript literal-union mismatches in new backend tests; fixed test payload literals and reran checks.

4. Verification commands and outcomes:
1. `pnpm --filter @tg-channel-stats/backend test:run -- routes/sales-bot.test.ts` — fail in environment (`Could not find a working container runtime strategy`).
2. `pnpm --filter @tg-channel-stats/backend test:run -- domain/sales-bot/funnels.test.ts` — fail in environment (same container runtime issue).
3. `pnpm --filter @tg-channel-stats/backend test:run -- domain/sales-bot/campaigns.test.ts` — fail in environment (same container runtime issue).
4. `pnpm --filter @tg-channel-stats/backend test:run -- schemas/sales-bot.test.ts` — fail in environment (same container runtime issue).
5. `pnpm -s typecheck` — pass.
6. `pnpm test:run` — fail in environment because backend testcontainer runtime is unavailable.
7. `pnpm qc` — pass.

5. Commits:
1. `f49d332ea31ad7ac23c05229aa60da11124d6c36` — M3 admin API validation/reporting contracts + consumer sync.

## M4 — Web builder, campaigns, and respondents UI

Status: done

1. Summary of changes:
1. Updated funnels builder UI for advanced inputs: multiline question `textarea`, per-question `selectionMode` control, question-length feedback (`3000`), option-kind editing, and single-custom-option guard messaging.
2. Added draft-only plain-text parser UX in empty-questionnaire state with strict syntax (`*` question, `-` option), fail-fast actionable line errors, and parse-to-draft behavior without auto-save.
3. Updated campaigns UI with explicit copy-link success/failure feedback and pre-save blocking/explanation for already-known invalid entry funnels using M3 structural validity signals.
4. Confirmed respondents/results rendering for grouped multi-select/custom-answer data and extended web tests to lock these M4 behaviors.

2. Preserved constraints/invariants:
1. No fallback/backward-compatible behavior was introduced in builder/campaign/respondent flows.
2. Linear questionnaire/runtime semantics from M1-M3 were preserved; this milestone only consumes existing DTO/runtime contracts.
3. Unaffected Sales Bot surfaces remained unchanged (broadcasts/publisher/inbox outside waiting-for-text interception, entry-template flow).

3. Issues encountered and resolution:
1. Local git staging via `git add` is blocked in this environment (`.git/index.lock` permission); used direct pathspec commit flow for tracked files.
2. Test override for empty-funnel parser scenario initially caused render loops due unstable mock object identity; fixed by using a stable mocked detail object and restoring prior mock implementation in `finally`.

4. Verification commands and outcomes:
1. `pnpm --filter @tg-channel-stats/web test:run -- components/sales-bot/sections/FunnelsSection.test.tsx` — pass.
2. `pnpm --filter @tg-channel-stats/web test:run -- components/sales-bot/sections/CampaignsSection.test.tsx` — pass.
3. `pnpm --filter @tg-channel-stats/web test:run -- hooks/sales-bot/normalize.test.ts` — pass.
4. `pnpm --filter @tg-channel-stats/web test:run` — pass.
5. `pnpm -s typecheck` — pass.
6. `pnpm qc` — pass.

5. Commits:
1. `716d4af7308775bad64702dfcebe767f66f4873d` — M4 web builder/campaign/respondent UI implementation + tests.

## M5 — Regression coverage and repo verification

Status: done

1. Summary of changes:
1. Closed the remaining backend contract drift by aligning funnel question payload validation with the fixed `3000`-character question-text limit.
2. Added strict schema and route regression coverage for advanced funnel input validation: question-text limit, invalid `selectionMode`, invalid option `kind`, and oversized route payload rejection.
3. Added migration-sensitive answer persistence coverage proving the final uniqueness shape allows one row per selected option while rejecting duplicate `(runId, stepId, optionId)` inserts.
4. Tightened webhook coverage for waiting-for-text interception so inbound messages do not route into inbox threads until questionnaire waiting state clears.

2. Preserved constraints/invariants:
1. No fallback or compatibility behavior was introduced; M5 only locked the final M1-M4 behavior with tests and one narrow schema correction.
2. Existing task-24/task-25 invariants remain preserved: channel scope, allowRestart semantics, atomic writes, duplicate callback idempotency, and history-safe snapshots.
3. Final product messages and runtime state transitions from M2-M4 were kept unchanged.

3. Issues encountered and resolution:
1. Backend testcontainers are available in this environment now, so previously blocked backend verification was rerun live instead of being reported as environment-limited.
2. Coverage audit surfaced a real mismatch between backend schema validation (`4000`) and the fixed questionnaire contract/UI (`3000`); corrected the schema and locked it with tests before final verification.

4. Verification commands and outcomes:
1. `pnpm --filter @tg-channel-stats/backend test:run -- schemas/sales-bot.test.ts routes/sales-bot.test.ts domain/sales-bot/funnels.test.ts domain/sales-bot/webhook.test.ts` — pass.
2. `pnpm --filter @tg-channel-stats/backend test:run` — pass.
3. `pnpm --filter @tg-channel-stats/web test:run` — pass.
4. `pnpm -s test:run` — pass.
5. `pnpm qc` — pass.

5. Commits:
1. pending

## M6 — Draft-only parser gating fix

Status: done

1. Summary of changes:
1. Restricted plain-text questionnaire parser rendering to empty draft funnels only.
2. Added a matching execution guard so non-draft funnels reject parser use even if they have zero questions.
3. Added focused web regressions proving parser remains available for empty draft funnels and stays hidden for empty active/archived funnels.

2. Verification commands and outcomes:
1. `pnpm --filter @tg-channel-stats/web test:run -- components/sales-bot/sections/FunnelsSection.test.tsx` — pass.
2. `pnpm --filter @tg-channel-stats/web test:run` — pass.
3. `pnpm -s typecheck` — pass.
4. `pnpm qc` — pass.

3. Commits:
1. pending
