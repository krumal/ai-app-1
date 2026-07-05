---
name: code-review
description: "Review a code change for production readiness against the available requirements, diff, and tests. Use when the user asks for a code review, PR review, change audit, or merge-readiness check."
---

# Code Review

1. This skill is for review and audit work, not implementation, unless the user explicitly asks to fix findings.
2. Prioritize concrete findings, risks, regressions, and missing coverage over style commentary.
3. Keep the review grounded in the actual diff, the current repository state, and the stated requirements.

## Intake

1. Infer the review target from the user's request.
2. Infer the requirements baseline.
   1. Prefer explicit plan, spec, issue text, or task notes if provided.
   2. Otherwise infer intended behavior from nearby code, tests, and local project docs.
3. Prefer local repo evidence first.
   1. Read `AGENTS.md`, task docs, plan files, or local design notes when they are relevant.
   2. Review the actual changed files, not only summaries.

## Review Workflow

1. Establish the review surface.
   1. Identify the base and head commits, branch diff, or working-tree changes.
   2. Inspect both `git diff --stat` and the actual patch when git history is involved.
2. Establish the validation surface.
   1. Find the most relevant tests, builds, linters, or verification commands for the changed area.
   2. Run the most relevant verification you can when it is feasible and informative.
   3. If you skip verification, say why.
3. Review against requirements.
   1. Check whether the implementation matches the stated plan or expected behavior.
   2. Look for missing scope, scope creep, hidden behavior changes, and undocumented breaking changes.
4. Review engineering quality.
   1. Code quality: separation of concerns, error handling, type safety, duplication, and edge-case handling.
   2. Architecture: coupling, abstraction quality, design soundness, scalability, and performance implications.
   3. Testing: whether tests exercise real logic, cover important edges, and protect against regressions.
   4. Production readiness: migrations, destructive-flow safety, operational risks, correctness bugs, and rollout or cutover concerns when relevant.
5. Keep findings scoped and evidence-backed.
   1. Do not invent requirements because a different design might also be reasonable.
   2. Do not turn generic best-practice advice into blocking findings unless it maps to a real risk in this change.
   3. Distinguish task-related failures from unrelated pre-existing issues.

## Severity Rules

1. `critical`
   1. correctness or security break
   2. broken functionality
   3. data-loss or destructive-state risk
   4. validation cannot pass because of this change
2. `high`
   1. requirements not fully met
   2. high regression risk
   3. materially wrong behavior
   4. missing safeguards in an important path
3. `medium`
   1. important quality gap
   2. meaningful test gap
   3. suspicious edge-case handling
   4. maintainability problem likely to cause near-term defects
4. `minor`
   1. low-risk cleanup
   2. naming or clarity issue
   3. optional refactor
   4. documentation nicety

## Reporting

1. Findings come first.
2. Order findings by severity, then by user impact.
3. For each finding include:
   1. severity
   2. file reference with line numbers when possible
   3. what is wrong
   4. why it matters
   5. what should change
   6. evidence, including commands run when relevant
4. After findings, include:
   1. open questions or assumptions
   2. a brief summary of overall merge-readiness or residual risk
5. If there are no findings, say so explicitly and mention any residual verification gaps.

## Review Rules

1. Never say "looks good" without checking the diff and the relevant code.
2. Do not mark nits as critical.
3. Do not comment on code you did not inspect.
4. Prefer exact file references over vague descriptions.
5. Be explicit about what you verified versus what you inferred.
6. If a test failure appears unrelated to the reviewed change, report it separately and do not demand drive-by fixes.
7. If the user asked for a review, default to a reviewer mindset rather than proposing implementation immediately.

## Context Hygiene

1. Stay focused on the requested review surface.
2. Do not drift into a broad repository audit unless the user asked for one.
3. Keep the output concise, high-signal, and easy to act on.
