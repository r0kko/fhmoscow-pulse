import {
  MedicalExam,
  MedicalExamRegistration,
  User,
  MedicalCenter,
  Address,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

async function listByExam(examId, options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  return MedicalExamRegistration.findAndCountAll({
    where: { medical_exam_id: examId },
    include: [User],
    order: [[User, 'last_name', 'ASC'], [User, 'first_name', 'ASC']],
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
      MedicalExamRegistration,
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
    const status = reg ? reg.status : null;
    const activeRegs = regs.filter((r) => r.status !== 'canceled');
    const available =
      typeof e.capacity === 'number' ? Math.max(0, e.capacity - activeRegs.length) : null;
    const approvedCount = regs.filter((r) => r.status === 'approved' || r.status === 'completed').length;
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
      },
      MedicalExamRegistration,
    ],
    where: { start_at: { [Op.gt]: now } },
    order: [['start_at', 'ASC']],
    limit,
    offset,
  });
  const mapped = rows.map((e) => {
    const regs = e.MedicalExamRegistrations.filter((r) => !r.deletedAt);
    const activeRegs = regs.filter((r) => r.status !== 'canceled');
    const available =
      typeof e.capacity === 'number' ? Math.max(0, e.capacity - activeRegs.length) : null;
    const reg = regs.find((r) => r.user_id === userId);
    const status = reg ? reg.status : null;
    const approvedCount = regs.filter((r) => r.status === 'approved' || r.status === 'completed').length;
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
    include: [MedicalExamRegistration],
  });
  if (!exam) throw new ServiceError('exam_not_found', 404);
  if (new Date(exam.start_at) <= new Date())
    throw new ServiceError('registration_closed');
  const count = exam.MedicalExamRegistrations.filter(
    (r) => !r.deletedAt && r.status !== 'canceled'
  ).length;
  if (exam.capacity && count >= exam.capacity)
    throw new ServiceError('exam_full');

  const existing = await MedicalExamRegistration.findOne({
    where: { medical_exam_id: examId, user_id: userId },
    paranoid: false,
  });
  if (existing) throw new ServiceError('already_registered');

  await MedicalExamRegistration.create({
    medical_exam_id: examId,
    user_id: userId,
    status: 'pending',
    created_by: actorId,
    updated_by: actorId,
  });
}

async function unregister(userId, examId) {
  const reg = await MedicalExamRegistration.findOne({
    where: { medical_exam_id: examId, user_id: userId },
  });
  if (!reg) throw new ServiceError('registration_not_found', 404);
  if (reg.status !== 'pending') throw new ServiceError('cancellation_forbidden');
  await reg.update({ status: 'canceled' });
}

async function setStatus(examId, userId, status, actorId) {
  const reg = await MedicalExamRegistration.findOne({
    where: { medical_exam_id: examId, user_id: userId },
  });
  if (!reg) throw new ServiceError('registration_not_found', 404);
  await reg.update({ status, updated_by: actorId });
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
