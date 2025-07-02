import { MedicalExam, MedicalExamStatus, MedicalCenter } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  return MedicalExam.findAndCountAll({
    include: [MedicalExamStatus, MedicalCenter],
    order: [['start_at', 'DESC']],
    limit,
    offset,
  });
}

async function getById(id) {
  const exam = await MedicalExam.findByPk(id, { include: [MedicalExamStatus, MedicalCenter] });
  if (!exam) throw new ServiceError('exam_not_found', 404);
  return exam;
}

async function create(data, actorId) {
  const status = await MedicalExamStatus.findOne({ where: { alias: 'OPEN' } });
  const exam = await MedicalExam.create({
    medical_center_id: data.medical_center_id,
    status_id: status ? status.id : data.status_id,
    start_at: data.start_at,
    end_at: data.end_at,
    capacity: data.capacity,
    created_by: actorId,
    updated_by: actorId,
  });
  return getById(exam.id);
}

async function update(id, data, actorId) {
  const exam = await MedicalExam.findByPk(id);
  if (!exam) throw new ServiceError('exam_not_found', 404);
  let statusId = exam.status_id;
  if (data.status) {
    const st = await MedicalExamStatus.findOne({ where: { alias: data.status } });
    if (st) statusId = st.id;
  }
  await exam.update(
    {
      medical_center_id: data.medical_center_id ?? exam.medical_center_id,
      status_id: statusId,
      start_at: data.start_at ?? exam.start_at,
      end_at: data.end_at ?? exam.end_at,
      capacity: data.capacity ?? exam.capacity,
      updated_by: actorId,
    },
    { returning: false }
  );
  return getById(id);
}

async function remove(id) {
  const exam = await MedicalExam.findByPk(id);
  if (!exam) throw new ServiceError('exam_not_found', 404);
  await exam.destroy();
}

async function listStatuses() {
  return MedicalExamStatus.findAll({ order: [['id', 'ASC']] });
}

export default { listAll, getById, create, update, remove, listStatuses };
