import { Op } from 'sequelize';

import {
  User,
  Role,
  UserStatus,
  UserSignType,
  SignType,
  Document,
  DocumentType,
  DocumentStatus,
  Passport,
  Inn,
  Snils,
  BankAccount,
  UserAddress,
  Taxation,
  TaxationType,
  Season,
  NormativeResult,
  NormativeType,
  NormativeZone,
  NormativeValueType,
  MeasurementUnit,
} from '../models/index.js';

import { hasAnySnils } from './snilsService.js';

const REFEREE_ROLE_ALIASES = ['REFEREE', 'BRIGADE_REFEREE'];

async function listJudges() {
  const users = await User.findAll({
    attributes: ['id', 'last_name', 'first_name', 'patronymic', 'birth_date'],
    include: [
      {
        model: Role,
        attributes: [],
        through: { attributes: [] },
        where: { alias: { [Op.in]: REFEREE_ROLE_ALIASES } },
        required: true,
      },
      {
        model: UserStatus,
        attributes: ['alias'],
        where: { alias: { [Op.ne]: 'INACTIVE' } },
        required: true,
      },
      {
        model: UserSignType,
        attributes: ['id'],
        required: false,
        include: [{ model: SignType, attributes: ['id', 'name', 'alias'] }],
      },
    ],
    order: [
      ['last_name', 'ASC'],
      ['first_name', 'ASC'],
    ],
  });

  // Fetch existing contract applications for these users (latest per user)
  const ids = users.map((u) => u.id);
  let docsByUser = new Map();
  try {
    const docs = await Document.findAll({
      where: { recipient_id: { [Op.in]: ids } },
      include: [
        {
          model: DocumentType,
          attributes: ['alias'],
          where: { alias: 'REFEREE_CONTRACT_APPLICATION' },
        },
        { model: DocumentStatus, attributes: ['name', 'alias'] },
      ],
      order: [['created_at', 'DESC']],
    });
    for (const d of docs) {
      if (!docsByUser.has(d.recipient_id)) docsByUser.set(d.recipient_id, d);
    }
  } catch (_e) {
    docsByUser = new Map();
  }

  return users.map((u) => ({
    id: u.id,
    lastName: u.last_name,
    firstName: u.first_name,
    patronymic: u.patronymic,
    birthDate: u.birth_date,
    signType: u.UserSignTypes?.[0]?.SignType
      ? {
          id: u.UserSignTypes[0].SignType.id,
          name: u.UserSignTypes[0].SignType.name,
          alias: u.UserSignTypes[0].SignType.alias,
        }
      : null,
    contract: docsByUser.has(u.id)
      ? {
          id: docsByUser.get(u.id).id,
          number: docsByUser.get(u.id).number || null,
          status: docsByUser.get(u.id).DocumentStatus
            ? {
                name: docsByUser.get(u.id).DocumentStatus.name,
                alias: docsByUser.get(u.id).DocumentStatus.alias,
              }
            : null,
        }
      : null,
  }));
}

export default { listJudges, precheck };

function calcAgeYears(birthDate) {
  if (!birthDate) return null;
  const bd = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  const m = now.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age -= 1;
  return age;
}

