import { BankAccount, User } from '../models/index.js';

async function getByUser(userId) {
  return BankAccount.findOne({ where: { user_id: userId } });
}

async function createForUser(userId, data, actorId) {
  const [user, existing] = await Promise.all([
    User.findByPk(userId),
    BankAccount.findOne({ where: { user_id: userId } }),
  ]);
  if (!user) throw new Error('user_not_found');
  if (existing) throw new Error('bank_account_exists');
  return BankAccount.create({
    user_id: userId,
    ...data,
    created_by: actorId,
    updated_by: actorId,
  });
}

async function updateForUser(userId, data, actorId) {
  const acc = await BankAccount.findOne({ where: { user_id: userId } });
  if (!acc) throw new Error('bank_account_not_found');
  await acc.update({ ...data, updated_by: actorId });
  return acc;
}

async function removeForUser(userId) {
  const acc = await BankAccount.findOne({ where: { user_id: userId } });
  if (!acc) throw new Error('bank_account_not_found');
  await acc.destroy();
}

export default { getByUser, createForUser, updateForUser, removeForUser };
