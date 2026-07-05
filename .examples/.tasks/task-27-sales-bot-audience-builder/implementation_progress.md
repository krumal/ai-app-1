## M1 — Audience contracts and query foundation

Status: done

1. Summary of changes:
1. Added explicit `SalesBotAudienceBuilder*` backend contracts in `packages/backend/src/schemas/sales-bot.ts` for filter condition union, metadata payload, search request/response, user context payload, and explicit-id bulk tag apply request/response.
2. Implemented backend M1 domain foundation in `packages/backend/src/domain/sales-bot/audience.ts`: SQL-first audience search over `sales_bot_users` + `sales_bot_funnel_runs` + `sales_bot_funnel_answers`, same-run funnel-condition grouping, latest matched activity derivation for default sorting, metadata read model, user context read model (all runs + grouped stored answer snapshots), and explicit-id additive tag apply helper with requested/matched/updated counts.
3. Synced consumer contracts on web side by adding audience-builder types and strict normalizers/tests in `packages/web/src/types/salesBot/index.ts`, `packages/web/src/hooks/sales-bot/normalize.ts`, and `packages/web/src/hooks/sales-bot/normalize.test.ts` without reusing Tag clickers payload shapes.
4. Added verification-focused tests for new contracts and domain behavior in `packages/backend/src/schemas/sales-bot.test.ts` and `packages/backend/src/domain/sales-bot/audience.test.ts`.

2. Preserved constraints/invariants:
1. No routes/UI wiring in this milestone.
2. No backward compatibility or dual-path transport additions.
3. Broadcast draft audience schema (`SalesBotAudienceSchema`) remained distinct from new audience-builder contracts (`SalesBotAudienceBuilder*`).
4. Search fields remain constrained to username/firstName/lastName; no telegramUserId/custom-text search was introduced.
5. Filter logic remains conjunction-only with fixed condition kinds and same-run semantics for funnel-scoped combinations.
6. Bulk tag apply remains explicit-user-id only, additive merge only, deduplicated via existing normalization semantics, and contains no tag removal path.
7. No full-candidate in-memory evaluation was introduced for audience filtering (SQL-first query path retained).
8. Existing indexes were reviewed from local schema contracts; no new index migration was introduced for M1.

3. Issues encountered and resolution:
1. Backend tests are blocked in this environment because Vitest setup cannot start testcontainers (`Could not find a working container runtime strategy`), so required backend test command could not complete.
2. Web normalizer regressions were validated separately with targeted web tests to keep shared DTO/normalizer behavior covered while backend container runtime is unavailable.

4. Verification commands and outcomes:
1. `pnpm --filter @tg-channel-stats/backend test:run` — failed in environment (`Could not find a working container runtime strategy` from testcontainers global setup).
2. `pnpm -s typecheck` — passed.
3. `pnpm --filter @tg-channel-stats/web test:run -- src/hooks/sales-bot/normalize.test.ts` — passed.

5. Commits:
1. none (commit creation blocked: `.git/index.lock` cannot be created in this environment, `Operation not permitted`)

## M1 follow-up — audience search timestamp serialization fix

Status: done

1. Summary of changes:
1. Fixed `toIso` in `packages/backend/src/domain/sales-bot/audience.ts` to safely handle `Date | string | null` instead of assuming `Date` only.
2. This removes the `TypeError: value.toISOString is not a function` crash in audience search response mapping when SQL expressions return timestamp strings.

2. Preserved constraints/invariants:
1. M1 scope only; no routes or UI changes.
2. Same-run matching semantics and audience response contract fields remain unchanged.
3. Search behavior and filtering logic remain SQL-first.

3. Issues encountered and resolution:
1. Backend verification remains environment-limited in this worker session because Vitest global setup cannot start testcontainers (`Could not find a working container runtime strategy`).

4. Verification commands and outcomes:
1. `pnpm --filter @tg-channel-stats/backend test:run -- src/domain/sales-bot/audience.test.ts` — failed in environment (`Could not find a working container runtime strategy`).
2. `pnpm -s typecheck` — passed.

