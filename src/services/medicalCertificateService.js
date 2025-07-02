import { Op } from 'sequelize';

import { MedicalCertificate, User, Role } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

import emailService from './emailService.js';

async function getByUser(userId) {
  const today = new Date().toISOString().slice(0, 10);
  return MedicalCertificate.findOne({
    where: {
      user_id: userId,
      valid_until: { [Op.gte]: today },
      issue_date: { [Op.lte]: today },
    },
    order: [['valid_until', 'DESC']],
  });
}

async function listByUser(userId) {
  const today = new Date().toISOString().slice(0, 10);
  return MedicalCertificate.findAll({
    where: {
      user_id: userId,
      valid_until: { [Op.lt]: today },
    },
    order: [['issue_date', 'DESC']],
  });
}

async function createForUser(userId, data, actorId) {
  const user = await User.findByPk(userId);
  if (!user) throw new ServiceError('user_not_found', 404);
  const certificate = await MedicalCertificate.create({
    user_id: userId,
    inn: data.inn,
    organization: data.organization,
    certificate_number: data.certificate_number,
    issue_date: data.issue_date,
    valid_until: data.valid_until,
    created_by: actorId,
    updated_by: actorId,
  });
  if (actorId !== userId) {
    await emailService.sendMedicalCertificateAddedEmail(user);
  }
  return certificate;
}

async function removeForUser(userId) {
  const cert = await MedicalCertificate.findOne({
    where: { user_id: userId },
    order: [['valid_until', 'DESC']],
  });
  if (!cert) throw new ServiceError('certificate_not_found', 404);
  await cert.destroy();
}

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;

  const include = [
    {
      model: User,
      include: options.role
        ? [{ model: Role, where: { alias: options.role }, through: { attributes: [] }, required: true }]
        : [],
    },
  ];

  return MedicalCertificate.findAndCountAll({
    include,
    order: [['issue_date', 'DESC']],
    limit,
    offset,
  });
}

async function listByRole(alias) {
  return MedicalCertificate.findAll({
    include: [
      {
        model: User,
        required: true,
        include: [
          {
            model: Role,
            where: { alias },
            through: { attributes: [] },
            required: true,
          },
        ],
      },
    ],
    order: [
      [User, 'last_name', 'ASC'],
      [User, 'first_name', 'ASC'],
      ['issue_date', 'DESC'],
    ],
  });
}

async function getById(id) {
  const cert = await MedicalCertificate.findByPk(id, {
    include: [User],
  });
  if (!cert) throw new ServiceError('certificate_not_found', 404);
  return cert;
}

async function updateForUser(userId, data, actorId) {
  const cert = await MedicalCertificate.findOne({
    where: { user_id: userId },
    order: [['valid_until', 'DESC']],
  });
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
  listByRole,
  getById,
  updateForUser,
  update,
  remove,
};
