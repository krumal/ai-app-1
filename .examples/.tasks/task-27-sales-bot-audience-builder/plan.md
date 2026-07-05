# Task-27 — Sales Bot audience builder and user context explorer (Implementation Plan)

## 1. Scope (what to implement)

1. Replace the separate `Users` and `Tag clickers` admin surfaces with one channel-scoped `Audience` workflow inside Sales Bot.
2. Implement audience querying over Sales Bot users with:
   1. free-text search by `username`, `firstName`, and `lastName`
   2. quick operational filters for `started`, `unsubscribed`, and `blocked_current`
   3. conjunction-only filter conditions for tags, funnel participation, funnel completion, selected options, and selected custom-answer option
   4. paginated results sorted by latest matched activity
3. Implement per-user context exploration that shows current tags, source tokens, all funnel runs, and grouped stored answers without pagination.
4. Implement explicit-row bulk tag assignment from the admin UI with additive normalized tag merging and no query-based server-side mass mutation.
5. Cut over backend and web contracts in the same task and remove legacy Tag clickers transport/UI plus the separate Users tab wiring so only one Audience surface remains.
6. Keep saved audiences, broadcast integration, advanced boolean grammar, tag removal, cross-channel search, and custom-text-value search out of scope.

## 2. Fixed decisions (must follow)

1. Do not introduce fallbacks or backward compatibility unless explicitly requested by the user.
2. The Sales Bot admin cutover is hard:
   1. replace separate `Users` and `Tag clickers` tabs with one `Audience` tab
   2. remove legacy `sales-bot-tag-clickers` and `sales-bot-users` web aliases
   3. do not keep duplicate `AudienceSection` plus legacy peer sections
3. Audience remains a query/read model rooted in `sales_bot_users`:
   1. do not add a persisted audiences or segments table
   2. do not persist saved filters in this task
4. Audience search is limited to Sales Bot users of the current channel.
5. Search fields for this task are only `username`, `firstName`, and `lastName`:
   1. do not search by `telegramUserId`
   2. do not search by custom answer text
6. Filter logic is conjunction-only:
   1. `match` is fixed to `all`
   2. no `OR` groups
   3. no nested groups
   4. when the UI is in filter-builder mode, the ordered conditions list must not be empty
7. Supported audience conditions are fixed to:
   1. `user_state`
   2. `has_tag`
   3. `participated_in_funnel`
   4. `completed_funnel`
   5. `answered_option`
   6. `answered_custom_option`
8. When multiple answer-related conditions target the same funnel, all of them must resolve against one and the same funnel run.
9. When funnel participation/completion conditions are combined with answer conditions for the same funnel, they must also resolve against one and the same funnel run.
10. For multi-select questions, matching an option means membership in the selected options, not exact-set equality.
11. For custom answers, filtering is allowed only by selecting the dedicated custom-answer option:
    1. do not filter by the entered custom text value
    2. do not introduce free-text answer search
12. Result sorting defaults to `latest matched activity desc` after filtering.
13. User context is history-safe and complete for this task:
    1. return all runs without pagination
    2. show stored answer texts and stored option labels captured at answer time
    3. do not recompute answer text from the current funnel definition
14. Quick operational filters preserve existing Users semantics for `started`, `unsubscribed`, and `blocked_current`.
15. Tag semantics preserve the existing normalized `sales_bot_users.tagsJson` membership model, including tags originating from callback actions and funnel `completionTag`.
16. Bulk tag application is fixed to explicit user ids only:
    1. additive merge into existing tags
    2. deduplicate using current normalization rules
    3. no tag removal
    4. no backend endpoint that applies tags from an audience query
17. Route validation stays in zod schemas; domain services enforce business invariants.
18. The existing broadcast draft audience contract is not expanded into this builder feature in this task:
    1. keep the new audience-builder contract explicit
    2. do not silently overload the broadcast audience schema with funnel-answer filters

