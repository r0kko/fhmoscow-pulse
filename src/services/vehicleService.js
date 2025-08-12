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
  return Vehicle.create({
    user_id: userId,
    ...data,
    created_by: actorId,
    updated_by: actorId,
  });
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

export default { listForUser, createForUser, updateForUser };
