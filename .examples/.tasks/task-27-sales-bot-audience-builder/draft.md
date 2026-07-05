# Task-27 - Sales Bot audience builder and user context explorer (Draft)

Status: draft (agreed scope, ready to turn into execution plan)

## 1. Context

1. The current Sales Bot admin UI splits user exploration into two unrelated read models:
   1. `Users` shows operational user slices such as `started`, `unsubscribed`, and `blocked_current`.
   2. `Tag clickers` shows a narrow list of users for one selected tag.
2. The current split between `Users` and `Tag clickers` creates two overlapping user-centered entry points instead of one coherent audience workflow.
3. The current `Tag clickers` view is not a real audience tool:
   1. it supports only one tag filter at a time
   2. it does not expose user-level context such as funnel participation and questionnaire answers
   3. it does not support building compound conditions
   4. it does not support bulk tagging the resulting audience
4. The current `Users` view already contains a useful operational model that should not be discarded:
   1. fast preset slices such as `started`, `unsubscribed`, and `blocked_current`
   2. a user list that is already based on `sales_bot_users`
5. The current backend already stores the data needed for a richer audience explorer:
   1. user profile and current tags in `sales_bot_users`
   2. funnel participation in `sales_bot_funnel_runs`
   3. stored answer texts and selected options in `sales_bot_funnel_answers`
6. Funnel structure edits already preserve existing answers, so audience filters may safely target current `funnelId`, `stepId`, and `optionId` identifiers without introducing fallback logic.

## 2. Product Goal

1. Replace `Tag clickers` with a real audience builder centered on users.
2. Merge the existing `Users` and `Tag clickers` surfaces into one user-centric Sales Bot screen.
3. Let admins construct compound audience queries with UI controls instead of manual query syntax.
4. Preserve the useful operational presets from `Users` by making them quick filters inside the unified screen.
5. Let admins open a user and inspect:
   1. current tags
   2. funnel participation history
   3. saved answers by run
6. Let admins assign one or more tags to the resulting audience directly from the admin UI.

## 3. Requested Changes

1. Replace the current separate `Users` and `Tag clickers` tabs with one `Audience` tab.
2. The unified `Audience` tab must include:
   1. a user list
   2. a free-text search field
   3. quick operational filters for:
      1. `started`
      2. `unsubscribed`
      3. `blocked_current`
   4. a filter builder controlled by buttons and selects
   5. result count and paginated rows
   6. bulk tag assignment for an explicit user selection only
3. Each user row must be openable to a detailed context view that shows:
   1. user identity and current tags
   2. source tokens when present
   3. funnel runs with status and timestamps
   4. saved answers grouped by run and question
4. The filter builder must support at least these conditions:
   1. user state
   2. has tag
   3. participated in funnel
   4. completed funnel
   5. answered question with option
   6. selected the custom-answer option
5. The initial scope must support conjunction-only logic:
   1. all selected conditions are combined with `AND`
   2. no `OR` groups in this task
   3. no nested groups in this task
6. The result set must be taggable from the admin UI without going through callback buttons or message templates.

## 4. Example User Flows

1. Admin opens `Audience` and searches by username or name.
2. Admin optionally starts from a quick filter such as `started`.
3. Admin builds a query such as:
   1. participated in funnel `funn1`
   2. answered `quest2 = option3`
   3. answered `quest3 = option1`
4. Admin receives the matching users list and total count.
5. Admin opens one matching user and inspects:
   1. current tags
   2. all relevant funnel runs
   3. exact saved answers for each completed step
6. Admin applies tag `qualified` to the explicitly selected rows only.

## 5. Fixed Product Decisions

1. Do not introduce fallbacks or backward compatibility aliases unless explicitly requested by the user.
2. The separate `Users` and `Tag clickers` tabs are replaced by one `Audience` tab.
3. The new product concept is `Audience`, and the UI should use that language instead of `Users` and `Tag clickers` as separate peer tabs.
4. The storage root remains `sales_bot_users`:
   1. do not add a new persisted `audiences` or `segments` table in this task
   2. audience is a query/read model, not a new primary write model
