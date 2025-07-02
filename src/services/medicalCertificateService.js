import { Op } from 'sequelize';

import { MedicalCertificate, User } from '../models/index.js';
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
    },
  ];

  if (options.role) {
    const { Role } = await import('../models/index.js');
    include[0].include = [
      {
        model: Role,
        where: { alias: options.role },
        through: { attributes: [] },
        required: true,
      },
    ];
  }

  return MedicalCertificate.findAndCountAll({
    include,
    order: [['issue_date', 'DESC']],
    limit,
    offset,
  });
}

async function listByRole(alias) {
  const { Role } = await import('../models/index.js');
  const users = await User.findAll({
    include: [
      {
        model: Role,
        where: { alias },
        through: { attributes: [] },
        required: true,
      },
    ],
    order: [
      ['last_name', 'ASC'],
      ['first_name', 'ASC'],
    ],
  });

  const certs = await MedicalCertificate.findAll({
    where: { user_id: users.map((u) => u.id) },
    order: [['issue_date', 'DESC']],
  });

  const grouped = {};
  for (const cert of certs) {
    if (!grouped[cert.user_id]) grouped[cert.user_id] = [];
    grouped[cert.user_id].push(cert);
  }

  return users.map((u) => ({ user: u, certificates: grouped[u.id] || [] }));
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