## 3. Milestone rules (dependencies)

1. Milestones are sequential and dependency-aware.
2. Contract and SQL foundation land before route wiring, UI integration, and legacy deletion.
3. Any milestone that consumes contracts produced by an earlier milestone must start with contract sync and confirm final shapes before implementation.
4. Audience filtering must stay SQL-first:
   1. do not load the full Sales Bot user population into application memory to evaluate filters
   2. apply pagination after filtering
5. If compound audience queries reveal obvious hot paths during local verification, add targeted database indexes in the same milestone that introduces the query behavior and use generated migration flow only.
6. Quick-filter counts and semantics must stay aligned with the existing Users screen behavior after the UI cutover.
7. Legacy Tag clickers transport cleanup and Sales Bot tab cleanup must happen in the same implementation stream as the new Audience surface so the repo does not keep dual paths.
8. Consumer milestones must define loading, success, error, and empty states for search, metadata, user context, and bulk tagging.
9. Verification commands must be runnable from repo root.
10. Final verification for the task must end with `pnpm qc`.

## 4. Milestone index

| ID | Name | Depends on | Notes |
| --- | --- | --- | --- |
| M1 | Audience contracts and query foundation | none | Define explicit audience-builder contracts and SQL-first read/mutation helpers |
| M2 | Audience API and legacy transport cutover | M1 | Expose meta/search/context/tag-apply endpoints and remove tag-clickers transport |
| M3 | Audience admin UI cutover | M1, M2 | Ship the unified Audience tab, explicit selection flow, and remove legacy UI wiring |
| M4 | Regression coverage and repo verification | M1, M2, M3 | Lock semantics with tests, delete obsolete assertions, and run repo quality gates |
| M5 | Fix hard-cutover leftovers from review | M2, M3, M4 | Remove remaining legacy Users transport and the unplanned `sales-bot` deep-link alias |
| M6 | Audience UX polish follow-up | M3, M4, M5 | Streamline condition entry, auto-search behavior, option labels, reset flow, and results scrolling |

## 5. Milestone details

### 5.1 M1 — Audience contracts and query foundation

#### 5.1.1 Depends on

1. Depends on: none

#### 5.1.2 Scope

1. Contracts produced/changed:
   1. introduce explicit audience-builder contracts for:
      1. audience filter shape and condition union
      2. audience metadata payload
      3. audience search request and response payloads
      4. user context payload
      5. explicit bulk tag apply request and response payloads
   2. audience metadata must expose:
      1. normalized tag list
      2. funnel id, name, and status
      3. per-funnel steps with question text, selection mode, and option descriptors including custom-vs-preset kind
   3. audience search items must expose:
      1. Sales Bot user id for explicit selection
      2. user identity fields for table rendering
      3. normalized current tags
      4. latest matched activity timestamp
   4. user context payload must expose:
      1. serialized Sales Bot user profile
      2. normalized tags
      3. first and last source token when present
      4. all funnel runs
      5. grouped saved answers per run and question
   5. update shared backend and web types/normalizers so the new Audience surface does not depend on Tag clickers payload shapes
2. Contracts consumed:
   1. current Sales Bot user-state semantics for `started`, `unsubscribed`, and `blocked_current`
   2. funnel/run/answer snapshot contracts already used by questionnaire reporting
   3. current normalized tag semantics from `sales_bot_users.tagsJson`
   4. current broadcast audience schema naming, which must stay distinct from the new audience-builder contract in this task
3. Contract sync:
   1. inspect current Users and Tag clickers payload assumptions that must be replaced
   2. confirm which shared helpers can be reused for tags, funnels, run grouping, and answer snapshots
   3. confirm a single naming strategy for the new audience-builder DTOs so the repo does not keep two incompatible meanings hidden behind the same type name