5. Audience search is limited to Sales Bot users of the current channel.
6. Search does not use `telegramUserId` as a search field in this task.
7. The operational `Users` presets are preserved inside `Audience` as quick filters, not as a separate tab.
8. Filter logic for this task is conjunction-only:
   1. all conditions must match
   2. no advanced boolean grammar
9. When multiple answer conditions target the same funnel, they must be satisfied by one and the same funnel run.
10. Tag semantics must preserve the current invariant:
   1. a user is considered to have a tag if it is present in `sales_bot_users.tagsJson`
   2. current tags already include tags applied via `set_tag` callbacks and funnel `completionTag`
   3. the audience builder must not reintroduce separate incompatible tag semantics
11. Bulk tag assignment is additive only in this task:
   1. it merges tags into existing `tagsJson`
   2. it does not support tag removal
   3. it must deduplicate tags using the existing normalization rules
12. Bulk tag assignment accepts only an explicit list of Sales Bot users from the frontend:
   1. the frontend decides which visible users are selected
   2. the backend does not accept audience-query based bulk apply in this task
13. No saved audiences in this task:
   1. no named saved filters
   2. no schedule integration
   3. no broadcast-draft integration yet
14. No dual-tab coexistence in this task:
   1. no `Audience` tab plus legacy `Tag clickers` tab
   2. no `Audience` tab plus a separate legacy `Users` tab
   3. no support for old `sales-bot-tag-clickers` or `sales-bot-users` URL aliases unless explicitly requested later
15. For multi-select questions, matching an option means the option is present among the selected answers; exact-set matching is out of scope.
16. For custom answers, filtering is allowed only by selecting the dedicated custom-answer option, not by the entered text value.
17. User context returns all runs without pagination in this task.
18. User detail must show the exact answer texts and option labels that were stored when the user answered, even if the funnel was edited later.
19. Result sorting defaults to `latest matched activity desc`.

## 6. Domain Model

### 6.1 Audience filter model

1. Introduce a backend and frontend contract named `AudienceFilter`.
2. The initial shape should support:
   1. optional free-text search by `username`, `firstName`, and `lastName` only
   2. `match: 'all'`
   3. ordered condition list
3. The initial condition set should be:
   1. `{ type: 'user_state', value: 'started' | 'unsubscribed' | 'blocked_current' }`
   2. `{ type: 'has_tag', tag: string }`
   3. `{ type: 'participated_in_funnel', funnelId: number }`
   4. `{ type: 'completed_funnel', funnelId: number }`
   5. `{ type: 'answered_option', funnelId: number, stepId: number, optionId: number }`
   6. `{ type: 'answered_custom_option', funnelId: number, stepId: number, optionId: number }`
4. The system should validate that:
   1. tags are non-empty after trim
   2. referenced ids are positive integers
   3. conditions list is not empty when the UI is in filter mode

### 6.2 Audience result model

1. Audience search results should return users, not anonymous aggregates.
2. Each list item should include:
   1. Sales Bot user identity fields
   2. current tags
   3. latest matched activity timestamp
   4. enough identity data for the frontend to keep an explicit selected-user list for bulk tagging
3. Result payload must also return:
   1. `total`
   2. `limit`
   3. `offset`
   4. the normalized applied filter

### 6.3 User context model

1. User context detail is a read model assembled from existing persisted data.
2. The detail payload should include:
   1. serialized Sales Bot user profile
   2. normalized tags
   3. first and last source token when present
   4. all funnel runs for this user in the channel
   5. grouped saved answers per run and per question
3. Saved answers must be shown from the texts captured at response time, not recomputed from the current funnel text.
4. User context detail returns all runs without pagination in this task.

## 7. Query Semantics

