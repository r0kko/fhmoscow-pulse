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
    // - PARTIAL implies either available BEFORE a time (only to_time set)
    //   or AFTER a time (only from_time set)
    // - FREE/BUSY must not carry time bounds
    let from = day.from_time ? day.from_time : null;
    let to = day.to_time ? day.to_time : null;
    if (day.status === 'PARTIAL') {
      const hasFrom = !!from;
      const hasTo = !!to;
      if ((hasFrom && hasTo) || (!hasFrom && !hasTo)) {
        throw new ServiceError('invalid_partial_time', 400);
      }
      // ensure mutual exclusivity kept
      if (hasFrom) to = null;
      if (hasTo) from = null;
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
