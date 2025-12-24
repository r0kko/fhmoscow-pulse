import { Op } from 'sequelize';

import { AvailabilityType, User, UserAvailability } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

async function listForUser(userId, startDate, endDate) {
  return UserAvailability.findAll({
    where: {
      user_id: userId,
      date: { [Op.between]: [startDate, endDate] },
    },
    order: [['date', 'ASC']],
    include: [{ model: AvailabilityType, attributes: ['alias'] }],
  });
}

function mskStartOfDayMs(dateStr) {
  return new Date(`${dateStr}T00:00:00+03:00`).getTime();
}

function normalizePartialMode(raw) {
  if (!raw) return null;
  const value = String(raw).trim().toUpperCase();
  if (
    value === 'BEFORE' ||
    value === 'AFTER' ||
    value === 'WINDOW' ||
    value === 'SPLIT'
  ) {
    return value;
  }
  return null;
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

function compareTimeValues(earlierValue, laterValue) {
  const earlySeconds = parseTimeSeconds(earlierValue);
  const lateSeconds = parseTimeSeconds(laterValue);
  if (earlySeconds === null || lateSeconds === null) return null;
  return earlySeconds - lateSeconds;
}

function assertValidTimeOrder(earlierValue, laterValue) {
  const diff = compareTimeValues(earlierValue, laterValue);
  if (diff === null || diff >= 0) {
    throw new ServiceError('invalid_partial_time', 400);
  }
}

function normalizePartialBounds(day) {
  const rawFrom = day.from_time ? day.from_time : null;
  const rawTo = day.to_time ? day.to_time : null;
  const mode = normalizePartialMode(day.partial_mode || day.partialMode);
  const hasFrom = !!rawFrom;
  const hasTo = !!rawTo;

  if (mode === 'BEFORE') {
    if (!hasTo || hasFrom || parseTimeSeconds(rawTo) === null) {
      throw new ServiceError('invalid_partial_time', 400);
    }
    return { from: null, to: rawTo };
  }
  if (mode === 'AFTER') {
    if (!hasFrom || hasTo || parseTimeSeconds(rawFrom) === null) {
      throw new ServiceError('invalid_partial_time', 400);
    }
    return { from: rawFrom, to: null };
  }
  if (mode === 'WINDOW') {
    if (!hasFrom || !hasTo) {
      throw new ServiceError('invalid_partial_time', 400);
    }
    assertValidTimeOrder(rawFrom, rawTo);
    return { from: rawFrom, to: rawTo };
  }
  if (mode === 'SPLIT') {
    if (!hasFrom || !hasTo) {
      throw new ServiceError('invalid_partial_time', 400);
    }
    assertValidTimeOrder(rawTo, rawFrom);
    return { from: rawFrom, to: rawTo };
  }
  if (!hasFrom && !hasTo) {
    throw new ServiceError('invalid_partial_time', 400);
  }
  if (hasFrom && hasTo) {
    assertValidTimeOrder(rawFrom, rawTo);
    return { from: rawFrom, to: rawTo };
  }
  if (hasFrom && parseTimeSeconds(rawFrom) === null) {
    throw new ServiceError('invalid_partial_time', 400);
  }
  if (hasTo && parseTimeSeconds(rawTo) === null) {
    throw new ServiceError('invalid_partial_time', 400);
  }
  return { from: hasFrom ? rawFrom : null, to: hasTo ? rawTo : null };
}
function getAvailabilityLocks(dateStr) {
  const now = Date.now();
  const startMs = mskStartOfDayMs(dateStr);
  const fullyLocked = now >= startMs; // past and current day
  const within96h = !fullyLocked && now >= startMs - 96 * 60 * 60 * 1000;
  const limitedLocked = within96h;
  return { fullyLocked, limitedLocked, within96h };
}

async function setForUser(userId, days, actorId, options = {}) {
  const { enforcePolicy = false } = options;
  const user = await User.findByPk(userId);
  if (!user) throw new ServiceError('user_not_found', 404);
  const types = await AvailabilityType.findAll({ attributes: ['id', 'alias'] });
  const typeMap = new Map(types.map((t) => [t.alias, t.id]));
  const results = [];
  for (const day of days) {
    const typeId = typeMap.get(day.status);
    if (!typeId) throw new ServiceError('invalid_status', 400);

    if (enforcePolicy) {
      const { fullyLocked, within96h } = getAvailabilityLocks(day.date);
      if (fullyLocked) {
        throw new ServiceError('availability_day_locked', 400);
      }
      // Limited lock: only allow switch to FREE
      if (within96h && day.status !== 'FREE') {
        throw new ServiceError('availability_limited_96h', 400);
      }
    }

    // Normalize/validate partial availability according to business rules:
    // - PARTIAL implies BEFORE (only to_time), AFTER (only from_time),
    //   WINDOW (from_time + to_time, from < to), or SPLIT (to_time < from_time)
    // - FREE/BUSY must not carry time bounds
    let from = day.from_time ? day.from_time : null;
    let to = day.to_time ? day.to_time : null;
    if (day.status === 'PARTIAL') {
      const normalized = normalizePartialBounds(day);
      from = normalized.from;
      to = normalized.to;
    } else {
      from = null;
      to = null;
    }
    const [record, created] = await UserAvailability.findOrCreate({
      where: { user_id: userId, date: day.date },
      defaults: {
        type_id: typeId,
        from_time: from,
        to_time: to,
        created_by: actorId,
        updated_by: actorId,
      },
    });
    if (!created) {
      await record.update({
        type_id: typeId,
        from_time: from,
        to_time: to,
        updated_by: actorId,
      });
    }
    results.push(record);
  }
  return results;
}

async function clearForUser(userId, dates = []) {
  const uniqueDates = Array.from(new Set(dates || []).values());
  if (!uniqueDates.length) return 0;
  return UserAvailability.destroy({
    where: {
      user_id: userId,
      date: { [Op.in]: uniqueDates },
    },
  });
}

export default { listForUser, setForUser };

export async function listForUsers(userIds = [], startDate, endDate) {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];
  return UserAvailability.findAll({
    where: {
      user_id: { [Op.in]: userIds },
      date: { [Op.between]: [startDate, endDate] },
    },
    order: [
      ['user_id', 'ASC'],
      ['date', 'ASC'],
    ],
    include: [{ model: AvailabilityType, attributes: ['alias'] }],
  });
}

export { getAvailabilityLocks };
export { clearForUser };