4. Domain/query foundation to implement:
   1. SQL-first audience search helper over `sales_bot_users`, `sales_bot_funnel_runs`, and `sales_bot_funnel_answers`
   2. same-run matching logic for multiple answer-related conditions targeting the same funnel
   3. latest matched activity derivation used for default sorting
   4. metadata read model that returns available tags plus funnels with steps and option descriptors required by the filter builder
   5. user context read model that returns user profile, normalized tags, source tokens, all runs, and grouped stored answers
   6. explicit-id bulk tag apply helper with additive normalized merge plus matched and updated counts
   7. targeted index additions only if local query inspection shows they are needed for new compound filters
5. Explicitly excluded:
   1. HTTP route registration
   2. Sales Bot tab wiring and UI rendering

#### 5.1.3 Acceptance criteria

1. The new contracts can express every supported audience condition and return a normalized applied filter in search responses.
2. Audience search logic enforces same-run semantics for funnel participation/completion and answer conditions that target the same funnel.
3. Audience metadata returns exactly the builder inputs needed for tags, funnels, questions, and options without depending on legacy Tag clickers response shapes.
4. User context returns all runs plus grouped stored answer snapshots and does not recompute texts from the current funnel structure.
5. Bulk tag apply helper accepts only explicit Sales Bot user ids and additive tag input, deduplicates tags, and reports requested, matched, and updated counts.
6. No new audience-builder behavior depends on loading all candidate users into application memory.

#### 5.1.4 Verification

1. `pnpm --filter @tg-channel-stats/backend test:run`
2. `pnpm -s typecheck`

#### 5.1.5 Consumer surfaces impacted

1. Backend Sales Bot schemas, serializers, and shared DTOs
2. Backend domain query/mutation helpers for users, tags, funnels, and context reads
3. Web Sales Bot shared types and response normalizers

#### 5.1.6 Pre-response/loading/success/error/empty states (when applicable)

1. Not applicable for direct user-facing loading states in this milestone.

### 5.2 M2 — Audience API and legacy transport cutover

#### 5.2.1 Depends on

1. Depends on: M1

#### 5.2.2 Scope

1. Contracts consumed:
   1. audience-builder request and response DTOs from M1
   2. audience search, metadata, context, and explicit tag-apply domain helpers from M1
   3. existing quick-filter metrics semantics reused by the Audience UI
2. Contract sync:
   1. confirm final zod schema shapes for filter conditions, ids, pagination, and tag input
   2. confirm response field names for search normalization, user context, and bulk mutation feedback
   3. confirm whether existing users metrics transport remains the single source for quick-filter counts during the UI cutover
3. Route and transport work:
   1. add `GET /:username/sales-bot/audience/meta`
   2. add `POST /:username/sales-bot/audience/search`
   3. add `GET /:username/sales-bot/users/:id/context`
   4. add `POST /:username/sales-bot/users/tags/apply`
   5. keep route validation in zod and business invariants in domain services
   6. ensure search response returns `items`, `total`, `limit`, `offset`, and normalized `filter`
   7. ensure tag-apply response returns requested tags plus matched and updated counts
4. Legacy transport cleanup:
   1. remove `GET /:username/sales-bot/tag-clickers`
   2. remove `SalesBotTagClickersQuerySchema`
   3. remove `SalesBotTagClickersQuery` transport type
   4. remove or fully repurpose backend Tag clickers-only domain code once the Audience endpoints cover the admin use cases
5. Explicitly excluded:
   1. Sales Bot tab rendering
   2. filter-builder UI behavior

#### 5.2.3 Acceptance criteria

1. The admin API exposes channel-scoped audience metadata, audience search, user context, and explicit bulk tag application endpoints.
2. Audience search supports free-text search, all fixed condition types, pagination-after-filtering, and default `latest matched activity desc` sorting.
3. User context returns identity, normalized tags, source tokens, all runs, and grouped stored answers for the selected Sales Bot user.
4. Bulk tag application mutates only explicitly provided Sales Bot user ids, preserves additive semantics, and never accepts an audience query as a write target.
5. Legacy Tag clickers route and transport schema/type are no longer exposed by the backend after the cutover.
6. Quick-filter metrics remain available for the UI through one consistent transport path.

