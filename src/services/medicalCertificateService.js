import { MedicalCertificate, User } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

async function getByUser(userId) {
  return MedicalCertificate.findOne({ where: { user_id: userId } });
}

async function listByUser(userId) {
  return MedicalCertificate.findAll({
    where: { user_id: userId },
    order: [['issue_date', 'DESC']],
    paranoid: false,
  });
}

async function createForUser(userId, data, actorId) {
  const [user, existing] = await Promise.all([
    User.findByPk(userId),
    MedicalCertificate.findOne({ where: { user_id: userId } }),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (existing) throw new ServiceError('certificate_exists');

  return MedicalCertificate.create({
    user_id: userId,
    inn: data.inn,
    organization: data.organization,
    certificate_number: data.certificate_number,
    issue_date: data.issue_date,
    valid_until: data.valid_until,
    created_by: actorId,
    updated_by: actorId,
  });
}

async function removeForUser(userId) {
  const cert = await MedicalCertificate.findOne({ where: { user_id: userId } });
  if (!cert) throw new ServiceError('certificate_not_found', 404);
  await cert.destroy();
}

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;

  return MedicalCertificate.findAndCountAll({
    include: [User],
    order: [['issue_date', 'DESC']],
    limit,
    offset,
    paranoid: false,
  });
}

async function getById(id) {
  const cert = await MedicalCertificate.findByPk(id, {
    include: [User],
    paranoid: false,
  });
  if (!cert) throw new ServiceError('certificate_not_found', 404);
  return cert;
}

async function updateForUser(userId, data, actorId) {
  const cert = await MedicalCertificate.findOne({ where: { user_id: userId } });
  if (!cert) throw new ServiceError('certificate_not_found', 404);
  await cert.update({
    inn: data.inn,
    organization: data.organization,
    certificate_number: data.certificate_number,
    issue_date: data.issue_date,
    valid_until: data.valid_until,
    updated_by: actorId,
  });
  return cert;
}

async function update(id, data, actorId) {
  const cert = await MedicalCertificate.findByPk(id);
  if (!cert) throw new ServiceError('certificate_not_found', 404);
  await cert.update({
    inn: data.inn,
    organization: data.organization,
    certificate_number: data.certificate_number,
    issue_date: data.issue_date,
    valid_until: data.valid_until,
    updated_by: actorId,
  });
  return cert;
}

async function remove(id) {
  const cert = await MedicalCertificate.findByPk(id);
  if (!cert) throw new ServiceError('certificate_not_found', 404);
  await cert.destroy();
}

export default {
  getByUser,
  listByUser,
  createForUser,
  removeForUser,
  listAll,
  getById,
  updateForUser,
  update,
  remove,
};
