import userAvailabilityService, {
  listForUsers as listForUsersService,
  getAvailabilityLocks,
  clearForUser as clearAvailabilityForUser,
} from '../services/userAvailabilityService.js';
import userService from '../services/userService.js';
import userMapper from '../mappers/userMapper.js';
import ServiceError from '../errors/ServiceError.js';
import { hasRefereeRole } from '../utils/roles.js';
import { utcToMoscow } from '../utils/time.js';

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function parseDateKey(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [year, month, day] = dateStr.split('-').map((value) => Number(value));
  if ([year, month, day].some((value) => Number.isNaN(value))) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function isAllDigits(text) {
  if (!text) return false;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

function parseTimeSeconds(value) {
  if (!value) return null;
  const text = String(value).trim();
  const parts = text.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const [hourPart, minutePart, secondPart] = parts;
  if (!isAllDigits(hourPart) || !isAllDigits(minutePart)) return null;
  if (secondPart !== undefined && !isAllDigits(secondPart)) return null;
  if (
    hourPart.length < 1 ||
    hourPart.length > 2 ||
    minutePart.length !== 2 ||
    (secondPart !== undefined && secondPart.length !== 2)
  ) {
    return null;
  }
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  const second = secondPart ? Number(secondPart) : 0;
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(second) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }
  return hour * 3600 + minute * 60 + second;
}

function compareTimes(firstValue, secondValue) {
  const first = parseTimeSeconds(firstValue);
  const second = parseTimeSeconds(secondValue);
  if (first === null || second === null) return null;
  return first - second;
}

function moscowTodayKey() {
  const nowMsk = utcToMoscow(new Date()) || new Date();
  return formatDate(nowMsk);
}

function derivePartialMode(fromTime, toTime) {
  if (fromTime && toTime) {
    const diff = compareTimes(fromTime, toTime);
    if (diff > 0) return 'SPLIT';
    return 'WINDOW';
  }
  if (toTime && !fromTime) return 'BEFORE';
  if (fromTime && !toTime) return 'AFTER';
  return null;
}

function startOfIsoWeek(dateKey) {
  const base = parseDateKey(dateKey);
  if (!base) return null;
  const dayNum = base.getUTCDay();
  const offset = (dayNum + 6) % 7; // Monday = 0, Sunday = 6
  base.setUTCDate(base.getUTCDate() - offset);
  return base;
}

function endOfNextWeek(dateKey) {
  const base = parseDateKey(dateKey);
  if (!base) return null;
  const dayNum = base.getUTCDay();
  const daysToNextSunday = ((7 - dayNum) % 7) + 7;
  base.setUTCDate(base.getUTCDate() + daysToNextSunday);
  return base;
}

async function assertEditableUser(userId) {
  const user = await userService.getUser(userId);
  const roles = user?.Roles || [];
  const isReferee = hasRefereeRole(roles);
  const statusAlias = user?.UserStatus?.alias;
  if (!isReferee || statusAlias !== 'ACTIVE') {
    throw new ServiceError('user_not_available_for_edit', 403);
  }
  return user;
}

// Availability lock flags are derived in service (Moscow time)

export default {
  async list(req, res) {
    // Start from Monday of the current week (Moscow time)
    const todayKey = moscowTodayKey();
    const startDate = startOfIsoWeek(todayKey) || new Date();
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 13);
    const start = formatDate(startDate);
    const endStr = formatDate(endDate);
    const records = await userAvailabilityService.listForUser(
      req.user.id,
      start,
      endStr
    );
    const map = new Map(records.map((r) => [r.date, r]));
    const days = [];
    const startIter = parseDateKey(start) || startDate;
    const endIter = parseDateKey(endStr) || endDate;
    for (
      let d = new Date(startIter);
      d <= endIter;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const key = formatDate(d);
      const rec = map.get(key);
      // Determine editability and lock flags (Moscow time, corporate policy)
      const locks = getAvailabilityLocks(key);
      const editable = !locks.fullyLocked && !locks.limitedLocked;
      days.push({
        date: key,
        status: rec?.AvailabilityType?.alias ?? 'FREE',
        from_time: rec?.from_time ?? null,
        to_time: rec?.to_time ?? null,
        partial_mode: derivePartialMode(rec?.from_time, rec?.to_time),
        preset: !!rec, // indicates whether value was explicitly set by user
        editable,
        fully_locked: !!locks.fullyLocked,
        limited_locked: !!locks.limitedLocked,
      });
    }
    res.json({ days });
  },

  async set(req, res) {
    await userAvailabilityService.setForUser(
      req.user.id,
      req.body.days || [],
      req.user.id,
      { enforcePolicy: true }
    );
    res.status(204).end();
  },

  async adminGrid(req, res) {
    // Admin overview: referees' availability from today through end of next week
    const todayKey = moscowTodayKey();
    const rangeStartDate = parseDateKey(todayKey) || new Date();
    const rangeEndDate = endOfNextWeek(todayKey) || new Date(rangeStartDate);

    // Roles/status filters
    const rolesParam = req.query.role;
    const roles = Array.isArray(rolesParam)
      ? rolesParam
      : rolesParam
        ? [rolesParam]
        : ['REFEREE', 'BRIGADE_REFEREE'];
    const status = req.query.status || 'ACTIVE';

    const dateParam = req.query.date;
    const rawDates = Array.isArray(dateParam)
      ? dateParam
      : dateParam
        ? [dateParam]
        : [];
    const normalizedRequestedDates = rawDates
      .map((d) => {
        if (typeof d !== 'string') return null;
        const trimmed = d.trim();
        return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
      })
      .filter(Boolean);

    // Fetch all matching users (cap at a reasonable upper bound)
    const { rows } = await userService.listUsers({
      role: roles,
      status,
      limit: 10000,
      page: 1,
      sort: 'last_name',
      order: 'asc',
    });
    const users = userMapper.toPublicArray(rows);
    const userIds = users.map((u) => u.id);

    // Fetch availabilities in bulk
    const availableDates = [];
    for (
      let d = new Date(rangeStartDate);
      d <= rangeEndDate;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      availableDates.push(formatDate(d));
    }

    const requestedSet = new Set(normalizedRequestedDates);
    const dates = requestedSet.size
      ? availableDates.filter((d) => requestedSet.has(d))
      : availableDates;

    // Ensure we always have at least one date column
    const effectiveDates = dates.length ? dates : availableDates;
    const fetchStart = effectiveDates[0];
    const fetchEnd = effectiveDates[effectiveDates.length - 1];

    const records = await listForUsersService(userIds, fetchStart, fetchEnd);
    const byUserDate = new Map();
    const effectiveDateSet = new Set(effectiveDates);
    for (const r of records) {
      if (!effectiveDateSet.has(r.date)) continue;
      const u = r.user_id;
      const key = `${u}|${r.date}`;
      byUserDate.set(key, {
        status: r.AvailabilityType?.alias || 'FREE',
        from_time: r.from_time || null,
        to_time: r.to_time || null,
        partial_mode: derivePartialMode(r.from_time, r.to_time),
        preset: true,
      });
    }

    const items = users.map((u) => {
      const availability = {};
      for (const date of effectiveDates) {
        const key = `${u.id}|${date}`;
        const val = byUserDate.get(key);
        availability[date] = val || {
          status: 'FREE',
          from_time: null,
          to_time: null,
          partial_mode: null,
          preset: false,
        };
      }
      return {
        id: u.id,
        last_name: u.last_name,
        first_name: u.first_name,
        patronymic: u.patronymic,
        roles: u.roles || [],
        availability,
      };
    });

    res.json({
      dates: effectiveDates,
      availableDates,
      users: items,
    });
  },

  async adminDetail(req, res) {
    const userId = req.params.userId;
    const user = await assertEditableUser(userId);

    const todayKey = moscowTodayKey();
    const rangeStartDate = parseDateKey(todayKey) || new Date();
    const rangeEndDate = endOfNextWeek(todayKey) || new Date(rangeStartDate);
    const rangeStart = formatDate(rangeStartDate);
    const rangeEnd = formatDate(rangeEndDate);

    const dates = [];
    const records = await userAvailabilityService.listForUser(
      userId,
      rangeStart,
      rangeEnd
    );
    const map = new Map(records.map((r) => [r.date, r]));
    const days = [];
    for (
      let d = new Date(rangeStartDate);
      d <= rangeEndDate;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const key = formatDate(d);
      dates.push(key);
      const rec = map.get(key);
      days.push({
        date: key,
        status: rec?.AvailabilityType?.alias ?? 'FREE',
        from_time: rec?.from_time ?? null,
        to_time: rec?.to_time ?? null,
        partial_mode: derivePartialMode(rec?.from_time, rec?.to_time),
        preset: !!rec,
        editable: true,
        fully_locked: false,
        limited_locked: false,
      });
    }

    res.json({
      user: userMapper.toPublic(user),
      dates,
      availableDates: dates,
      days,
    });
  },

  async adminSet(req, res) {
    const userId = req.params.userId;
    await assertEditableUser(userId);

    const payload = Array.isArray(req.body?.days) ? req.body.days : [];
    if (!payload.length) {
      throw new ServiceError('availability_empty_payload', 400);
    }

    const upserts = new Map();
    const clears = new Set();

    for (const raw of payload) {
      const dateRaw = raw?.date ? String(raw.date).trim() : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
        throw new ServiceError('availability_invalid_date', 400);
      }

      const statusVal = raw?.status;
      if (statusVal === null || statusVal === undefined || statusVal === '') {
        clears.add(dateRaw);
        continue;
      }

      const normalizedStatus = String(statusVal).toUpperCase();
      const day = {
        date: dateRaw,
        status: normalizedStatus,
        from_time: raw?.from_time ?? null,
        to_time: raw?.to_time ?? null,
        partial_mode: raw?.partial_mode ?? raw?.partialMode ?? null,
      };
      upserts.set(dateRaw, day);
      clears.delete(dateRaw);
    }

    if (!upserts.size && !clears.size) {
      return res.status(204).end();
    }

    if (upserts.size) {
      await userAvailabilityService.setForUser(
        userId,
        Array.from(upserts.values()),
        req.user.id,
        { enforcePolicy: false }
      );
    }

    if (clears.size) {
      await clearAvailabilityForUser(userId, Array.from(clears), req.user.id);
    }

    res.status(204).end();
  },
};
