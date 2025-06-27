import { BankAccount, User, UserExternalId } from '../models/index.js';
import { isValidAccountNumber } from '../utils/bank.js';
import ServiceError from '../errors/ServiceError.js';

import legacyUserService from './legacyUserService.js';
import dadataService from './dadataService.js';

async function getByUser(userId) {
  return BankAccount.findOne({ where: { user_id: userId } });
}

async function createForUser(userId, data, actorId) {
  const [user, existing] = await Promise.all([
    User.findByPk(userId),
    BankAccount.findOne({ where: { user_id: userId } }),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (existing) throw new ServiceError('bank_account_exists');
  return BankAccount.create({
    user_id: userId,
    ...data,
    created_by: actorId,
    updated_by: actorId,
  });
}

async function updateForUser(userId, data, actorId) {
  const acc = await BankAccount.findOne({ where: { user_id: userId } });
  if (!acc) throw new ServiceError('bank_account_not_found', 404);
  if (
    (data.number && data.number !== acc.number) ||
    (data.bic && data.bic !== acc.bic)
  ) {
    throw new ServiceError('bank_account_locked');
  }
  await acc.update({ ...data, updated_by: actorId });
  return acc;
}

async function removeForUser(userId) {
  const acc = await BankAccount.findOne({ where: { user_id: userId } });
  if (!acc) throw new ServiceError('bank_account_not_found', 404);
  await acc.destroy();
}

async function fetchFromLegacy(userId) {
  const ext = await UserExternalId.findOne({ where: { user_id: userId } });
  if (!ext) return null;
  const legacy = await legacyUserService.findById(ext.external_id);
  if (!legacy?.bank_rs || !legacy?.bik_bank) return null;

  const number = String(legacy.bank_rs);
  const bic = String(legacy.bik_bank).padStart(9, '0');
  if (!isValidAccountNumber(number, bic)) return null;

  const bank = await dadataService.findBankByBic(bic);
  if (!bank) return null;

  return {
    number,
    bic,
    bank_name: bank.value,
    correspondent_account: bank.data.correspondent_account,
    swift: bank.data.swift,
    inn: bank.data.inn,
    kpp: bank.data.kpp,
    address: bank.data.address?.unrestricted_value,
  };
}

async function importFromLegacy(userId) {
  const existing = await BankAccount.findOne({ where: { user_id: userId } });
  if (existing) return existing;

  const ext = await UserExternalId.findOne({ where: { user_id: userId } });
  if (!ext) return null;
  const legacy = await legacyUserService.findById(ext.external_id);
  if (!legacy?.bank_rs || !legacy?.bik_bank) return null;

  const number = String(legacy.bank_rs);
  const bic = String(legacy.bik_bank).padStart(9, '0');
  if (!isValidAccountNumber(number, bic)) return null;

  const bank = await dadataService.findBankByBic(bic);
  if (!bank) return null;

  try {
    return await createForUser(
      userId,
      {
        number,
        bic,
        bank_name: bank.value,
        correspondent_account: bank.data.correspondent_account,
        swift: bank.data.swift,
        inn: bank.data.inn,
        kpp: bank.data.kpp,
        address: bank.data.address?.unrestricted_value,
      },
      userId
    );
    // eslint-disable-next-line no-unused-vars
  } catch (err) {
    return null;
  }
}

export default {
  getByUser,
  createForUser,
  updateForUser,
  removeForUser,
  fetchFromLegacy,
  importFromLegacy,
};
