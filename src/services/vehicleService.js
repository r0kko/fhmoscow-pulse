import { Vehicle } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';
import sequelize from '../config/database.js';

function normalizeCount(result) {
  if (Array.isArray(result)) {
    return result.reduce((acc, item) => acc + Number(item?.count || 0), 0);
  }
  return Number(result || 0);
}

async function listForUser(userId) {
  return Vehicle.findAll({
    where: { user_id: userId },
    order: [['created_at', 'ASC']],
  });
}

async function createForUser(userId, data, actorId) {
  const count = normalizeCount(
    await Vehicle.count({ where: { user_id: userId } })
  );
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

async function replaceForUser(userId, vehicles, actorId) {
  if (!Array.isArray(vehicles)) {
    throw new ServiceError('invalid_vehicle_list', 422);
  }
  if (vehicles.length > 3) {
    throw new ServiceError('vehicle_limit', 422);
  }

  return sequelize.transaction(async (transaction) => {
    const current = await Vehicle.findAll({
      where: { user_id: userId },
      order: [['created_at', 'ASC']],
      transaction,
    });
    const currentById = new Map(current.map((item) => [item.id, item]));
    const incomingIds = new Set(
      vehicles.map((item) => item.id).filter(Boolean)
    );
    const seenIds = new Set();

    for (const vehicle of vehicles) {
      if (!vehicle.id) continue;
      if (seenIds.has(vehicle.id)) {
        throw new ServiceError('duplicate_vehicle_id', 422);
      }
      seenIds.add(vehicle.id);
      if (!currentById.has(vehicle.id)) {
        throw new ServiceError('vehicle_not_found', 404);
      }
    }

    for (const item of current) {
      if (!incomingIds.has(item.id)) {
        await item.destroy({ transaction });
      }
    }

    const upserted = [];
    for (const vehicle of vehicles) {
      if (vehicle.id && currentById.has(vehicle.id)) {
        const existing = currentById.get(vehicle.id);
        await existing.update(
          {
            brand: vehicle.brand,
            model: vehicle.model || null,
            number: vehicle.number,
            updated_by: actorId,
          },
          { transaction }
        );
        upserted.push(existing);
        continue;
      }

      const created = await Vehicle.create(
        {
          user_id: userId,
          brand: vehicle.brand,
          model: vehicle.model || null,
          number: vehicle.number,
          is_active: false,
          created_by: actorId,
          updated_by: actorId,
        },
        { transaction }
      );
      upserted.push(created);
    }

    if (upserted.length > 0) {
      let activeIndex = vehicles.findIndex((item) => item.is_active === true);
      if (activeIndex < 0) activeIndex = 0;
      const activeId = upserted[activeIndex]?.id;
      if (activeId) {
        await Vehicle.update(
          { is_active: false, updated_by: actorId },
          { where: { user_id: userId }, transaction }
        );
        await Vehicle.update(
          { is_active: true, updated_by: actorId },
          { where: { id: activeId, user_id: userId }, transaction }
        );
      }
    }

    return Vehicle.findAll({
      where: { user_id: userId },
      order: [['created_at', 'ASC']],
      transaction,
    });
  });
}

export default {
  listForUser,
  createForUser,
  updateForUser,
  removeForUser,
  replaceForUser,
};
