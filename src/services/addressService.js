import { Address, AddressType, UserAddress, User } from '../models/index.js';

async function getForUser(userId, alias) {
  const type = await AddressType.findOne({ where: { alias } });
  if (!type) throw new Error('address_type_not_found');
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
  if (!user) throw new Error('user_not_found');
  if (!type) throw new Error('address_type_not_found');
  const existing = await UserAddress.findOne({
    where: { user_id: userId, address_type_id: type.id },
  });
  if (existing) throw new Error('address_exists');
  const address = await Address.create({
    ...data,
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
  if (!type) throw new Error('address_type_not_found');
  const ua = await UserAddress.findOne({
    where: { user_id: userId, address_type_id: type.id },
    include: [Address],
  });
  if (!ua) throw new Error('address_not_found');
  await ua.Address.update({ ...data, updated_by: actorId });
  await ua.update({ updated_by: actorId });
  const addr = await Address.findByPk(ua.address_id);
  addr.AddressType = type;
  return addr;
}

async function removeForUser(userId, alias) {
  const type = await AddressType.findOne({ where: { alias } });
  if (!type) throw new Error('address_type_not_found');
  const ua = await UserAddress.findOne({
    where: { user_id: userId, address_type_id: type.id },
    include: [Address],
  });
  if (!ua) throw new Error('address_not_found');
  await ua.Address.destroy();
  await ua.destroy();
}

export default { getForUser, createForUser, updateForUser, removeForUser };
