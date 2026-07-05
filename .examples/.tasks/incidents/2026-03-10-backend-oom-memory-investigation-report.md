# TG Channel Stats Backend OOM / Memory Growth Investigation Report

## 1) Purpose
1. This report documents the full investigation of backend memory growth and OOM behavior on `beget-1`.
2. It is written as a handoff artifact for a follow-up agent to continue root-cause analysis and remediation.
3. Scope is investigation only. No backend application code was changed during this session.

## 2) Incident Context
1. Service under investigation: `tg-channel-stats-backend-1`.
2. Runtime: single Node.js process (`node dist/index.js`) inside Docker container.
3. Functional role: Telegram channel stats ingestion and userbot-related runners.
4. Initial symptom observed before crash: backend RSS around `~1.18 GiB` and dominating host RAM usage.

## 3) Timeline (UTC)
1. `2026-03-09 21:51:38`:
1) Host check confirmed backend memory `1.185GiB / 3.823GiB` (`31%`).
2. `2026-03-09 21:52-22:06`:
1) Process-level checks showed high RSS and mostly private dirty memory.
2) 80-second sampling around `22:00` showed small oscillations only.
3. `2026-03-09 23:58:08`:
1) Kernel OOM event killed backend Node process.
2) Evidence from kernel journal:
1. `oom-kill ... task=node,pid=3888295`
2. `Out of memory: Killed process 3888295 (node) ... anon-rss:1303596kB`
4. `2026-03-09 23:58:08.842...`:
1) Container restarted (`restartCount=1`, `oom=false` on current state because process already restarted).
5. `2026-03-10 06:22:52`:
1) Post-restart baseline observed: backend memory around `250MiB`.
6. `2026-03-10 06:23:55 -> 07:23:53`:
1) Main long profiling window (60 minutes, 20-second interval).
2) Artifact: `/tmp/tg_backend_mem_profile_20260310T062355Z.csv`.
7. `2026-03-10 06:25:10 -> 06:35:16`:
1) High-frequency profiling (10 minutes, 5-second interval) around `06:30` cron.
2) Artifact: `/tmp/tg_backend_mem_focus_20260310T062510Z.csv`.
8. `2026-03-10 07:34:15`:
1) 6-hour background profile was started, then explicitly stopped to avoid interfering with ongoing feature releases.
2) Artifact: `/tmp/tg_backend_mem_profile_6h_20260310T073415Z.csv`.

## 4) Runtime Evidence Collected
### 4.1 High-memory pre-OOM snapshot
1. `docker stats` before crash window:
1) `tg-channel-stats-backend-1 1.185GiB / 3.823GiB (31.00%)`
2. `/proc/1/status` in container (pre-OOM investigation):
1) `VmRSS: 1204536 kB`
2) `VmHWM: 1226652 kB`
3) `VmSize: 12981484 kB`
4) `Threads: 11`
5) FD count from `/proc/1/fd`: `24`
3. `/proc/1/smaps_rollup` (pre-OOM investigation):
1) `Rss: 1205532 kB`
2) `Private_Dirty: 1204604 kB`
3) `Shared_Clean: 132 kB`
4) Indicates memory was overwhelmingly anonymous/private, not shared file cache.

### 4.2 OOM confirmation
1. Kernel journal around incident time explicitly reports global OOM and target process.
2. Swap was `0` on host, increasing OOM sensitivity under pressure.
3. OOM snippet included memcg path for the exact backend container scope.

### 4.3 Post-restart process and logs
1. Startup logs confirmed long-lived workers:
1) `[ModerationRunner] Started`
2) `[SalesBotBroadcastRunner] Started`
3) `[SalesBotSubscriptionChecksRunner] Started`
4) `[Userbot] Initialized for channel: the_ai_architect`
2. Cron logs remained regular every 30 minutes and each run logged `Disconnecting`.
3. Reconciliation ran on startup (`[Reconcile] Starting...`, then `Done`).

## 5) Profiling Results
### 5.1 60-minute profile summary (`/tmp/tg_backend_mem_profile_20260310T062355Z.csv`)
1. Samples: `180` (+ header row).
2. Start:
1) `2026-03-10T06:23:55Z`
2) `vmrss=227764 kB`
3) `rssanon=172460 kB`
4) `cgroup=280010752 bytes`
3. End:
1) `2026-03-10T07:23:53Z`
2) `vmrss=252800 kB`
3) `rssanon=197120 kB`
4) `cgroup=306143232 bytes`
4. Delta over 60 minutes:
1) `vmrss +25036 kB` (~`+24.5 MiB/h`)
2) `rssanon +24660 kB`
3) `cgroup +26132480 bytes` (~`+24.9 MiB`)
5. Stability metrics:
1) `threads` stayed constant at `11`
2) `fd` stayed within `22..24`

### 5.2 Step-growth correlation with cron
1. Around `06:30` cron:
1) Pre: `06:29:57` -> `vmrss=229752 kB`
2) Post: `06:30:17` -> `vmrss=241492 kB`
3) Step delta: `+11740 kB` (~`+11.46 MiB`)
4) Log correlation:
1. `[06:30:00.007] [Cron] Starting ingestion`
2. `[06:30:01.121] [Cron] Ingestion completed successfully`
2. Around `07:00` cron:
1) Pre: `06:59:45` -> `vmrss=242252 kB`
2) Post: `07:00:05` -> `vmrss=253440 kB`
3) Step delta: `+11188 kB` (~`+10.93 MiB`)
4) Log correlation:
1. `[07:00:00.005] [Cron] Starting ingestion`
2. `[07:00:01.230] [Cron] Ingestion completed successfully`
3. Between cron ticks:
1) Memory drift was much smaller than cron-step deltas.
2) Main observed growth pattern was step-like accumulation at cron boundaries.