1. Text search applies to Sales Bot user identity fields only in this task:
   1. `username`
   2. `firstName`
   3. `lastName`
2. `user_state` reuses the semantics of the existing `Users` screen:
   1. `started`
   2. `unsubscribed`
   3. `blocked_current`
3. `has_tag` matches current normalized `tagsJson` membership.
4. `participated_in_funnel` matches any funnel run for the selected funnel.
5. `completed_funnel` matches a funnel run with `status = 'completed'` for the selected funnel.
6. `answered_option` matches a funnel run that includes an answer row for the selected `stepId` and `optionId`.
7. For multi-select questions, `answered_option` means the option is present among the selected answers.
8. `answered_custom_option` matches that the user chose the dedicated custom-answer option, but it does not filter by the entered custom text value.
9. If multiple answer conditions target the same funnel, all of them must be satisfied by the same run.
10. If `participated_in_funnel` or `completed_funnel` is combined with answer conditions, all conditions for that funnel must resolve against one run.
11. The default sort order is `latest matched activity desc`.
12. The backend implementation should use SQL existence checks and grouped subqueries instead of loading all users into application memory.
13. Pagination must apply after filtering, not before filtering.
14. Implementation should start SQL-first and may add targeted database indexes in this task if query plans show they are needed.

## 8. Admin API Scope

1. Add `GET /:username/sales-bot/audience/meta`.
2. Metadata response should include exactly the data needed by the filter builder:
   1. `tags: string[]`
   2. `funnels: Array<{ id: number, name: string, status: 'draft' | 'active' | 'archived', steps: Array<{ id: number, questionText: string, selectionMode: 'single' | 'multiple', options: Array<{ id: number, text: string, kind: 'preset' | 'custom' }> }> }>`
3. Add `POST /:username/sales-bot/audience/search` that accepts:
   1. `filter: AudienceFilter`
   2. `limit`
   3. `offset`
4. Audience search response should return:
   1. `items`
   2. `total`
   3. `limit`
   4. `offset`
   5. normalized `filter`
5. Add `GET /:username/sales-bot/users/:id/context` for a selected Sales Bot user.
6. User context response should return:
   1. serialized Sales Bot user
   2. tags
   3. source tokens when present
   4. all runs for this user
   5. grouped saved answers for each run
7. Add `POST /:username/sales-bot/users/tags/apply` that accepts:
   1. explicit Sales Bot user ids only
8. Bulk tag application request must also include the tag list to merge.
9. Bulk tag application response must return:
   1. requested tag list
   2. matched user count
   3. updated user count
10. Route validation should stay in zod schemas, and the domain layer should validate only business invariants.

## 9. Admin UI Scope

1. Replace the current separate `Users` and `Tag clickers` sections with a single `AudienceSection`.
2. The new section should contain:
   1. search input
   2. quick operational filter cards for `started`, `unsubscribed`, and `blocked_current`
   3. filter chips or rows
   4. selects for funnel, question, and option conditions
   5. results table
   6. bulk action bar for tag assignment of explicitly selected rows
3. The list should support at least these columns:
   1. user
   2. tags
   3. latest matched activity timestamp
   4. open details action
4. The user detail view may be implemented as a drawer, side panel, or modal, but it must remain inside the Sales Bot admin workflow.
5. The UI should prevent invalid condition combinations by construction where practical:
   1. question selector enabled only after funnel selection
   2. option selector enabled only after question selection
6. The UI should expose clear empty states for:
   1. no available tags or funnels metadata
   2. no results for current query
   3. no context data for selected user
7. The user detail view loads all runs without pagination in this task.
8. There must be no separate `Users` tab after this merge.

## 10. Cleanup and Deletions

1. This task must explicitly remove the legacy `Tag clickers` surface and the separate `Users` tab instead of leaving dead code behind.
2. Delete the legacy backend route and schema dedicated only to `Tag clickers` once the new audience endpoints exist:
   1. remove `GET /:username/sales-bot/tag-clickers`
   2. remove `SalesBotTagClickersQuerySchema`
   3. remove `SalesBotTagClickersQuery` type
