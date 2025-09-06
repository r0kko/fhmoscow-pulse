Broadcast Links Sync Policy

Source of truth: external DB (MariaDB) game fields `broadcast` and `broadcast2`.

Import behavior

- Each external game maps to local `match_broadcast_links` rows by position:
  - Position 1 ← first URL in `game.broadcast` (if any)
  - Position 2 ← first URL in `game.broadcast2` (if any)
- For every match during sync:
  - Create missing positions with `created_by`/`updated_by`.
  - Restore soft-deleted records when the URL reappears externally.
  - Update URL when it changes externally.
  - Soft-delete any extra local positions not present externally.
- Uniqueness: one link per match per position (enforced by DB constraint).

Read behavior

- Public APIs expose `broadcast_links` as an ordered array (by `position`).
- External list endpoints compute links from `broadcast`/`broadcast2` on the fly.
- Local list/detail endpoints read from `match_broadcast_links` (excluding soft-deleted).

Write behavior

- Pulse does not write broadcast links to the external DB (read-only policy for links).
- Local mutations are not supported: on next sync, local links are reconciled to match external values.

Performance

- Broadcast links are prefetched in a single query per sync transaction to avoid N+1 queries.
