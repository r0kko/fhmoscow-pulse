import PDFDocument from 'pdfkit-table';

import { applyFonts } from '../utils/pdf.js';
import {
  MedicalExam,
  MedicalExamRegistration,
  MedicalExamRegistrationStatus,
  User,
  MedicalCenter,
  Address,
  Sex,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

import emailService from './emailService.js';

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
  const { Op } = await import('sequelize');
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  const include = [
    {
      model: User,
    },
    MedicalExamRegistrationStatus,
  ];
  if (options.search) {
    const term = `%${options.search}%`;
    include[0].where = {
      [Op.or]: [
        { last_name: { [Op.iLike]: term } },
        { first_name: { [Op.iLike]: term } },
        { patronymic: { [Op.iLike]: term } },
        { email: { [Op.iLike]: term } },
      ],
    };
    include[0].required = true;
  }
  const { rows, count } = await MedicalExamRegistration.findAndCountAll({
    where: { medical_exam_id: examId },
    include,
    order: [
      [User, 'last_name', 'ASC'],
      [User, 'first_name', 'ASC'],
      [User, 'patronymic', 'ASC'],
    ],
    limit,
    offset,
  });

  let approvedBefore = 0;
  if (offset > 0) {
    const before = await MedicalExamRegistration.findAll({
      where: { medical_exam_id: examId },
      include,
      order: [
        [User, 'last_name', 'ASC'],
        [User, 'first_name', 'ASC'],
        [User, 'patronymic', 'ASC'],
      ],
      limit: offset,
    });
    approvedBefore = before.filter(
      (r) =>
        r.MedicalExamRegistrationStatus?.alias === 'APPROVED' ||
        r.MedicalExamRegistrationStatus?.alias === 'COMPLETED'
    ).length;
  }
  return { rows, count, approvedBefore };
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
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
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
    where: { start_at: { [Op.between]: [now, end] } },
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
      { model: MedicalCenter, include: [Address] },
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
    const user = await User.findByPk(userId);
    if (user) {
      await emailService.sendMedicalExamRegistrationCreatedEmail(user, exam);
    }
    return;
  }
  await MedicalExamRegistration.create({
    medical_exam_id: examId,
    user_id: userId,
    status_id: pendingId,
    created_by: actorId,
    updated_by: actorId,
  });
  const user = await User.findByPk(userId);
  if (user) {
    await emailService.sendMedicalExamRegistrationCreatedEmail(user, exam);
  }
}

async function unregister(userId, examId, actorId = null) {
  const reg = await MedicalExamRegistration.findOne({
    where: { medical_exam_id: examId, user_id: userId },
  });
  if (!reg) throw new ServiceError('registration_not_found', 404);
  const pendingId = await getStatusId('PENDING');
  if (reg.status_id !== pendingId)
    throw new ServiceError('cancellation_forbidden');
  await reg.update({ updated_by: actorId });
  await reg.destroy();
  const [exam, user] = await Promise.all([
    MedicalExam.findByPk(examId, {
      include: [{ model: MedicalCenter, include: [Address] }],
    }),
    User.findByPk(userId),
  ]);
  if (user && exam) {
    await emailService.sendMedicalExamRegistrationSelfCancelledEmail(
      user,
      exam
    );
  }
}

async function setStatus(examId, userId, status, actorId) {
  const reg = await MedicalExamRegistration.findOne({
    where: { medical_exam_id: examId, user_id: userId },
  });
  if (!reg) throw new ServiceError('registration_not_found', 404);
  const statusId = await getStatusId(status);
  await reg.update({ status_id: statusId, updated_by: actorId });
  const [exam, user] = await Promise.all([
    MedicalExam.findByPk(examId, {
      include: [{ model: MedicalCenter, include: [Address] }],
    }),
    User.findByPk(userId),
  ]);
  if (user && exam) {
    switch (status) {
      case 'APPROVED':
        await emailService.sendMedicalExamRegistrationApprovedEmail(user, exam);
        break;
      case 'CANCELED':
        await emailService.sendMedicalExamRegistrationCancelledEmail(
          user,
          exam
        );
        break;
      case 'COMPLETED':
        await emailService.sendMedicalExamRegistrationCompletedEmail(
          user,
          exam
        );
        break;
      default:
        await emailService.sendMedicalExamRegistrationCreatedEmail(user, exam);
    }
  }
}

async function remove(examId, userId, actorId = null) {
  const reg = await MedicalExamRegistration.findOne({
    where: { medical_exam_id: examId, user_id: userId },
  });
  if (!reg) throw new ServiceError('registration_not_found', 404);
  await reg.update({ updated_by: actorId });
  await reg.destroy();
  const [exam, user] = await Promise.all([
    MedicalExam.findByPk(examId, {
      include: [{ model: MedicalCenter, include: [Address] }],
    }),
    User.findByPk(userId),
  ]);
  if (user && exam) {
    await emailService.sendMedicalExamRegistrationCancelledEmail(user, exam);
  }
}

async function listApproved(examId) {
  const { Op } = await import('sequelize');
  const approvedId = await getStatusId('APPROVED');
  const completedId = await getStatusId('COMPLETED');
  return MedicalExamRegistration.findAll({
    where: {
      medical_exam_id: examId,
      status_id: { [Op.in]: [approvedId, completedId] },
    },
    include: [{ model: User, include: [Sex] }],
    order: [
      [User, 'last_name', 'ASC'],
      [User, 'first_name', 'ASC'],
      [User, 'patronymic', 'ASC'],
    ],
  });
}

function formatPhone(digits) {
  if (!digits) return '';
  let out = '+7';
  if (digits.length > 1) out += ' (' + digits.slice(1, 4);
  if (digits.length >= 4) out += ') ';
  if (digits.length >= 4) out += digits.slice(4, 7);
  if (digits.length >= 7) out += '-' + digits.slice(7, 9);
  if (digits.length >= 9) out += '-' + digits.slice(9, 11);
  return out;
}

function formatDate(str) {
  if (!str) return '';
  const [year, month, day] = str.split('-');
  return `${day}.${month}.${year}`;
}

async function exportApprovedPdf(examId) {
  const regs = await listApproved(examId);
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  const { regular, bold } = applyFonts(doc);

  doc
    .font(bold)
    .fontSize(16)
    .text('Подтверждённые заявки', { align: 'center' });
  doc.moveDown();

  const table = {
    headers: [
      { label: 'Фамилия', property: 'last', width: 90 },
      { label: 'Имя', property: 'first', width: 80 },
      { label: 'Отчество', property: 'patronymic', width: 90 },
      { label: 'Пол', property: 'sex', width: 50 },
      { label: 'Дата рождения', property: 'birth', width: 70 },
      { label: 'Email', property: 'email', width: 150 },
      { label: 'Телефон', property: 'phone', width: 90 },
    ],
    datas: regs.map((r) => ({
      last: r.User.last_name,
      first: r.User.first_name,
      patronymic: r.User.patronymic || '',
      sex: r.User.Sex ? r.User.Sex.name : '',
      birth: formatDate(r.User.birth_date),
      email: r.User.email,
      phone: formatPhone(r.User.phone),
    })),
  };

  await doc.table(table, {
    prepareHeader: () => doc.font(bold).fontSize(10),
    prepareRow: () => doc.font(regular).fontSize(10),
    columnSpacing: 5,
    padding: 4,
  });

  const chunks = [];
  return new Promise((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

export default {
  listByExam,
  listAvailable,
  listUpcomingByUser,
  register,
  unregister,
  setStatus,
  remove,
  exportApprovedPdf,
};