3. Delete or fully repurpose the legacy backend read model in `packages/backend/src/domain/sales-bot/tags.ts`:
   1. remove `listSalesBotTagClickers`
   2. keep only truly reusable tag helpers if still needed by other features
   3. if the file becomes audience-specific, rename it to reflect the new responsibility
4. Delete the legacy web hook and response normalization dedicated only to `Tag clickers`:
   1. remove `useSalesBotTagClickers`
   2. remove `normalizeSalesBotTagClicker`
   3. remove `normalizeSalesBotTagClickersResponse`
5. Delete the legacy web types dedicated only to `Tag clickers`:
   1. remove `SalesBotTagClicker`
   2. remove `SalesBotTagClickersResponse`
6. Delete the legacy UI section and tab wiring:
   1. remove `packages/web/src/components/sales-bot/sections/TagClickersSection.tsx`
   2. remove or fully repurpose `packages/web/src/components/sales-bot/sections/UsersSection.tsx`
   3. replace the `users` and `tag-clickers` tab entries in `SalesBotTab.tsx` with one unified `audience` tab
   4. remove the `sales-bot-tag-clickers` and `sales-bot-users` mappings from `ChannelPage.tsx`
7. Delete or rewrite tests that only cover the removed legacy contract:
   1. schema tests for `SalesBotTagClickersQuerySchema`
   2. hook and normalizer tests tied only to the legacy response shape
   3. `SalesBotTab` mocks that reference `TagClickersSection` or separate `UsersSection`
8. Do not keep compatibility aliases for old tab names or old API routes unless explicitly requested later.
9. Do not leave duplicate components such as both `AudienceSection` and `TagClickersSection`, or `AudienceSection` and a separate legacy `UsersSection`, in the codebase after the migration.

## 11. Non-goals

1. Saved reusable audiences or segments.
2. `OR` groups, nested boolean groups, or advanced query language.
3. Tag removal or full tag replacement.
4. Broadcast integration that directly consumes the new audience filter.
5. Cross-channel audience search.
6. Searching by entered custom-answer text value.
7. Exact-set matching for multi-select answers.
8. Separate audit history of manual tag application.
9. Reworking unrelated Sales Bot screens such as templates, broadcasts, inbox, publisher, or settings.

## 12. Implementation Sketch

1. Design the shared `AudienceFilter` contract in backend schema and web types.
2. Build backend metadata and search endpoints on top of `sales_bot_users`, `sales_bot_funnel_runs`, and `sales_bot_funnel_answers` with SQL-based filtering.
3. Build backend user-context read model by reusing existing run and answer grouping logic where possible.
4. Add backend bulk tag application endpoint that merges normalized tags into `sales_bot_users.tagsJson` for an explicit list of selected rows.
5. Replace the legacy `Tag clickers` tab with `Audience` in the web UI and wire the new endpoints.
6. Fold the current `Users` operational presets into `Audience` as quick filters instead of keeping a separate tab.
7. Implement filter-builder UX with guarded dependent selectors for funnel, question, and option conditions.
8. Implement user detail drawer or modal with:
   1. tags
   2. source tokens
   3. funnel runs
   4. grouped saved answers
9. Remove the legacy `Tag clickers` route, hooks, types, tab wiring, and the separate `Users` tab wiring in the same task so the repo does not accumulate obsolete code.
10. Lock behavior with backend and web regression tests for:
   1. compound same-run answer matching
   2. multi-select option-membership matching
   3. custom-answer option matching without value search
   4. operational quick-filter behavior for `started`, `unsubscribed`, and `blocked_current`
   5. search plus condition filtering
   6. user context payload without pagination
   7. bulk tag assignment with deduplication for an explicit list of user ids
   8. legacy route and tab removal
