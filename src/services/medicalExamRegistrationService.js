import {
  MedicalExam,
  MedicalExamRegistration,
  MedicalExamRegistrationStatus,
  User,
  MedicalCenter,
  Address,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

const statusCache = new Map();
async function getStatusId(alias) {
  if (statusCache.has(alias)) return statusCache.get(alias);
  const status = await MedicalExamRegistrationStatus.findOne({
    where: { alias },
  });
  if (!status) throw new ServiceError('status_not_found', 404);
  statusCache.set(alias, status.id);
  return status.id;
}

async function listByExam(examId, options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  return MedicalExamRegistration.findAndCountAll({
    where: { medical_exam_id: examId },
    include: [User, MedicalExamRegistrationStatus],
    order: [
      [User, 'last_name', 'ASC'],
      [User, 'first_name', 'ASC'],
      [User, 'patronymic', 'ASC'],
    ],
    limit,
    offset,
  });
}

async function listAvailable(userId, options = {}) {
  const { Op } = await import('sequelize');
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  const now = new Date();
  const { rows, count } = await MedicalExam.findAndCountAll({
    include: [
      { model: MedicalCenter, include: [Address] },
      {
        model: MedicalExamRegistration,
        include: [MedicalExamRegistrationStatus],
      },
    ],
    where: { start_at: { [Op.gt]: now } },
    order: [['start_at', 'ASC']],
    distinct: true,
    limit,
    offset,
  });
  const mapped = rows.map((e) => {
    const regs = e.MedicalExamRegistrations.filter((r) => !r.deletedAt);
    const reg = regs.find((r) => r.user_id === userId);
    const registered = !!reg;
    const status = reg ? reg.MedicalExamRegistrationStatus?.alias : null;
    const approvedRegs = regs.filter(
      (r) =>
        r.MedicalExamRegistrationStatus?.alias === 'APPROVED' ||
        r.MedicalExamRegistrationStatus?.alias === 'COMPLETED'
    );
    const approvedCount = approvedRegs.length;
    const available =
      typeof e.capacity === 'number'
        ? Math.max(0, e.capacity - approvedCount)
        : null;
    return {
      ...e.get({ plain: true }),
      available,
      registration_count: regs.length,
      approved_count: approvedCount,
      user_registered: registered,
      registration_status: status,
    };
  });
  return { rows: mapped, count };
}

async function listUpcomingByUser(userId, options = {}) {
  const { Op } = await import('sequelize');
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  const now = new Date();
  const { rows } = await MedicalExam.findAndCountAll({
    include: [
      { model: MedicalCenter, include: [Address] },
      {
        model: MedicalExamRegistration,
        where: { user_id: userId },
        required: true,
        include: [MedicalExamRegistrationStatus],
      },
      {
        model: MedicalExamRegistration,
        include: [MedicalExamRegistrationStatus],
      },
    ],
    where: { start_at: { [Op.gt]: now } },
    order: [['start_at', 'ASC']],
    limit,
    offset,
  });
  const mapped = rows.map((e) => {
    const regs = e.MedicalExamRegistrations.filter((r) => !r.deletedAt);
    const reg = regs.find((r) => r.user_id === userId);
    const status = reg ? reg.MedicalExamRegistrationStatus?.alias : null;
    const approvedRegs = regs.filter(
      (r) =>
        r.MedicalExamRegistrationStatus?.alias === 'APPROVED' ||
        r.MedicalExamRegistrationStatus?.alias === 'COMPLETED'
    );
    const approvedCount = approvedRegs.length;
    const available =
      typeof e.capacity === 'number'
        ? Math.max(0, e.capacity - approvedCount)
        : null;
    return {
      ...e.get({ plain: true }),
      available,
      registration_count: regs.length,
      approved_count: approvedCount,
      user_registered: true,
      registration_status: status,
    };
  });
  return { rows: mapped, count: mapped.length };
}

async function register(userId, examId, actorId) {
  const exam = await MedicalExam.findByPk(examId, {
    include: [
      {
        model: MedicalExamRegistration,
        include: [MedicalExamRegistrationStatus],
      },
    ],
  });
  if (!exam) throw new ServiceError('exam_not_found', 404);
  if (new Date(exam.start_at) <= new Date())
    throw new ServiceError('registration_closed');
  const approvedCount = exam.MedicalExamRegistrations.filter(
    (r) =>
      !r.deletedAt &&
      (r.MedicalExamRegistrationStatus?.alias === 'APPROVED' ||
        r.MedicalExamRegistrationStatus?.alias === 'COMPLETED')
  ).length;
  if (exam.capacity && approvedCount >= exam.capacity)
    throw new ServiceError('exam_full');

  const existing = await MedicalExamRegistration.findOne({
    where: { medical_exam_id: examId, user_id: userId },
    paranoid: false,
  });
  if (existing && !existing.deletedAt)
    throw new ServiceError('already_registered');

  const pendingId = await getStatusId('PENDING');
  const approvedId = await getStatusId('APPROVED');
  const { Op } = await import('sequelize');
  const other = await MedicalExamRegistration.findOne({
    where: {
      user_id: userId,
      medical_exam_id: { [Op.ne]: examId },
      status_id: { [Op.in]: [pendingId, approvedId] },
    },
  });
  if (other) throw new ServiceError('other_active');
  if (existing && existing.deletedAt) {
    await existing.restore();
    await existing.update({
      status_id: pendingId,
      created_by: actorId,
      updated_by: actorId,
    });
    return;
  }
  await MedicalExamRegistration.create({
    medical_exam_id: examId,
    user_id: userId,
    status_id: pendingId,
    created_by: actorId,
    updated_by: actorId,
  });
}

async function unregister(userId, examId) {
  const reg = await MedicalExamRegistration.findOne({
    where: { medical_exam_id: examId, user_id: userId },
  });
  if (!reg) throw new ServiceError('registration_not_found', 404);
  const pendingId = await getStatusId('PENDING');
  if (reg.status_id !== pendingId)
    throw new ServiceError('cancellation_forbidden');
  await reg.destroy();
}

async function setStatus(examId, userId, status, actorId) {
  const reg = await MedicalExamRegistration.findOne({
    where: { medical_exam_id: examId, user_id: userId },
  });
  if (!reg) throw new ServiceError('registration_not_found', 404);
  const statusId = await getStatusId(status);
  await reg.update({ status_id: statusId, updated_by: actorId });
}

async function remove(examId, userId) {
  const reg = await MedicalExamRegistration.findOne({
    where: { medical_exam_id: examId, user_id: userId },
  });
  if (!reg) throw new ServiceError('registration_not_found', 404);
  await reg.destroy();
}

export default {
  listByExam,
  listAvailable,
  listUpcomingByUser,
  register,
  unregister,
  setStatus,
  remove,
};
