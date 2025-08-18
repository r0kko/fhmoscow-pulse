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

async function setForUser(userId, days, actorId) {
  const user = await User.findByPk(userId);
  if (!user) throw new ServiceError('user_not_found', 404);
  const types = await AvailabilityType.findAll({ attributes: ['id', 'alias'] });
  const typeMap = new Map(types.map((t) => [t.alias, t.id]));
  const results = [];
  for (const day of days) {
    const typeId = typeMap.get(day.status);
    if (!typeId) throw new ServiceError('invalid_status', 400);
    const [record, created] = await UserAvailability.findOrCreate({
      where: { user_id: userId, date: day.date },
      defaults: {
        type_id: typeId,
        from_time: day.from_time ?? null,
        to_time: day.to_time ?? null,
        created_by: actorId,
        updated_by: actorId,
      },
    });
    if (!created) {
      await record.update({
        type_id: typeId,
        from_time: day.from_time ?? null,
        to_time: day.to_time ?? null,
        updated_by: actorId,
      });
    }
    results.push(record);
  }
  return results;
}

export default { listForUser, setForUser };
