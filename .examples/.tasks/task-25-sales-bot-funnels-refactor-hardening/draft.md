# Task-25 — Sales Bot funnels refactor hardening (Draft)

## Goal

1. Turn the task-24 review findings into a focused refactor and hardening task.
2. Address the highest-value current issues without introducing new funnel features.

## Current issues to address

1. Funnel create/update is not atomic and can leave partial state.
2. Accepted answers are committed before next-step delivery is confirmed.
3. `completionTemplateId` is not validated as same-channel ownership on save.
4. Funnel run list/detail queries are heavier than necessary.
5. Campaign stats are computed through an avoidable N+1 pattern.

## Desired outcome

1. Reliable funnel write path and answer progression.
2. Strict, unambiguous campaign start behavior with no generic fallback.
3. Lighter admin API payloads for funnel respondents and campaigns.
4. Smaller and easier-to-maintain backend and web modules around funnels.

## Chosen direction

1. Keep this as refactor and hardening only.
2. Do not add an outbox or new background delivery subsystem in this task.
3. Recover accepted-answer delivery by resending current state on duplicate callback handling.
4. Split funnel run list and run detail contracts.
5. Split oversized backend/web modules after behavior and contracts are stabilized.
