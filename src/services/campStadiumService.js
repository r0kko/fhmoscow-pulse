import {
  CampStadium,
  Address,
  ParkingType,
  CampStadiumParkingType,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

import * as dadataService from './dadataService.js';

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  return CampStadium.findAndCountAll({
    include: [
      { model: Address },
      { model: ParkingType },
    ],
    limit,
    offset,
    order: [['name', 'ASC']],
  });
}

async function getById(id) {
  const stadium = await CampStadium.findByPk(id, {
    include: [
      { model: Address },
      { model: ParkingType },
    ],
  });
  if (!stadium) throw new ServiceError('stadium_not_found', 404);
  return stadium;
}

async function create(data, actorId) {
  const cleaned = await dadataService.cleanAddress(data.address.result);
  if (!cleaned) throw new ServiceError('invalid_address');
  const address = await Address.create({
    ...cleaned,
    created_by: actorId,
    updated_by: actorId,
  });
  const stadium = await CampStadium.create({
    name: data.name,
    address_id: address.id,
    yandex_url: data.yandex_url,
    capacity: data.capacity,
    phone: data.phone,
    website: data.website,
    created_by: actorId,
    updated_by: actorId,
  });
  if (Array.isArray(data.parking)) {
    for (const p of data.parking) {
      const type = await ParkingType.findOne({ where: { alias: p.type } });
      if (!type) continue;
      await CampStadiumParkingType.create({
        camp_stadium_id: stadium.id,
        parking_type_id: type.id,
        price: p.price,
        created_by: actorId,
        updated_by: actorId,
      });
    }
  }
  return getById(stadium.id);
}

async function update(id, data, actorId) {
  const stadium = await CampStadium.findByPk(id, { include: [Address] });
  if (!stadium) throw new ServiceError('stadium_not_found', 404);
  if (data.address) {
    const cleaned = await dadataService.cleanAddress(data.address.result);
    if (!cleaned) throw new ServiceError('invalid_address');
    await stadium.Address.update({ ...cleaned, updated_by: actorId });
  }
  await stadium.update(
    {
      name: data.name ?? stadium.name,
      yandex_url: data.yandex_url ?? stadium.yandex_url,
      capacity: data.capacity ?? stadium.capacity,
      phone: data.phone ?? stadium.phone,
      website: data.website ?? stadium.website,
      updated_by: actorId,
    },
    { returning: false }
  );
  if (Array.isArray(data.parking)) {
    await CampStadiumParkingType.destroy({
      where: { camp_stadium_id: id },
    });
    for (const p of data.parking) {
      const type = await ParkingType.findOne({ where: { alias: p.type } });
      if (!type) continue;
      await CampStadiumParkingType.create({
        camp_stadium_id: id,
        parking_type_id: type.id,
        price: p.price,
        created_by: actorId,
        updated_by: actorId,
      });
    }
  }
  return getById(id);
}

async function remove(id) {
  const stadium = await CampStadium.findByPk(id, { include: [Address] });
  if (!stadium) throw new ServiceError('stadium_not_found', 404);
  if (stadium.Address) await stadium.Address.destroy();
  await stadium.destroy();
}

async function listParkingTypes() {
  return ParkingType.findAll({ order: [['name', 'ASC']] });
}

export default {
  listAll,
  getById,
  create,
  update,
  remove,
  listParkingTypes,
};
