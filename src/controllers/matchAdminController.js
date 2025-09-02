import { validationResult } from 'express-validator';

import matchAdminService, {
  updateScheduleAndLock,
} from '../services/matchAdminService.js';
import { sendError } from '../utils/api.js';

async function calendar(req, res, next) {
  try {
    const q = (req.query.q || '').toString();
    const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
    const homeClubs = arr(req.query.home_club).map((x) => String(x));
    const awayClubs = arr(req.query.away_club).map((x) => String(x));
    const tournaments = arr(req.query.tournament).map((x) => String(x));
    const groups = arr(req.query.group).map((x) => String(x));
    const stadiums = arr(req.query.stadium).map((x) => String(x));
    const gameDays = ['1', 'true', 'yes'].includes(
      String(req.query.game_days || '').toLowerCase()
    );
    if (gameDays) {
      const countRaw = parseInt(req.query.count, 10);
      const horizonRaw = parseInt(req.query.horizon, 10);
      const count = Number.isFinite(countRaw)
        ? Math.min(Math.max(countRaw, 1), 31)
        : 10;
      const horizonDays = Number.isFinite(horizonRaw)
        ? Math.min(Math.max(horizonRaw, count), 180)
        : Math.max(60, count);
      const { matches, range, game_days } =
        await matchAdminService.listNextGameDays({
          count,
          horizonDays,
          q,
          homeClubs,
          awayClubs,
          tournaments,
          groups,
          stadiums,
        });
      return res.json({ matches, range, days: count, game_days });
    }
    const raw = parseInt(req.query.days, 10);
    const days = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 31) : 10;
    const { matches, range } = await matchAdminService.listNextDays({
      days,
      q,
      homeClubs,
      awayClubs,
      tournaments,
      groups,
      stadiums,
    });
    return res.json({ matches, range, days });
  } catch (e) {
    next(e);
  }
}

export default { calendar };

export async function setSchedule(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { date_start: dateStart, ground_id: groundId } = req.body || {};
    await updateScheduleAndLock({
      matchId: req.params.id,
      dateStart,
      groundId,
      actorId: req.user.id,
    });
    return res.json({ ok: true });
  } catch (err) {
    return sendError(res, err);
  }
}
