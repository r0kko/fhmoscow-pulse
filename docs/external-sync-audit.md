# External Sync & Cron Audit

## Scope
- External MariaDB ingestion stack (`src/config/externalMariaDb.js`, `src/externalModels/*`).
- Sync jobs orchestrated via cron (`src/jobs/*SyncCron.js`, `syncAllCron.js`, `externalDbWatchCron.js`).
- Domain services performing data reconciliation (`src/services/*Service.js`).
- Operational surfaces: job metrics, job logs, admin status APIs/UI.

## Current Flow Summary
- `bin/www` boots Express, establishes DB/Redis connections, and eagerly starts cron jobs.
- `syncAllCron.runSyncAll()` sequentially invokes entity-specific sync jobs under a Redis lock every 30 minutes.
- Each `run<Domain>Sync` job relies on `withRedisLock` + local `running` guard and wraps work in `withJobMetrics` for Prometheus + DB-backed `job_logs` entries.
- Domain services (`clubService`, `teamService`, `playerService`, `groundService`, `staffService`, `tournamentService`, `game*Service`, `penaltyMinutesService`) execute **full table scans** against the external MariaDB every run: pull entire ACTIVE/ARCHIVE sets, compute `knownIds`, upsert, soft-delete missing.
- External availability watcher (`externalDbWatchCron`) polls availability each minute and triggers a best-effort full orchestrator run when connectivity returns.
- Job status for operators exposed via `/admin-ops/sync/status` (API) and `AdminSystemOps.vue` (client).

## Pain Points Identified
1. **Full dataset pulls on every interval**
   - For entities with thousands of rows (players, staff, tournaments), doubling queries (ACTIVE + ARCHIVE) every 30 minutes creates sustained load on remote MariaDB and local Postgres.
   - Soft-delete sweep on every run scans entire local tables (updating rows even when nothing changed).
2. **No change journaling / cursoring**
   - Lack of persisted high-water marks prevents incremental fetches based on `date_update` / `date_create` columns available in the external schema.
   - System cannot reason about stale data vs. fresh updates or track last successful run per job beyond Prometheus.
3. **Limited operational insight**
   - Operators see last run/last success but not last cursor timestamp, mode (full vs. incremental), or drift between local/external datasets.
   - No structured metadata for sync stats beyond log text.
4. **Recovery behaviour**
   - When external DB is unavailable for extended time, first reconnect triggers a full sync regardless of elapsed interval; no damping/backoff and no incremental catch-up.
5. **Front-end UX gaps**
   - Admin UI shows aggregated metrics but lacks contextual cues (e.g., when last full resync occurred, what mode upcoming cron will choose, size of last delta, etc.).

## Opportunities / Recommendations
- Persist per-job sync state (cursor, last full run timestamp, last stats) in Postgres.
- Default to **incremental reconciliation** anchored on `date_update`/`date_create`, only sweeping missing IDs during scheduled full refresh (e.g., once daily or on demand).
- Wrap sync jobs in helper that decides mode, exposes `since` cursor, and records outcomes atomically.
- Improve logging/metrics with explicit mode, delta counts, high-water mark, and surfaces via API/UI.
- Adjust cron orchestration to leverage new state (skip expensive sweeps when nothing changed, throttle retries post-outage).
- Present richer insights in admin UI (last cursor, mode, next full refresh deadline) with accessibility-consistent layout.

This audit underpins the implementation plan executed in subsequent steps.
