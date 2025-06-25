import { Passport, DocumentType, Country, User } from '../models/index.js';
import { calculateValidUntil } from '../utils/passportUtils.js';

async function getByUser(userId) {
  return Passport.findOne({
    where: { user_id: userId },
    include: [DocumentType, Country],
  });
}

async function createForUser(userId, data, adminId) {
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

async function updateForUser(userId, data, actorId) {
  const passport = await Passport.findOne({ where: { user_id: userId } });
  if (!passport) throw new Error('passport_not_found');

  let typeId = passport.document_type_id;
  let countryId = passport.country_id;

  if (data.document_type) {
    const type = await DocumentType.findOne({ where: { alias: data.document_type } });
    if (!type) throw new Error('document_type_not_found');
    typeId = type.id;
  }

  if (data.country) {
    const country = await Country.findOne({ where: { alias: data.country } });
    if (!country) throw new Error('country_not_found');
    countryId = country.id;
  }

  let validUntil = data.valid_until ?? passport.valid_until;
  if (data.document_type === 'CIVIL' && data.country === 'RU') {
    const user = await User.findByPk(userId);
    validUntil = calculateValidUntil(user.birth_date, data.issue_date);
  }

  await passport.update({
    document_type_id: typeId,
    country_id: countryId,
    series: data.series,
    number: data.number,
    issue_date: data.issue_date,
    valid_until: validUntil,
    issuing_authority: data.issuing_authority,
    issuing_authority_code: data.issuing_authority_code,
    place_of_birth: data.place_of_birth,
    updated_by: actorId,
  });

  return getByUser(userId);
}

export default { getByUser, createForUser, updateForUser, removeByUser };
