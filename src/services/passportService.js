import {
  Passport,
  DocumentType,
  Country,
  User,
  UserExternalId,
} from '../models/index.js';
import { calculateValidUntil, sanitizePassportData } from '../utils/passportUtils.js';

import legacyUserService from './legacyUserService.js';
import dadataService from './dadataService.js';

async function getByUser(userId) {
  return Passport.findOne({
    where: { user_id: userId },
    include: [DocumentType, Country],
  });
}

async function createForUser(userId, data, adminId) {
  data = sanitizePassportData(data);

  const [user, existing] = await Promise.all([
    User.findByPk(userId),
    Passport.findOne({ where: { user_id: userId } }),
  ]);
  if (!user) throw new Error('user_not_found');
  if (existing) throw new Error('passport_exists');

  const [type, country] = await Promise.all([
    DocumentType.findOne({ where: { alias: data.document_type } }),
    Country.findOne({ where: { alias: data.country } }),
  ]);
  if (!type) throw new Error('document_type_not_found');
  if (!country) throw new Error('country_not_found');

  let validUntil = data.valid_until;
  if (data.document_type === 'CIVIL' && data.country === 'RU') {
    if (data.series && data.number) {
      const cleaned = await dadataService.cleanPassport(
        `${data.series} ${data.number}`
      );
      if (!cleaned || cleaned.qc !== 0) {
        throw new Error('invalid_passport');
      }
      data.series = cleaned.series;
      data.number = cleaned.number;
      data.issue_date = cleaned.issue_date || data.issue_date;
      data.issuing_authority = cleaned.issue_org || data.issuing_authority;
      data.issuing_authority_code = cleaned.issue_code || data.issuing_authority_code;
      data = sanitizePassportData(data);
    }
    validUntil = calculateValidUntil(user.birth_date, data.issue_date);
  }

  await Passport.create({
    user_id: userId,
    document_type_id: type.id,
    country_id: country.id,
    series: data.series,
    number: data.number,
    issue_date: data.issue_date,
    valid_until: validUntil,
    issuing_authority: data.issuing_authority,
    issuing_authority_code: data.issuing_authority_code,
    place_of_birth: data.place_of_birth,
    created_by: adminId,
  });
  return getByUser(userId);
}

async function removeByUser(userId) {
  const passport = await Passport.findOne({ where: { user_id: userId } });
  if (!passport) throw new Error('passport_not_found');
  await passport.destroy();
  return true;
}

async function importFromLegacy(userId) {
  const existing = await Passport.findOne({ where: { user_id: userId } });
  if (existing) return existing;

  const ext = await UserExternalId.findOne({ where: { user_id: userId } });
  if (!ext) return null;
  const legacy = await legacyUserService.findById(ext.external_id);
  if (!legacy?.ps_ser || !legacy?.ps_num) return null;

  try {
    const data = sanitizePassportData({
      document_type: 'CIVIL',
      country: 'RU',
      series: legacy.ps_ser,
      number: String(legacy.ps_num).padStart(6, '0'),
      issue_date: legacy.ps_date,
      issuing_authority: legacy.ps_org,
      issuing_authority_code: legacy.ps_pdrz,
    });
    return await createForUser(userId, data, userId);
    // eslint-disable-next-line no-unused-vars
  } catch (err) {
    return null;
  }
}

export default { getByUser, createForUser, removeByUser, importFromLegacy };
