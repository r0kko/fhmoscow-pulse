import {
  Passport,
  DocumentType,
  Country,
  User,
  UserExternalId,
} from '../models/index.js';
import {
  calculateValidUntil,
  sanitizePassportData,
} from '../utils/passportUtils.js';

import legacyUserService from './legacyUserService.js';
import dadataService from './dadataService.js';
import ServiceError from '../errors/ServiceError.js';

async function getByUser(userId) {
  return Passport.findOne({
    where: { user_id: userId },
    include: [DocumentType, Country],
  });
}

async function createForUser(userId, data, adminId) {
  data = sanitizePassportData(data);

  if (data.issue_date) {
    const issue = new Date(data.issue_date);
    if (Number.isNaN(issue.getTime()) || issue < new Date('2000-01-01')) {
      throw new ServiceError('invalid_issue_date');
    }
  }

  const [user, existing] = await Promise.all([
    User.findByPk(userId),
    Passport.findOne({ where: { user_id: userId } }),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (existing) throw new ServiceError('passport_exists');

  const [type, country] = await Promise.all([
    DocumentType.findOne({ where: { alias: data.document_type } }),
    Country.findOne({ where: { alias: data.country } }),
  ]);
  if (!type) throw new ServiceError('document_type_not_found', 404);
  if (!country) throw new ServiceError('country_not_found', 404);

  let validUntil = data.valid_until;
  if (data.document_type === 'CIVIL' && data.country === 'RU') {
    if (data.series && data.number) {
      const cleaned = await dadataService.cleanPassport(
        `${data.series} ${data.number}`
      );
      if (!cleaned || cleaned.qc !== 0) {
        throw new ServiceError('invalid_passport');
      }
      data.series = cleaned.series;
      data.number = cleaned.number;
      data.issue_date = cleaned.issue_date || data.issue_date;
      data.issuing_authority = cleaned.issue_org || data.issuing_authority;
      data.issuing_authority_code =
        cleaned.issue_code || data.issuing_authority_code;
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
  if (!passport) throw new ServiceError('passport_not_found', 404);
  await passport.destroy();
  return true;
}

async function fetchFromLegacy(userId) {
  const ext = await UserExternalId.findOne({ where: { user_id: userId } });
  if (!ext) return null;
  const legacy = await legacyUserService.findById(ext.external_id);
  if (!legacy?.ps_ser || !legacy?.ps_num) return null;

  return sanitizePassportData({
    document_type: 'CIVIL',
    country: 'RU',
    series: String(legacy.ps_ser).trim(),
    number: String(legacy.ps_num).trim().padStart(6, '0'),
    issue_date: legacy.ps_date,
    issuing_authority: legacy.ps_org,
    issuing_authority_code: legacy.ps_pdrz,
  });
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
      series: String(legacy.ps_ser).trim(),
      number: String(legacy.ps_num).trim().padStart(6, '0'),
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

export default {
  getByUser,
  createForUser,
  removeByUser,
  importFromLegacy,
  fetchFromLegacy,
};