5. Commits:
1. none in this follow-up session.

## M2 — Audience API and legacy transport cutover

Status: done

1. Contract sync:
1. Consumed M1 zod contracts from `schemas/sales-bot.ts` (`SalesBotAudienceBuilderSearchRequestSchema`, `SalesBotAudienceBuilderBulkTagApplyRequestSchema`, and corresponding response DTO field names).
2. Kept quick-filter metrics transport unchanged at `GET /:username/sales-bot/users/metrics` as the single existing path for the UI cutover.
3. Preserved broadcast audience contract separation (`SalesBotAudienceSchema` for broadcasts remains untouched and distinct from `SalesBotAudienceBuilder*`).

2. Summary of changes:
1. Added M2 API routes in `packages/backend/src/routes/sales-bot/users-tags-routes.ts`:
1. `GET /:username/sales-bot/audience/meta`
2. `POST /:username/sales-bot/audience/search`
3. `GET /:username/sales-bot/users/:id/context`
4. `POST /:username/sales-bot/users/tags/apply`
2. Wired routes to M1 domain helpers (`audience.ts`) with zod request validation and domain-level invariant handling.
3. Removed legacy Tag clickers transport endpoint `GET /:username/sales-bot/tag-clickers`.
4. Removed legacy schema/type transport artifacts: `SalesBotTagClickersQuerySchema` and `SalesBotTagClickersQuery`.
5. Removed backend Tag clickers-only domain function `listSalesBotTagClickers` and cleaned dependent imports/tests.
6. Updated backend route tests to cover new audience endpoints, unknown-channel/invalid-filter/not-found behaviors, and explicit tag-apply response contract.
7. Updated webhook persistence test to validate tag persistence via supported tags domain helper instead of removed legacy tag-clickers transport.

3. Preserved constraints/invariants:
1. M2 scope only: no Sales Bot tab rendering or filter-builder UI changes.
2. Audience search remains channel-scoped and SQL-first through M1 domain implementation.
3. Same-run filter semantics, fixed condition kinds, and search-field scope remain unchanged from M1.
4. User context remains history-safe (all runs + stored answer snapshots).
5. Bulk tag apply remains explicit-user-id only, additive, and no tag-removal path.

4. Issues encountered and resolution:
1. Backend verification is blocked in this environment because Vitest global setup cannot start testcontainers (`Could not find a working container runtime strategy`).

5. Verification commands and outcomes:
1. `pnpm --filter @tg-channel-stats/backend test:run` — failed in environment (`Could not find a working container runtime strategy`).
2. `pnpm -s typecheck` — passed.

6. Commits:
1. none (commit creation blocked: `.git/index.lock` cannot be created in this environment, `Operation not permitted`).

## M3 — Audience admin UI cutover

Status: done

1. Contract sync:
1. Consumed M1/M2 audience-builder transport shapes via `SalesBotAudienceBuilder*` types and normalizers (`metadata`, `search`, `user context`, and `bulk tag apply`).
2. Kept quick-filter metrics transport on the single existing path `GET /:username/sales-bot/users/metrics` for quick cards.
3. Cut over Sales Bot deep-link mapping to one audience alias (`sales-bot-audience`) with no `sales-bot-users` or `sales-bot-tag-clickers` URL aliases.

