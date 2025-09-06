# Penalties (Нарушение) Sync

Source of truth: external MariaDB table `game_event` filtered by `event_type_id` that corresponds to `GameEventType.name = 'Нарушение'`.

Local storage: `game_penalties` table

Mapping

- `game_penalties.external_id` ← external `game_event.id`
- `game_penalties.game_id` ← local `matches.id` (by `matches.external_id = game_event.game_id`)
- `game_penalties.event_type_id` ← local `game_event_types.id` (dictionary row with `name='Нарушение'`)
- `game_penalties.penalty_player_id` ← local `players.id` by `external_id = game_event.penalty_player_id`
- `game_penalties.penalty_violation_id` ← local `game_violations.id` by `external_id = game_event.penalty_violation_id`
- `game_penalties.penalty_minutes_id` ← local `penalty_minutes.id` by `external_id = game_event.penalty_minutes_id`
- `minute`, `second`, `period`, `team_penalty` copied as-is

Sync behavior

- Two-phase sync to minimize load:
  1. внешняя выборка только `id, game_id` и чек-суммы строк (MD5 от значимых полей);
     локально сравниваем с сохраненной `external_fp` и выделяем только изменившиеся/новые id;
  2. подгружаем полные записи только для изменившихся/новых id и делаем upsert.
- Upsert по `external_id` (создание/обновление, восстановление soft-deleted)
- Soft-delete (paranoid) для локальных штрафов в матче, которых нет во внешнем списке
- Runs via two paths:
  - orchestrator `syncAll` (последовательный запуск после словарей)
  - dedicated cron (ежечасно в `5 * * * *`, MSK)
  - deletions-only maintenance job (ежедневно `30 2 * * *`, MSK)
    — отдельная профилактика, сканирует `game_penalties` батчами и мягко удаляет
    записи, у которых отсутствуют исходные строки во внешней `game_event`.

Endpoints

- POST `/matches/{id}/sync-penalties` (ADMIN) — reconcile a single match
- GET `/matches/{id}/penalties` (ADMIN, SPORT_SCHOOL_STAFF) — list penalties ordered by time

Operational notes

- Requires dictionaries in place: `game_event_types`, `game_violations`, `penalty_minutes`, and `players` (for player mapping)
- External DB is read-only; service issues only `SELECT` queries
- По умолчанию используется полный импорт/синхронизация всех штрафов по всем известным матчам
  с двухфазным сравнением по MD5-отпечатку, что радикально сокращает
  объем данных из внешней БД и число локальных обновлений.
  Оконная синхронизация (ahead=7, back=14, limit=400) осталась как админ-операция
  для выборочной догрузки/бэкфилла: `POST /admin-ops/penalties/sync-window`.
- Deletions-only job uses fixed defaults (batch=1000, maxBatches=50).
  You can override via `POST /admin-ops/penalties/reap-orphans` request body.
