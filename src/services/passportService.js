import { Passport, DocumentType, Country, User } from '../models/index.js';

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

  await Passport.create({
    user_id: userId,
    document_type_id: type.id,
    country_id: country.id,
    series: data.series,
    number: data.number,
    issue_date: data.issue_date,
    valid_until: data.valid_until,
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

export default { getByUser, createForUser, removeByUser };