#### 5.2.4 Verification

1. `pnpm --filter @tg-channel-stats/backend test:run`
2. `pnpm -s typecheck`

#### 5.2.5 Consumer surfaces impacted

1. Sales Bot admin HTTP routes
2. Backend transport validation and response serialization
3. Audience admin data-fetching consumers in the web app

#### 5.2.6 Pre-response/loading/success/error/empty states (when applicable)

1. `GET /audience/meta` returns metadata on success, `404` for unknown channel, and valid empty arrays when the channel has no tags or no funnels yet.
2. `POST /audience/search` returns paginated results on success, `400` for invalid filters, and `items: []` with `total: 0` when no users match.
3. `GET /users/:id/context` returns full context on success, `404` when the Sales Bot user does not belong to the channel, and never partially paginates runs in this task.
4. `POST /users/tags/apply` returns mutation counts on success and rejects empty/invalid tag or user-id input with validation errors instead of partial silent writes.

### 5.3 M3 — Audience admin UI cutover

#### 5.3.1 Depends on

1. Depends on: M1, M2

#### 5.3.2 Scope

1. Contracts consumed:
   1. audience metadata, search, user context, and tag-apply transport from M2
   2. shared audience-builder types and normalizers from M1
   3. existing users metrics transport reused for quick-filter cards if it remains the chosen source in M2
2. Contract sync:
   1. confirm final request/response shapes before building hooks and local UI state
   2. confirm how latest matched activity is displayed in the table and detail flow
   3. confirm the chosen subtab route key and channel URL mapping for the single Audience screen
3. UI implementation:
   1. add a unified `AudienceSection`
   2. replace separate `users` and `tag-clickers` Sales Bot subtab entries with one `audience` entry
   3. map the channel page route to a single Audience alias for Sales Bot deep links
   4. add search input, quick-filter cards, filter rows/chips, result count, pagination, explicit row selection, and bulk tag action bar
   5. add guarded dependent selectors so question selection requires funnel selection and option selection requires question selection
   6. add user context drawer, side panel, or modal inside the Sales Bot workflow that shows identity, current tags, source tokens, runs, and grouped answers
   7. surface mutation feedback for bulk tag application and refresh the audience list/context after successful writes as needed
4. Legacy UI cleanup:
   1. remove `TagClickersSection`
   2. remove legacy Tag clickers hooks, response normalization, and types
   3. remove or fully repurpose `UsersSection`
   4. remove separate Users and Tag clickers tab wiring and tests that only exist for the deleted UI
5. Explicitly excluded:
   1. saved audience presets
   2. broadcast draft integration
   3. unrelated Sales Bot screens

#### 5.3.3 Acceptance criteria

1. The Sales Bot admin shows exactly one Audience subtab for this workflow, and the separate Users/Tag clickers subtabs no longer exist.
2. The Audience screen supports free-text search, quick operational filters, conjunction-only condition building, paginated results, and explicit row selection for bulk tagging.
3. The UI prevents invalid dependent filter combinations by construction wherever practical.
4. The user detail surface stays inside the Sales Bot workflow and shows identity, tags, source tokens, runs, and grouped stored answers.
5. Bulk tag assignment is available only for explicitly selected rows and reports success or failure clearly.
6. No legacy Tag clickers hooks, normalizers, types, or URL aliases remain in the web app after the cutover.

#### 5.3.4 Verification

1. `pnpm --filter @tg-channel-stats/web test:run`
2. `pnpm --dir packages/web run build`
3. `pnpm -s typecheck`

#### 5.3.5 Consumer surfaces impacted

1. Sales Bot admin Audience tab and deep-link routing
2. Web Sales Bot hooks, normalizers, and shared audience types
3. Channel page Sales Bot subtab mapping

