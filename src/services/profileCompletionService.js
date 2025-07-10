import { User, Role, Passport, Inn, Snils, BankAccount, UserAddress, Taxation, TaxationType } from '../models/index.js';

async function listByRole(alias) {
  return User.findAll({
    include: [
      { model: Role, where: { alias }, through: { attributes: [] }, required: true },
      { model: Passport, attributes: ['id'], required: false },
      { model: Inn, attributes: ['id'], required: false },
      { model: Snils, attributes: ['id'], required: false },
      { model: BankAccount, attributes: ['id'], required: false },
      { model: UserAddress, attributes: ['id'], required: false },
      {
        model: Taxation,
        attributes: ['id'],
        include: [{ model: TaxationType }],
        required: false,
      },
    ],
    order: [
      ['last_name', 'ASC'],
      ['first_name', 'ASC'],
    ],
    distinct: true,
  });
}

export default { listByRole };
