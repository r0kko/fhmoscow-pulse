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

function isWeekLocked(dateStr) {
  const moscow = new Date(`${dateStr}T00:00:00+03:00`);
  const dayNum = moscow.getUTCDay(); // 0..6 (Sun..Sat)
  const mondayMs = moscow.getTime() - ((dayNum + 6) % 7) * 24 * 60 * 60 * 1000;
  const tuesdayEndMs =
    mondayMs + 24 * 60 * 60 * 1000 + (23 * 60 * 60 + 59 * 60 + 59) * 1000;
  return Date.now() >= tuesdayEndMs;
}

function isDayLocked(dateStr) {
  const startMs = new Date(`${dateStr}T00:00:00+03:00`).getTime();
  return Date.now() >= startMs - 72 * 60 * 60 * 1000;
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
      const weekLocked = isWeekLocked(day.date);
      const dayLocked = isDayLocked(day.date);
      const attemptingFree =
        day.status === 'FREE' && day.from_time == null && day.to_time == null;
      const allowOverrideFree = !!day.override_free && attemptingFree;
      if ((weekLocked || dayLocked) && !allowOverrideFree) {
        throw new ServiceError('week_locked', 400);
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

export default { listForUser, setForUser };
