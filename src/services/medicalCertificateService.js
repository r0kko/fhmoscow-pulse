import { MedicalCertificate, User } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

async function getByUser(userId) {
  return MedicalCertificate.findOne({ where: { user_id: userId } });
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

export default { getByUser, createForUser, removeForUser };