### 5.3 High-frequency profile around one cron (`/tmp/tg_backend_mem_focus_20260310T062510Z.csv`)
1. Window: `06:25:10 -> 06:35:16` (120 samples).
2. Total delta in window:
1) `vmrss +13940 kB`
3. Immediate jump around cron:
1) `06:29:55 vmrss=229716`
2) `06:30:10 vmrss=241492`
3) Jump: `+11776 kB`

## 6) Inspector-Based Runtime Sampling
1. Node inspector was enabled by signal to read in-process `process.memoryUsage()` from the target process (no app code change).
2. Sampling window: `~07:31:50 -> ~07:33:45` (5-second interval).
3. Observed values:
1) `rss` stayed flat around `272781312` bytes (~`260 MiB`)
2) `heapUsed` oscillated around `~85-86 MiB`
3) `external` increased from `91000520` to `91528160` bytes (~`+0.50 MiB` in ~2 minutes)
4) `arrayBuffers` increased from `87264198` to `87787541` bytes (~`+0.50 MiB`)
4. Interpretation:
1) Significant memory is outside plain JS heap.
2) External/ArrayBuffer growth is measurable and may be part of retained memory pattern.
5. Operational note:
1) Inspector remained listening on `127.0.0.1:9229` inside container net namespace after sampling.
2) It was not externally exposed via host published ports.

## 7) What Was Tested / Ruled Out
1. Ruled out with high confidence:
1) File descriptor leak as primary driver (`fd` stable range only `22..24`).
2) Thread explosion (`threads` constant at `11`).
2. Less likely:
1) Pure socket accumulation from connect/disconnect loop (no supporting fd/socket growth).
3. Not ruled out:
1) Retention of objects/buffers after each cron ingestion cycle.
2) GramJS or ingestion path retaining incremental state each run.
3) Contributions from always-on userbot/runners to baseline memory floor.

## 8) Current Hypothesis
1. Primary hypothesis:
1) Memory growth is stepwise and correlated with each ingestion cron execution.
2) Each cron run appears to leave behind roughly `~11 MiB` that is not reclaimed immediately.
2. Secondary hypothesis:
1) Part of growth is in non-heap/external memory (supported by inspector sampling).
3. System-level amplifier:
1) No swap configured; once total pressure rises, OOM killer terminates backend process.

## 9) Code Areas Most Relevant for Next Agent
1. Cron ingestion lifecycle:
1) `/Users/timurkhakhalev/dev/personal/tg-channel-stats/packages/backend/src/workers/ingestionCron.ts`
2. Telegram client creation/connect/disconnect:
1) `/Users/timurkhakhalev/dev/personal/tg-channel-stats/packages/backend/src/mtproto/client.ts`
3. Userbot startup and handlers:
1) `/Users/timurkhakhalev/dev/personal/tg-channel-stats/packages/backend/src/workers/userbot.ts`
2) `/Users/timurkhakhalev/dev/personal/tg-channel-stats/packages/backend/src/userbot/init-userbot.ts`
3) `/Users/timurkhakhalev/dev/personal/tg-channel-stats/packages/backend/src/userbot/handle-post-events.ts`
4) `/Users/timurkhakhalev/dev/personal/tg-channel-stats/packages/backend/src/userbot/handle-subscriber-events.ts`
4. Background runner loops:
1) `/Users/timurkhakhalev/dev/personal/tg-channel-stats/packages/backend/src/moderation/job-runner.ts`
2) `/Users/timurkhakhalev/dev/personal/tg-channel-stats/packages/backend/src/sales-bot/broadcast-runner.ts`
3) `/Users/timurkhakhalev/dev/personal/tg-channel-stats/packages/backend/src/userbot/sales-bot-subscription-check-runner.ts`

## 10) Recommended Next Steps for Follow-Up Agent (No Code Changes Yet)
1. Capture heap snapshots around two adjacent cron runs using inspector protocol:
1) Pre-cron snapshot.
2) Post-cron snapshot.
3) Diff top retainers by retained size.
2. Capture allocation sampling profile across a full 30-minute cycle.
3. Separate heap vs external growth per cycle using repeated `process.memoryUsage()` polling in-process.
4. Preserve reproducibility:
1) Keep exact UTC timeline and logs aligned with profiler rows.
2) Keep raw artifacts (`/tmp/*.csv`) before container recreation.
5. After culprit structures are identified, only then prepare targeted code fix.

## 11) Raw Artifact Paths
1. Main 60-minute profile:
1) `/tmp/tg_backend_mem_profile_20260310T062355Z.csv`
2. Focused 10-minute high-frequency profile:
1) `/tmp/tg_backend_mem_focus_20260310T062510Z.csv`
3. Short-lived 6-hour profile attempt (stopped manually):
1) `/tmp/tg_backend_mem_profile_6h_20260310T073415Z.csv`
4. Runner logs:
1) `/tmp/tg_mem_profile_runner.log`
2) `/tmp/tg_mem_profile_fast_runner.log`
3) `/tmp/tg_mem_profile_6h_runner.log`

## 12) Session Outcome
1. Investigation completed with strong evidence of cron-correlated step growth and confirmed OOM kill.
2. No backend source code changes were made in this session.
3. Report is ready for handoff to another agent for deep object-retention root-cause analysis and fix implementation.