#### 5.3.6 Pre-response/loading/success/error/empty states (when applicable)

1. Metadata state:
   1. show loading while tags/funnels metadata is fetched
   2. show error feedback when metadata fetch fails
   3. show explicit empty guidance when there are no tags or no funnels available for the builder yet
2. Search state:
   1. show idle/default content before the first query as appropriate
   2. show loading during search refresh
   3. show a no-results empty state for valid filters with zero matches
   4. show error feedback for failed search requests
3. User context state:
   1. show loading while detail is fetched
   2. show empty guidance when the user has no runs/context data yet
   3. show error feedback when detail fetch fails
4. Bulk tag state:
   1. keep the action disabled when no rows are selected
   2. show submitting state during mutation
   3. show success feedback with updated counts after completion
   4. show error feedback without clearing selection when the mutation fails

### 5.4 M4 — Regression coverage and repo verification

#### 5.4.1 Depends on

1. Depends on: M1, M2, M3

#### 5.4.2 Scope

1. Contracts consumed:
   1. final audience-builder DTOs, routes, and UI state model from M1-M3
2. Contract sync:
   1. confirm the final endpoint names, response shapes, and subtab route key after the cutover
   2. confirm which legacy tests must be deleted because they assert removed contracts rather than preserved behavior
3. Regression coverage to add or update:
   1. same-run matching across multiple answer conditions for one funnel
   2. participation/completion plus answer conditions resolving against one run
   3. multi-select option-membership matching
   4. custom-answer option matching without custom-text-value search
   5. quick-filter behavior for `started`, `unsubscribed`, and `blocked_current`
   6. free-text search combined with audience conditions
   7. user context payload with all runs and stored answer snapshots
   8. explicit-id bulk tag application with normalization and deduplication
   9. unified Audience tab wiring and legacy Users/Tag clickers tab removal
4. Cleanup:
   1. delete obsolete backend and web tests that only validate removed Tag clickers or separate Users tab transport
   2. keep only assertions that still describe the post-cutover behavior
5. Repository verification:
   1. run backend and web test suites needed for the changed surface
   2. run the web build to catch referenced-project type issues
   3. run `pnpm qc` as the final repo gate

#### 5.4.3 Acceptance criteria

1. Automated tests cover the new audience-builder semantics and explicit cutover decisions that changed in this task.
2. No retained test depends on deleted Tag clickers transport or separate Users/Tag clickers tab wiring.
3. Web build passes after the tab/hook/type cutover.
4. `pnpm qc` passes from repo root.

#### 5.4.4 Verification

1. `pnpm --filter @tg-channel-stats/backend test:run`
2. `pnpm --filter @tg-channel-stats/web test:run`
3. `pnpm --dir packages/web run build`
4. `pnpm qc`

#### 5.4.5 Consumer surfaces impacted

1. Backend regression suite
2. Web regression suite
3. Repo quality gates

#### 5.4.6 Pre-response/loading/success/error/empty states (when applicable)

1. Not applicable beyond test and quality-gate results in this milestone.

### 5.5 M5 — Fix hard-cutover leftovers from review

#### 5.5.1 Depends on

1. Depends on: M2, M3, M4

#### 5.5.2 What changes now

1. Remove the remaining legacy Sales Bot users transport that still exposes the deleted separate Users surface:
   1. remove `GET /:username/sales-bot/users`
   2. remove any remaining web hook/re-export surface that depends on that route
   3. keep only `GET /:username/sales-bot/users/metrics` plus the new audience endpoints
2. Remove the unplanned generic `?tab=sales-bot` alias from the channel page route mapping and its regression coverage.
3. Update regression coverage so the hard cutover is locked to the intended end state only:
   1. no separate Users transport path
   2. no generic `sales-bot` alias
   3. `sales-bot-audience` remains the Audience deep-link entry point

#### 5.5.3 What must remain true

