import { Op } from 'sequelize';

import {
  User,
  Role,
  Passport,
  Inn,
  Snils,
  BankAccount,
  UserAddress,
  Taxation,
  TaxationType,
} from '../models/index.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function normalizePage(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

async function listByRole(aliases, options = {}) {
  const where = { alias: Array.isArray(aliases) ? aliases : [aliases] };
  const userWhere = {};
  const page = normalizePage(options.page);
  const limit = normalizeLimit(options.limit);
  const offset = (page - 1) * limit;
  const searchTerm = String(options.search || '').trim();
  if (searchTerm) {
    const term = `%${searchTerm}%`;
    userWhere[Op.or] = [
      { last_name: { [Op.iLike]: term } },
      { first_name: { [Op.iLike]: term } },
      { patronymic: { [Op.iLike]: term } },
      { phone: { [Op.iLike]: term } },
      { email: { [Op.iLike]: term } },
    ];
  }

  const { rows, count } = await User.findAndCountAll({
    where: userWhere,
    include: [
      {
        model: Role,
        where,
        through: { attributes: [] },
        required: true,
      },
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
    subQuery: false,
    limit,
    offset,
  });

  return {
    rows,
    count,
    page,
    limit,
    pages: Math.max(1, Math.ceil(count / Math.max(limit, 1))),
  };
}

export default { listByRole };