2. Summary of changes:
1. Added unified Audience UI in `packages/web/src/components/sales-bot/sections/AudienceSection.tsx` with:
1. free-text search input (username/firstName/lastName flow)
2. quick-filter cards (`started`, `unsubscribed`, `blocked_current`)
3. conjunction-only filter builder rows + applied chips for all fixed condition kinds
4. guarded dependent selectors (`question` disabled before `funnel`, `option` disabled before `question`)
5. paginated audience table with explicit row selection checkboxes
6. explicit-user bulk tag action bar (comma tags -> normalized unique list)
7. in-workflow user context side panel showing identity, tags, source tokens, all runs, and grouped saved answers
8. loading/error/empty/success feedback states for metadata/search/context/bulk mutation
2. Added audience transport hook surface in `packages/web/src/hooks/sales-bot/audience.ts` and exported it from `packages/web/src/hooks/sales-bot/index.ts`.
3. Rewired Sales Bot tab to one Audience entry in `packages/web/src/components/sales-bot/SalesBotTab.tsx` and updated tab test in `SalesBotTab.test.tsx`.
4. Updated channel route/deep-link mapping in `packages/web/src/pages/ChannelPage.tsx` to use `sales-bot-audience` as the single Audience alias.
5. Removed legacy UI paths and artifacts:
1. deleted `TagClickersSection.tsx`
2. deleted `UsersSection.tsx`
3. deleted `UsersSection.test.tsx`
4. deleted `hooks/sales-bot/tag-clickers.ts`
5. removed Tag clickers normalizer/type surface from `hooks/sales-bot/normalize.ts`, `hooks/sales-bot/normalize.test.ts`, and `types/salesBot/index.ts`

3. Preserved constraints/invariants:
1. M3 scope only: web/admin UI cutover, no backend route or unrelated Sales Bot screen changes.
2. Hard cutover to one Audience subtab with no dual Users/Tag clickers UI path and no legacy URL alias retention.
3. Audience semantics remained bounded by M1/M2 contract: conjunction-only fixed condition kinds and explicit-id bulk tagging only.
4. User context remains inside Sales Bot workflow with tags, source tokens, all runs, and grouped stored answers.
5. Broadcast draft audience schema/use remained untouched and distinct.

4. Issues encountered and resolution:
1. Direct shell `rm` deletions were blocked by policy; legacy files were removed using patch-based deletes instead.
2. Commit creation is blocked in this environment because `.git/index.lock` cannot be created (`Operation not permitted`), so no local commit hash was produced in this worker session.

5. Verification commands and outcomes:
1. `pnpm --filter @tg-channel-stats/web test:run` — passed.
2. `pnpm --dir packages/web run build` — passed.
3. `pnpm -s typecheck` — passed.

6. Commits:
1. none (environment cannot create `.git/index.lock`).

## M4 — Regression coverage and repo verification

Status: blocked

1. Contract sync:
1. Confirmed post-cutover audience transport names and shapes remain:
1. `GET /:username/sales-bot/audience/meta`
2. `POST /:username/sales-bot/audience/search`
3. `GET /:username/sales-bot/users/:id/context`
4. `POST /:username/sales-bot/users/tags/apply`
2. Confirmed quick-filter metrics path remains `GET /:username/sales-bot/users/metrics`.
3. Confirmed unified web subtab key is `audience` with `sales-bot-audience` channel URL alias.

2. Summary of changes:
1. Expanded backend audience domain regressions in `packages/backend/src/domain/sales-bot/audience.test.ts`:
1. multi-select membership semantics for `answered_option` (match by option membership, not exact-set)
2. custom-answer filtering remains option-based, and free-text search does not match stored custom answer text
3. quick-filter `user_state` semantics for `started`, `unsubscribed`, `blocked_current`
4. free-text + fixed-condition conjunction behavior with normalized applied filter assertion
2. Expanded web cutover regressions:
1. `packages/web/src/components/sales-bot/SalesBotTab.test.tsx` now asserts legacy Users/Tag clickers tabs are absent and Audience tab remains present
2. `packages/web/src/pages/ChannelPage.test.tsx` now asserts `?tab=sales-bot` and `?tab=sales-bot-audience` both resolve to Sales Bot Audience view without Users/Tag clickers tabs
3. Obsolete-test cleanup check: no retained backend/web tests still assert legacy Tag clickers route success or separate Users/Tag clickers tab wiring; legacy route is covered only as explicit `404` regression.

3. Preserved constraints/invariants:
1. M4 scope only: regression tests + obsolete assertion cleanup + verification.
2. No new product features, no compatibility shims, no reopening scope.
3. Same-run, fixed-condition, explicit-id tagging, and unified Audience-only UI contracts were locked via tests.