1. Keep the Audience workflow as the only Sales Bot audience/admin surface.
2. Preserve `GET /:username/sales-bot/users/metrics` for quick-filter cards.
3. Preserve the new audience endpoints and their contracts:
   1. `GET /:username/sales-bot/audience/meta`
   2. `POST /:username/sales-bot/audience/search`
   3. `GET /:username/sales-bot/users/:id/context`
   4. `POST /:username/sales-bot/users/tags/apply`
4. Do not reintroduce compatibility aliases, dual paths, or legacy Users/Tag clickers UI behavior.
5. Preserve all previously locked audience semantics:
   1. conjunction-only filters
   2. same-run funnel matching
   3. explicit-id bulk tag application
   4. history-safe user context
6. Keep verification green for backend tests, web tests, web build, and `pnpm qc`.

#### 5.5.4 Verification

1. `pnpm --filter @tg-channel-stats/backend test:run`
2. `pnpm --filter @tg-channel-stats/web test:run`
3. `pnpm --dir packages/web run build`
4. `pnpm qc`

### 5.6 M6 — Audience UX polish follow-up

#### 5.6.1 Depends on

1. Depends on: M3, M4, M5

#### 5.6.2 What changes now

1. Simplify the condition-type entry flow in the Audience UI:
   1. merge `answered_option` and `answered_custom_option` into one user-facing condition choice
   2. preserve the existing backend filter contracts and same-run semantics behind the UI
2. Trigger search automatically after adding or changing conditions so the operator does not need to click `Search` to refresh results for valid filter state.
3. Shorten long answer-option labels in selector lists so options remain readable and compact inside the filter builder.
4. Add a `Clear conditions` action that removes all extra conditions in one step without disturbing supported baseline search/filter state.
5. Make the search results container a fixed-height panel with an internal scroll area instead of growing indefinitely with result count.

#### 5.6.3 What must remain true

1. Audience remains the only Sales Bot audience/admin surface.
2. Keep conjunction-only filter behavior and all previously locked audience semantics intact.
3. Preserve existing backend DTOs/endpoints unless a UI-only adapter is enough.
4. Do not reintroduce legacy Users/Tag clickers routes, tabs, aliases, or dual paths.
5. Keep explicit-row bulk tagging, quick-filter metrics, user context, and pagination behavior working.
6. Keep loading, error, empty, and success states coherent after introducing auto-search.

#### 5.6.4 Verification

1. `pnpm --filter @tg-channel-stats/web test:run`
2. `pnpm --dir packages/web run build`
3. `pnpm -s typecheck`
4. `pnpm qc`

## 6. Execution order (derived from dependencies)

1. Run M1 first to define the explicit audience-builder contract, same-run query semantics, metadata/context read models, and explicit tag-apply mutation helper.
2. Run M2 second to expose the new admin endpoints on top of M1 contracts and remove the legacy Tag clickers transport.
3. Run M3 third to ship the unified Audience admin workflow, route cutover, explicit selection UX, and legacy UI cleanup against the stabilized M1-M2 contracts.
4. Run M4 last to lock the new semantics with backend/web regression coverage, delete obsolete legacy assertions, and finish with repo-wide verification including `pnpm qc`.
5. Run M5 after review if needed to remove any remaining hard-cutover leftovers without broadening scope.
6. Run M6 after user feedback if additional Audience UX polish is requested without changing the core audience contract.

## Orchestration (managed by orchestrator)

| Milestone | Status | Commits |
| --- | --- | --- |
| M1 — Audience contracts and query foundation | done | e7c33f3 |
| M2 — Audience API and legacy transport cutover | done | 1b017d7, 17279a3 |
| M3 — Audience admin UI cutover | done | 601bae5 |
| M4 — Regression coverage and repo verification | done | f42bd08 |
| M5 — Fix hard-cutover leftovers from review | done | aa4cc2e |
| M6 — Audience UX polish follow-up | done | 148b86d |
| Reviewer | done | |
