import { MedicalCenter, Address } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

import * as dadataService from './dadataService.js';

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  return MedicalCenter.findAndCountAll({
    include: [Address],
    limit,
    offset,
    order: [['name', 'ASC']],
  });
}

async function getById(id) {
  const center = await MedicalCenter.findByPk(id, { include: [Address] });
  if (!center) throw new ServiceError('center_not_found', 404);
  return center;
}

function detectLegalEntity(inn) {
  return String(inn).length === 10;
}

async function create(data, actorId) {
  const cleaned = await dadataService.cleanAddress(data.address.result);
  const addrData = cleaned || { result: data.address.result };
  const address = await Address.create({
    ...addrData,
    created_by: actorId,
    updated_by: actorId,
  });
  const center = await MedicalCenter.create({
    name: data.name,
    inn: data.inn,
    is_legal_entity: detectLegalEntity(data.inn),
    address_id: address.id,
    phone: data.phone ? data.phone.replace(/\D/g, '') : null,
    email: data.email,
    website: data.website,
    created_by: actorId,
    updated_by: actorId,
  });
  return getById(center.id);
}

async function update(id, data, actorId) {
  const center = await MedicalCenter.findByPk(id, { include: [Address] });
  if (!center) throw new ServiceError('center_not_found', 404);
  if (data.address) {
    const cleaned = await dadataService.cleanAddress(data.address.result);
    const addrData = cleaned || { result: data.address.result };
    if (center.Address) {
      await center.Address.update({ ...addrData, updated_by: actorId });
    } else {
      const addr = await Address.create({
        ...addrData,
        created_by: actorId,
        updated_by: actorId,
      });
      data.address_id = addr.id;
    }
  }
  await center.update(
    {
      name: data.name ?? center.name,
      inn: data.inn ?? center.inn,
      is_legal_entity: data.inn
        ? detectLegalEntity(data.inn)
        : center.is_legal_entity,
      address_id: data.address_id ?? center.address_id,
      phone:
        data.phone !== undefined ? data.phone.replace(/\D/g, '') : center.phone,
      email: data.email ?? center.email,
      website: data.website ?? center.website,
      updated_by: actorId,
    },
    { returning: false }
  );
  return getById(id);
}

async function remove(id) {
  const center = await MedicalCenter.findByPk(id, { include: [Address] });
  if (!center) throw new ServiceError('center_not_found', 404);
  if (center.Address) await center.Address.destroy();
  await center.destroy();
}

export default { listAll, getById, create, update, remove };
