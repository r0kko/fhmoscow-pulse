import { validationResult } from 'express-validator';

import logger from '../../logger.js';
import matchAdminService, {
  CALENDAR_SEARCH_MAX_LEN,
  updateScheduleAndLock,
} from '../services/matchAdminService.js';
import {
  incAdminCalendarEmpty,
  observeAdminCalendarRequest,
} from '../config/metrics.js';
import { sendError } from '../utils/api.js';

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

function parseAnchorDate(value) {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  let parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime()) && /^\d+$/.test(normalized)) {
    const ts = Number.parseInt(normalized, 10);
    if (Number.isFinite(ts)) {
      parsed = new Date(ts);
    }
  }
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function buildConstraintFlags({
  q = '',
  homeClubs,
  awayClubs,
  tournaments,
  groups,
  stadiums,
}) {
  const hasSearch = Boolean(String(q || '').trim());
  const hasStructuralFilters = Boolean(
    homeClubs.length ||
    awayClubs.length ||
    tournaments.length ||
    groups.length ||
    stadiums.length
  );
  return { hasSearch, hasStructuralFilters };
}

function buildCalendarMeta(baseMeta, payload) {
  return {
    ...(baseMeta || {}),
    result_count: payload.resultCount,
    requested_anchor: payload.requestedAnchor,
    requested_direction: payload.requestedDirection,
    requested_count: payload.requestedCount,
    requested_horizon: payload.requestedHorizon,
    constraint_flags: {
      has_search: payload.hasSearch,
      has_structural_filters: payload.hasStructuralFilters,
    },
  };
}

async function calendar(req, res, next) {
  const startNs = process.hrtime.bigint();
  try {
    const q = normalizeString(
      pickQueryValue(req.query.q),
      CALENDAR_SEARCH_MAX_LEN
    );
    const homeClubs = normalizeArrayParam(req.query.home_club);
    const awayClubs = normalizeArrayParam(req.query.away_club);
    const tournaments = normalizeArrayParam(req.query.tournament);
    const groups = normalizeArrayParam(req.query.group);
    const stadiums = normalizeArrayParam(req.query.stadium);
    const { hasSearch, hasStructuralFilters } = buildConstraintFlags({
      q,
      homeClubs,
      awayClubs,
      tournaments,
      groups,
      stadiums,
    });
    const gameDays = ['1', 'true', 'yes'].includes(
      normalizeString(pickQueryValue(req.query.game_days), 8).toLowerCase()
    );
    const dayCandidate = pickQueryValue(req.query.day);
    const anchorCandidate =
      pickQueryValue(req.query.anchor) ||
      pickQueryValue(req.query.start) ||
      pickQueryValue(req.query.start_date) ||
      dayCandidate ||
      null;
    const anchorDate = parseAnchorDate(anchorCandidate);
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
      const { matches, range, game_days, day_tabs, meta } =
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
      observeAdminCalendarRequest({
        direction,
        hasSearch,
        count,
        horizon: horizonDays,
        seconds:
          Number((process.hrtime.bigint() - startNs) / 1_000_000n) / 1000,
      });
      const metaWithDiagnostics = buildCalendarMeta(meta, {
        resultCount: Array.isArray(matches) ? matches.length : 0,
        requestedAnchor: anchorDate ? anchorDate.toISOString() : null,
        requestedDirection: direction,
        requestedCount: count,
        requestedHorizon: horizonDays,
        hasSearch,
        hasStructuralFilters,
      });
      if (!metaWithDiagnostics.result_count) {
        const reason =
          hasSearch || hasStructuralFilters
            ? 'constrained_empty'
            : 'no_matches_in_range';
        incAdminCalendarEmpty({
          reason,
          direction,
          hasSearch,
          hasStructuralFilters,
        });
        logger.info('admin_calendar_empty_response', {
          mode: 'game_days',
          reason,
          direction,
          has_search: hasSearch,
          has_structural_filters: hasStructuralFilters,
          requested_count: count,
          requested_horizon: horizonDays,
          requested_anchor: anchorDate ? anchorDate.toISOString() : null,
        });
      }
      return res.json({
        matches,
        range,
        days: count,
        game_days,
        direction,
        anchor: anchorDate ? anchorDate.toISOString() : null,
        day_tabs,
        meta: metaWithDiagnostics,
      });
    }
    const raw = parseInt(pickQueryValue(req.query.days), 10);
    const days = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 31) : 10;
    const { matches, range, day_tabs, meta } =
      await matchAdminService.listNextDays({
        days,
        q,
        homeClubs,
        awayClubs,
        tournaments,
        groups,
        stadiums,
      });
    observeAdminCalendarRequest({
      direction: 'forward',
      hasSearch,
      count: days,
      horizon: days,
      seconds: Number((process.hrtime.bigint() - startNs) / 1_000_000n) / 1000,
    });
    const metaWithDiagnostics = buildCalendarMeta(meta, {
      resultCount: Array.isArray(matches) ? matches.length : 0,
      requestedAnchor: null,
      requestedDirection: 'forward',
      requestedCount: days,
      requestedHorizon: days,
      hasSearch,
      hasStructuralFilters,
    });
    if (!metaWithDiagnostics.result_count) {
      const reason =
        hasSearch || hasStructuralFilters
          ? 'constrained_empty'
          : 'no_matches_in_range';
      incAdminCalendarEmpty({
        reason,
        direction: 'forward',
        hasSearch,
        hasStructuralFilters,
      });
      logger.info('admin_calendar_empty_response', {
        mode: 'days',
        reason,
        direction: 'forward',
        has_search: hasSearch,
        has_structural_filters: hasStructuralFilters,
        requested_count: days,
        requested_horizon: days,
        requested_anchor: null,
      });
    }
    return res.json({
      matches,
      range,
      days,
      day_tabs,
      meta: metaWithDiagnostics,
    });
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
