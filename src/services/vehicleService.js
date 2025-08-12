import { Vehicle } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

async function listForUser(userId) {
  return Vehicle.findAll({
    where: { user_id: userId },
    order: [['created_at', 'ASC']],
  });
}

async function createForUser(userId, data, actorId) {
  const count = await Vehicle.count({ where: { user_id: userId } });
  if (count >= 3) throw new ServiceError('vehicle_limit');
  const payload = {
    user_id: userId,
    ...data,
    created_by: actorId,
    updated_by: actorId,
  };
  if (count === 0) {
    payload.is_active = true;
  }
  return Vehicle.create(payload);
}

async function updateForUser(userId, id, data, actorId) {
  const vehicle = await Vehicle.findOne({ where: { id, user_id: userId } });
  if (!vehicle) throw new ServiceError('vehicle_not_found', 404);
  if (data.is_active) {
    await Vehicle.update(
      { is_active: false, updated_by: actorId },
      { where: { user_id: userId } }
    );
  }
  await vehicle.update({ ...data, updated_by: actorId });
  return vehicle;
}

async function removeForUser(userId, id, actorId) {
  const vehicle = await Vehicle.findOne({ where: { id, user_id: userId } });
  if (!vehicle) throw new ServiceError('vehicle_not_found', 404);
  const wasActive = vehicle.is_active;
  await vehicle.destroy();
  if (wasActive) {
    const next = await Vehicle.findOne({
      where: { user_id: userId },
      order: [['created_at', 'ASC']],
    });
    if (next) {
      await next.update({ is_active: true, updated_by: actorId });
    }
  }
}

export default { listForUser, createForUser, updateForUser, removeForUser };
