import { validationResult } from 'express-validator';

import matchAdminService, {
  updateScheduleAndLock,
} from '../services/matchAdminService.js';
import { sendError } from '../utils/api.js';

const MAX_QUERY_SEARCH_LEN = 80;
const MAX_QUERY_LIST_SIZE = 30;
const MAX_QUERY_VALUE_LEN = 120;

function pickQueryValue(value) {
  if (Array.isArray(value)) return value.at(-1);
  return value;
}

function normalizeString(value, maxLength = MAX_QUERY_VALUE_LEN) {
  return String(value ?? '')
    .trim()
    .slice(0, maxLength);
}

function normalizeArrayParam(value) {
  const source = Array.isArray(value) ? value : value != null ? [value] : [];
  const result = [];
  const seen = new Set();
  for (const raw of source) {
    const normalized = normalizeString(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= MAX_QUERY_LIST_SIZE) break;
  }
  return result;
}

async function calendar(req, res, next) {
  try {
    const q = normalizeString(
      pickQueryValue(req.query.q),
      MAX_QUERY_SEARCH_LEN
    );
    const homeClubs = normalizeArrayParam(req.query.home_club);
    const awayClubs = normalizeArrayParam(req.query.away_club);
    const tournaments = normalizeArrayParam(req.query.tournament);
    const groups = normalizeArrayParam(req.query.group);
    const stadiums = normalizeArrayParam(req.query.stadium);
    const gameDays = ['1', 'true', 'yes'].includes(
      normalizeString(pickQueryValue(req.query.game_days), 8).toLowerCase()
    );
    const anchorCandidate =
      pickQueryValue(req.query.anchor) ||
      pickQueryValue(req.query.start) ||
      pickQueryValue(req.query.start_date) ||
      null;
    let anchorDate = null;
    if (anchorCandidate) {
      const parsed = new Date(anchorCandidate);
      if (!Number.isNaN(parsed.getTime())) anchorDate = parsed;
    }
    const directionRaw = normalizeString(
      pickQueryValue(req.query.direction),
      16
    ).toLowerCase();
    const direction = ['backward', 'both', 'forward'].includes(directionRaw)
      ? directionRaw
      : 'forward';
    if (gameDays) {
      const countRaw = parseInt(pickQueryValue(req.query.count), 10);
      const horizonRaw = parseInt(pickQueryValue(req.query.horizon), 10);
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
          direction,
          anchorDate,
        });
      return res.json({
        matches,
        range,
        days: count,
        game_days,
        direction,
        anchor: anchorDate ? anchorDate.toISOString() : null,
      });
    }
    const raw = parseInt(pickQueryValue(req.query.days), 10);
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