async function precheck(userId) {
  // Defensive: fail fast on missing/empty id
  if (!userId) return null;
  const user = await User.findByPk(userId, {
    attributes: ['id', 'last_name', 'first_name', 'patronymic', 'birth_date'],
    include: [
      { model: Role, attributes: ['alias'], through: { attributes: [] } },
      {
        model: UserSignType,
        attributes: ['id'],
        required: false,
        include: [{ model: SignType, attributes: ['alias', 'name'] }],
      },
      { model: Passport, attributes: ['id'], required: false },
      { model: Inn, attributes: ['id'], required: false },
      { model: Snils, attributes: ['id'], required: false },
      { model: BankAccount, attributes: ['id'], required: false },
      { model: UserAddress, attributes: ['id'], required: false },
      {
        model: Taxation,
        attributes: ['id'],
        include: [{ model: TaxationType, attributes: ['id', 'name', 'alias'] }],
        required: false,
      },
    ],
  });
  if (!user) return null;

  const roles = (user.Roles || []).map((r) => r.alias);
  const isFieldReferee = roles.includes('REFEREE');

  const ageYears = calcAgeYears(user.birth_date);
  const ageOk = ageYears != null && ageYears >= 16;

  const signTypeAlias = user.UserSignTypes?.[0]?.SignType?.alias || null;
  const signTypeName = user.UserSignTypes?.[0]?.SignType?.name || null;
  const hasSimpleElectronicSign = signTypeAlias === 'SIMPLE_ELECTRONIC';

  // Associations: Taxation is hasOne, others as declared in models/index
  const taxType = user.Taxation?.TaxationType || null;
  const taxationPresent = !!taxType;
  const taxationTypeName = taxType?.name || null;
  const taxationTypeAlias = taxType?.alias || null;
  const taxationOk = taxationPresent && taxationTypeAlias !== 'PERSON';

  // SNILS presence: use unified helper (local record or legacy fallback)
  const snilsPresent = await hasAnySnils(user.id);
  const docs = {
    passport: !!user.Passport,
    inn: !!user.Inn,
    snils: snilsPresent,
    bank: !!user.BankAccount,
    address: Array.isArray(user.UserAddresses) && user.UserAddresses.length > 0,
  };
  const allDocs =
    docs.passport && docs.inn && docs.snils && docs.bank && docs.address;

  // Best normative results for field referees only
  let bestNormatives = [];
  let seasonNormatives = [];
  if (isFieldReferee) {
    try {
      const season = await Season.findOne({ where: { active: true } });
      if (season) {
        const results = await NormativeResult.findAll({
          where: { user_id: user.id, season_id: season.id },
          include: [
            { model: NormativeType, attributes: ['id', 'name'] },
            { model: MeasurementUnit, attributes: ['alias', 'name'] },
            { model: NormativeValueType, attributes: ['alias'] },
            { model: NormativeZone, attributes: ['id', 'name', 'alias'] },
          ],
        });
        const map = new Map();
        for (const r of results) {
          const key = r.type_id;
          const existing = map.get(key);
          const vt = r.NormativeValueType?.alias;
          const isBetter =
            !existing ||
            (vt === 'LESS_BETTER'
              ? r.value < existing.value
              : r.value > existing.value);
          if (isBetter) {
            map.set(key, {
              typeId: r.NormativeType?.id,
              typeName: r.NormativeType?.name,
              unit: r.MeasurementUnit
                ? {
                    alias: r.MeasurementUnit.alias,
                    name: r.MeasurementUnit.name,
                  }
                : null,
              value: r.value,
              zone: r.NormativeZone
                ? {
                    id: r.NormativeZone.id,
                    name: r.NormativeZone.name,
                    alias: r.NormativeZone.alias,
                  }
                : null,
            });
          }
        }
        bestNormatives = Array.from(map.values());

        // Build full season normative list: include all types even when no results
        const types = await NormativeType.findAll({
          where: { season_id: season.id },
          attributes: ['id', 'name'],
          include: [
            { model: MeasurementUnit, attributes: ['alias', 'name'] },
            { model: NormativeValueType, attributes: ['alias'] },
          ],
          order: [['name', 'ASC']],
        });
        const bestByTypeId = new Map(bestNormatives.map((x) => [x.typeId, x]));
        seasonNormatives = types.map((t) => {
          const best = bestByTypeId.get(t.id);
          return {
            typeId: t.id,
            typeName: t.name,
            unit: t.MeasurementUnit
              ? { alias: t.MeasurementUnit.alias, name: t.MeasurementUnit.name }
              : null,
            // For consistency include value_type for future UI decisions
            valueType: t.NormativeValueType?.alias || null,
            value: best?.value ?? null,
            zone: best?.zone || null,
          };
        });
      }
    } catch (_e) {
      // non-critical; leave bestNormatives empty on error
      bestNormatives = [];
      seasonNormatives = [];
    }
  }

  return {
    user: {
      id: user.id,
      lastName: user.last_name,
      firstName: user.first_name,
      patronymic: user.patronymic,
      birthDate: user.birth_date,
    },
    checks: {
      ageOk,
      ageYears,
      simpleESign: {
        has: hasSimpleElectronicSign,
        alias: signTypeAlias,
        name: signTypeName,
      },
      taxation: {
        present: taxationPresent,
        typeName: taxationTypeName,
        typeAlias: taxationTypeAlias,
        isNotPerson: taxationOk,
      },
      documents: { ...docs, all: allDocs },
      isFieldReferee,
    },
    bestNormatives,
    seasonNormatives,
  };
}

export { precheck };