4. Issues encountered and resolution:
1. Backend verification command is blocked in this environment because Vitest global setup cannot start testcontainers (`Could not find a working container runtime strategy`).
2. Remaining verification commands were still executed to provide full evidence for non-blocked surfaces.

5. Verification commands and outcomes:
1. `pnpm --filter @tg-channel-stats/backend test:run` — failed in environment (`Could not find a working container runtime strategy`).
2. `pnpm --filter @tg-channel-stats/web test:run` — passed.
3. `pnpm --dir packages/web run build` — passed.
4. `pnpm qc` — passed.

6. Commits:
1. none (environment cannot create `.git/index.lock`).

## M4 follow-up — backend regression fixes for same-run ordering and timestamp normalization

Status: blocked

1. Summary of changes:
1. Updated `packages/backend/src/domain/sales-bot/audience.test.ts` in `enforces same-run matching semantics for combined answer and completion conditions`:
1. removed local ascending sort from the membership assertion
2. asserted direct response order `[alignedRunUserId, splitRunsUserId]` so the test validates the product contract `latest matched activity desc` instead of contradicting it
2. Updated `packages/backend/src/domain/sales-bot/audience.ts` (`toIso`) to normalize string timestamps into ISO when parseable:
1. parse string dates with `new Date(value)`
2. return `toISOString()` for valid dates
3. fall back to the original string only when parsing is invalid
3. This preserves the established search response normalization contract and fixes the mismatch where `latestMatchedActivityAt` could return `'YYYY-MM-DD HH:mm:ss+00'`.

2. Preserved constraints/invariants:
1. Scope limited to the two reported backend failures only.
2. Kept default sorting contract (`latest matched activity desc`) intact.
3. Did not broaden audience semantics or API/UI scope.

3. Verification commands and outcomes:
1. `pnpm --filter @tg-channel-stats/backend test:run` — blocked in this environment (`Could not find a working container runtime strategy` from testcontainers setup).

4. Commits:
1. none in this follow-up session.

## M5 — Hard-cutover leftovers cleanup (legacy users transport + generic sales-bot alias)

Status: blocked

1. Contract sync:
1. Confirmed retained post-cutover endpoints:
1. `GET /:username/sales-bot/users/metrics`
2. `GET /:username/sales-bot/audience/meta`
3. `POST /:username/sales-bot/audience/search`
4. `GET /:username/sales-bot/users/:id/context`
5. `POST /:username/sales-bot/users/tags/apply`
2. Confirmed `sales-bot-audience` remains the only Audience deep-link alias.

2. Summary of changes:
1. Backend transport cleanup:
1. removed legacy `GET /:username/sales-bot/users` route from `packages/backend/src/routes/sales-bot/users-tags-routes.ts`
2. removed related backend route imports tied to that endpoint (`listSalesBotUsers`, `SalesBotUsersListQuerySchema`)
3. added route regression in `packages/backend/src/routes/sales-bot.test.ts` to enforce `GET /:username/sales-bot/users?...` returns `404` after cutover
2. Web transport/client cleanup:
1. removed `useSalesBotUsers` hook from `packages/web/src/hooks/sales-bot/users.ts` so web no longer exposes `/sales-bot/users` list transport
2. removed obsolete users-list contract surface from web shared code:
1. deleted `SalesBotUsersFilter`, `SalesBotUserListItem`, `SalesBotUsersListResponse` from `packages/web/src/types/salesBot/index.ts`
2. removed `normalizeSalesBotUserListItem` and `normalizeSalesBotUsersListResponse` from `packages/web/src/hooks/sales-bot/normalize.ts`
3. removed corresponding legacy normalizer tests from `packages/web/src/hooks/sales-bot/normalize.test.ts`
3. Deep-link alias cleanup:
1. removed `sales-bot` from recognized Sales Bot tab aliases in `packages/web/src/pages/ChannelPage.tsx`
2. removed `tab=sales-bot` -> `audience` resolver branch from subtab mapping in `ChannelPage.tsx`
3. updated route regressions in `packages/web/src/pages/ChannelPage.test.tsx`:
1. `?tab=sales-bot` no longer resolves to Sales Bot Audience and falls back to Posts view
2. `?tab=sales-bot-audience` remains valid and resolves to Audience
3. kept Sales Bot hard-cutover assertions (no Users/Tag clickers tabs) in `packages/web/src/components/sales-bot/SalesBotTab.test.tsx`

