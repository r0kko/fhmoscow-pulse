import {
  Address,
  AddressType,
  UserAddress,
  User,
  UserExternalId,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

import dadataService from './dadataService.js';
import legacyUserService from './legacyUserService.js';

async function getForUser(userId, alias) {
  const type = await AddressType.findOne({ where: { alias } });
  if (!type) throw new ServiceError('address_type_not_found', 404);
  const ua = await UserAddress.findOne({
    where: { user_id: userId, address_type_id: type.id },
    include: [{ model: Address }, { model: AddressType }],
  });
  if (!ua) return null;
  const addr = ua.Address;
  addr.AddressType = ua.AddressType;
  return addr;
}

async function createForUser(userId, alias, data, actorId) {
  const [user, type] = await Promise.all([
    User.findByPk(userId),
    AddressType.findOne({ where: { alias } }),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (!type) throw new ServiceError('address_type_not_found', 404);
  const existing = await UserAddress.findOne({
    where: { user_id: userId, address_type_id: type.id },
  });
  if (existing) throw new ServiceError('address_exists');
  const cleaned = await dadataService.cleanAddress(data.result);
  if (!cleaned) throw new ServiceError('invalid_address');
  const address = await Address.create({
    ...cleaned,
    created_by: actorId,
    updated_by: actorId,
  });
  await UserAddress.create({
    user_id: userId,
    address_id: address.id,
    address_type_id: type.id,
    created_by: actorId,
    updated_by: actorId,
  });
  address.AddressType = type;
  return address;
}

async function updateForUser(userId, alias, data, actorId) {
  const type = await AddressType.findOne({ where: { alias } });
  if (!type) throw new ServiceError('address_type_not_found', 404);
  const ua = await UserAddress.findOne({
    where: { user_id: userId, address_type_id: type.id },
    include: [Address],
  });
  if (!ua) throw new ServiceError('address_not_found', 404);
  const cleaned = await dadataService.cleanAddress(data.result);
  if (!cleaned) throw new ServiceError('invalid_address');
  await ua.Address.update({ ...cleaned, updated_by: actorId });
  await ua.update({ updated_by: actorId });
  const addr = await Address.findByPk(ua.address_id);
  addr.AddressType = type;
  return addr;
}

async function removeForUser(userId, alias) {
  const type = await AddressType.findOne({ where: { alias } });
  if (!type) throw new ServiceError('address_type_not_found', 404);
  const ua = await UserAddress.findOne({
    where: { user_id: userId, address_type_id: type.id },
    include: [Address],
  });
  if (!ua) throw new ServiceError('address_not_found', 404);
  await ua.Address.destroy();
  await ua.destroy();
}

async function fetchFromLegacy(userId) {
  const ext = await UserExternalId.findOne({ where: { user_id: userId } });
  if (!ext) return null;
  const legacy = await legacyUserService.findById(ext.external_id);
  if (!legacy) return null;
  const parts = [legacy.adr_ind, legacy.adr_city, legacy.adr_adr]
    .filter(Boolean)
    .map((p) => String(p).trim());
  if (!parts.length) return null;
  const source = parts.join(', ');
  const cleaned = await dadataService.cleanAddress(source);
  if (!cleaned) return null;
  return { result: cleaned.result };
}

async function importFromLegacy(userId, actorId) {
  const existing = await UserAddress.findOne({ where: { user_id: userId } });
  if (existing) return existing;
  const legacy = await fetchFromLegacy(userId);
  if (!legacy) return null;
  try {
    return await createForUser(
      userId,
      'REGISTRATION',
      { result: legacy.result },
      actorId
    );
  } catch {
    return null;
  }
}

export default {
  getForUser,
  createForUser,
  updateForUser,
  removeForUser,
  fetchFromLegacy,
  importFromLegacy,
};
