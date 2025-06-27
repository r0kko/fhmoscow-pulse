import { Address, AddressType, UserAddress, User } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

import dadataService from './dadataService.js';

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

export default { getForUser, createForUser, updateForUser, removeForUser };