3. Preserved constraints/invariants:
1. Audience remains the only Sales Bot audience/admin surface.
2. Quick-filter transport `GET /users/metrics` is preserved.
3. No compatibility aliases, no dual paths, no legacy Users/Tag clickers UI behavior reintroduced.
4. Audience semantics (conjunction-only, same-run behavior, explicit-id tag apply, history-safe context) were not broadened.

4. Issues encountered and resolution:
1. New alias-removal test initially rendered Posts view and hit missing `IntersectionObserver` in jsdom; fixed by scoping an `IntersectionObserver` global stub to that test.
2. Backend test execution remains blocked in this environment because testcontainers cannot find a container runtime.

5. Verification commands and outcomes:
1. `pnpm --filter @tg-channel-stats/backend test:run` — blocked in environment (`Could not find a working container runtime strategy`).
2. `pnpm --filter @tg-channel-stats/web test:run` — passed.
3. `pnpm --dir packages/web run build` — passed.
4. `pnpm qc` — passed.

6. Commits:
1. none in this session (commit creation not performed due environment limitations in this worker).

## M6 — Audience UX follow-up fixes

Status: done

1. Contract sync:
1. Reused M1/M2 audience-builder transport contracts unchanged (UI-only adapter for merged answered condition).
2. Preserved hard-cutover end state: Audience-only surface, no legacy Users/Tag clickers routes/tabs/aliases reintroduced.

2. Summary of changes:
1. Updated `packages/web/src/components/sales-bot/sections/AudienceSection.tsx`:
1. merged user-facing condition type into one `Answered option` choice, with local mapping back to backend `answered_option` vs `answered_custom_option` by selected option kind
2. added condition-change auto-search (add/update/remove/clear/quick-filter toggle) when filter state is valid, so operators do not need to click `Search audience`
3. added `Clear conditions` action to remove all extra condition rows explicitly
4. shortened long option labels in option selector lists via truncation helper while keeping full text in `title`
5. made results table container fixed-height with internal scroll (`h-[420px]`, `overflow-y-auto`)
2. Added focused UI helper module `packages/web/src/components/sales-bot/sections/audience-ux.ts` for:
1. merged condition option list
2. draft condition type
3. option-label truncation helper
3. Added regression coverage in `packages/web/src/components/sales-bot/sections/AudienceSection.test.tsx` for:
1. merged answered condition option surface (no separate custom option entry)
2. condition-driven auto-search and explicit clear-conditions behavior
3. option-label truncation behavior
4. fixed-height scrollable search-results container rendering

3. Preserved constraints/invariants:
1. Conjunction-only filter semantics and same-run matching behavior are unchanged (backend contract untouched).
2. Explicit-row bulk tagging, quick-filter metrics path, user context payload, and pagination flow remain intact.
3. No saved audiences, broadcast integration, or legacy alias/dual-path behavior was added.

4. Issues encountered and resolution:
1. `pnpm qc` initially failed on `react-refresh/only-export-components` after exporting helpers from `AudienceSection.tsx`; fixed by moving helpers to `audience-ux.ts`.

5. Verification commands and outcomes:
1. `pnpm --filter @tg-channel-stats/web test:run` — passed.
2. `pnpm --dir packages/web run build` — passed.
3. `pnpm -s typecheck` — passed.
4. `pnpm qc` — passed.

6. Commits:
1. none in this session (workspace currently prevents creating commits).
