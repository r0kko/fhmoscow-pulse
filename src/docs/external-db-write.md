External DB Write Policy

- External MariaDB connection is enforced read-only globally.
- One whitelisted mutation is allowed: updating `game.date_start` and `game.stadium_id` when a match time and ground are approved by both sides in Pulse.
- The only entry point that performs this update is `src/services/externalMatchSyncService.js` via `updateExternalGameDateAndStadium()` from `src/config/externalMariaDb.js`.
- Timezone: Pulse stores times in UTC, external DB stores Moscow time (UTC+03:00). We add +3 hours when writing to external and when comparing values for idempotency.
- Approval flow requires successful external write: status `ACCEPTED` is set only after the external DB is updated (or already in sync). If the external DB is unavailable or mappings are missing, the approval fails with a clear error.

Operational Notes

- Requires EXT*DB*\* env vars set and a live connection; otherwise approvals will be blocked with `external_db_unavailable`.
- Ground and Match must have `external_id` mapped to external `stadium.id` and `game.id` respectively; otherwise approvals will be blocked with `external_sync_failed`.
- The write is parameterized SQL and bypasses the read-only guard using an internal, non-exported query reference.
