import {
  MedicalExam,
  MedicalExamRegistration,
  User,
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

async function register(userId, examId, actorId) {
  const exam = await MedicalExam.findByPk(examId, {
    include: [MedicalExamRegistration],
  });
  if (!exam) throw new ServiceError('exam_not_found', 404);
  if (new Date(exam.start_at) <= new Date())
    throw new ServiceError('registration_closed');
  const count = exam.MedicalExamRegistrations.filter((r) => !r.deletedAt).length;
  if (exam.capacity && count >= exam.capacity)
    throw new ServiceError('exam_full');
  const existing = exam.MedicalExamRegistrations.find(
    (r) => r.user_id === userId
  );
  if (existing) {
    if (!existing.deletedAt) throw new ServiceError('already_registered');
    await existing.restore();
    await existing.update({ approved: false, updated_by: actorId });
    return;
  }
  await MedicalExamRegistration.create({
    medical_exam_id: examId,
    user_id: userId,
    approved: false,
    created_by: actorId,
    updated_by: actorId,
  });
}

async function unregister(userId, examId) {
  const reg = await MedicalExamRegistration.findOne({
    where: { medical_exam_id: examId, user_id: userId },
  });
  if (!reg) throw new ServiceError('registration_not_found', 404);
  await reg.destroy();
}

async function setApproval(examId, userId, approved, actorId) {
  const reg = await MedicalExamRegistration.findOne({
    where: { medical_exam_id: examId, user_id: userId },
  });
  if (!reg) throw new ServiceError('registration_not_found', 404);
  await reg.update({ approved, updated_by: actorId });
}

async function remove(examId, userId) {
  const reg = await MedicalExamRegistration.findOne({
    where: { medical_exam_id: examId, user_id: userId },
  });
  if (!reg) throw new ServiceError('registration_not_found', 404);
  await reg.destroy();
}

export default { listByExam, register, unregister, setApproval, remove };
