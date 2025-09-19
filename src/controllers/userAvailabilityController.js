import userAvailabilityService, {
  listForUsers as listForUsersService,
  getAvailabilityLocks,
} from '../services/userAvailabilityService.js';
import userService from '../services/userService.js';
import userMapper from '../mappers/userMapper.js';

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

// Availability lock flags are derived in service (Moscow time)

export default {
  async list(req, res) {
    const today = new Date();
    // Start from Monday of the current week (Moscow time)
    const todayKey = formatDate(today);
    const moscow = new Date(`${todayKey}T00:00:00+03:00`);
    const dayNum = moscow.getUTCDay();
    const mondayMs =
      moscow.getTime() - ((dayNum + 6) % 7) * 24 * 60 * 60 * 1000;
    const start = formatDate(new Date(mondayMs));

    const end = new Date(today);
    end.setDate(end.getDate() + (7 - end.getDay()) + 7);
    const endStr = formatDate(end);
    const records = await userAvailabilityService.listForUser(
      req.user.id,
      start,
      endStr
    );
    const map = new Map(records.map((r) => [r.date, r]));
    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
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
    const today = new Date();
    const rangeStart = formatDate(today);
    const rangeEndDate = new Date(today);
    rangeEndDate.setDate(rangeEndDate.getDate() + (7 - rangeEndDate.getDay()) + 7);

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
    for (let d = new Date(rangeStart); d <= rangeEndDate; d.setDate(d.getDate() + 1)) {
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
};
