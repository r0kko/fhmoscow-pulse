import { Ground, Address } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

import * as dadataService from './dadataService.js';

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  return Ground.findAndCountAll({
    include: [{ model: Address }],
    limit,
    offset,
    order: [['name', 'ASC']],
  });
}

async function getById(id) {
  const ground = await Ground.findByPk(id, {
    include: [{ model: Address }],
  });
  if (!ground) throw new ServiceError('ground_not_found', 404);
  return ground;
}

async function create(data, actorId) {
  const cleaned = await dadataService.cleanAddress(data.address.result);
  const addrData = cleaned || { result: data.address.result };
  const address = await Address.create({
    ...addrData,
    created_by: actorId,
    updated_by: actorId,
  });
  const ground = await Ground.create({
    name: data.name,
    address_id: address.id,
    yandex_url: data.yandex_url,
    capacity: data.capacity,
    phone: data.phone ? data.phone.replace(/\D/g, '') : null,
    website: data.website,
    created_by: actorId,
    updated_by: actorId,
  });
  return getById(ground.id);
}

async function update(id, data, actorId) {
  const ground = await Ground.findByPk(id, { include: [Address] });
  if (!ground) throw new ServiceError('ground_not_found', 404);
  if (data.address) {
    const cleaned = await dadataService.cleanAddress(data.address.result);
    const addrData = cleaned || { result: data.address.result };
    await ground.Address.update({ ...addrData, updated_by: actorId });
  }
  await ground.update(
    {
      name: data.name ?? ground.name,
      yandex_url: data.yandex_url ?? ground.yandex_url,
      capacity: data.capacity ?? ground.capacity,
      phone:
        data.phone !== undefined ? data.phone.replace(/\D/g, '') : ground.phone,
      website: data.website ?? ground.website,
      updated_by: actorId,
    },
    { returning: false }
  );
  return getById(id);
}

async function remove(id, actorId = null) {
  const ground = await Ground.findByPk(id, { include: [Address] });
  if (!ground) throw new ServiceError('ground_not_found', 404);
  if (ground.Address) {
    await ground.Address.update({ updated_by: actorId });
    await ground.Address.destroy();
  }
  await ground.update({ updated_by: actorId });
  await ground.destroy();
}

export default {
  listAll,
  getById,
  create,
  update,
  remove,
};
