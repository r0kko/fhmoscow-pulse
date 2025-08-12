import { Op } from 'sequelize';
import PDFDocument from 'pdfkit';

import {
  Document,
  DocumentType,
  SignType,
  File,
  DocumentUserSign,
  UserSignType,
  DocumentStatus,
  User,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

import fileService from './fileService.js';
import emailService from './emailService.js';

async function create(data, userId) {
  let statusId = data.statusId;
  if (!statusId) {
    const status = await DocumentStatus.findOne({
      where: { alias: 'CREATED' },
      attributes: ['id'],
    });
    if (!status) {
      throw new ServiceError('document_status_not_found', 500);
    }
    statusId = status.id;
  }
  const doc = await Document.create({
    recipient_id: data.recipientId,
    document_type_id: data.documentTypeId,
    status_id: statusId,
    file_id: data.fileId,
    sign_type_id: data.signTypeId,
    name: data.name,
    description: data.description,
    document_date: data.documentDate || new Date(),
    created_by: userId,
    updated_by: userId,
  });
  return doc;
}

async function listByUser(userId) {
  const docs = await Document.findAll({
    where: { recipient_id: userId },
    include: [
      { model: DocumentType, attributes: ['name', 'alias'] },
      { model: SignType, attributes: ['name', 'alias'] },
      { model: File, attributes: ['id', 'key'] },
      { model: DocumentStatus, attributes: ['name', 'alias'] },
      {
        model: DocumentUserSign,
        attributes: ['id', 'user_id', 'created_at'],
        required: false,
      },
    ],
    order: [['created_at', 'DESC']],
  });
  return Promise.all(
    docs.map(async (d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      documentDate: d.document_date,
      documentType: d.DocumentType
        ? { name: d.DocumentType.name, alias: d.DocumentType.alias }
        : null,
      signType: d.SignType
        ? { name: d.SignType.name, alias: d.SignType.alias }
        : null,
      status: d.DocumentStatus
        ? { name: d.DocumentStatus.name, alias: d.DocumentStatus.alias }
        : null,
      file: d.File
        ? {
            id: d.File.id,
            url: await fileService.getDownloadUrl(d.File),
          }
        : null,
      signs: d.DocumentUserSigns.map((s) => ({
        id: s.id,
        userId: s.user_id,
        createdAt: s.created_at,
      })),
    }))
  );
}

async function listAll() {
  const docs = await Document.findAll({
    include: [
      { model: DocumentType, attributes: ['name', 'alias'] },
      { model: SignType, attributes: ['name', 'alias'] },
      {
        model: User,
        as: 'recipient',
        attributes: ['last_name', 'first_name', 'patronymic'],
      },
      { model: DocumentStatus, attributes: ['name', 'alias'] },
    ],
    order: [['created_at', 'DESC']],
  });
  return docs.map((d) => ({
    id: d.id,
    name: d.name,
    documentDate: d.document_date,
    documentType: d.DocumentType
      ? { name: d.DocumentType.name, alias: d.DocumentType.alias }
      : null,
    signType: d.SignType
      ? { name: d.SignType.name, alias: d.SignType.alias }
      : null,
    recipient: {
      lastName: d.recipient.last_name,
      firstName: d.recipient.first_name,
      patronymic: d.recipient.patronymic,
    },
    status: d.DocumentStatus
      ? { name: d.DocumentStatus.name, alias: d.DocumentStatus.alias }
      : null,
    createdAt: d.created_at,
  }));
}

async function sign(user, documentId) {
  const doc = await Document.findByPk(documentId);
  if (!doc) {
    throw new ServiceError('document_not_found', 404);
  }
  const count = await DocumentUserSign.count({
    where: { document_id: documentId, deleted_at: { [Op.is]: null } },
  });
  if (count >= 2) {
    throw new ServiceError('document_sign_limit', 400);
  }
  const existing = await DocumentUserSign.findOne({
    where: { document_id: documentId, user_id: user.id },
  });
  if (existing) {
    throw new ServiceError('document_already_signed', 400);
  }
  const userSign = await UserSignType.findOne({ where: { user_id: user.id } });
  if (!userSign || userSign.sign_type_id !== doc.sign_type_id) {
    throw new ServiceError('sign_type_mismatch', 400);
  }
  await DocumentUserSign.create({
    document_id: documentId,
    user_id: user.id,
    sign_type_id: userSign.sign_type_id,
    created_by: user.id,
    updated_by: user.id,
  });
  const signedStatus = await DocumentStatus.findOne({
    where: { alias: 'SIGNED' },
    attributes: ['id'],
  });
  if (signedStatus) {
    await doc.update({ status_id: signedStatus.id, updated_by: user.id });
  }
}

async function requestSignature(documentId, actorId) {
  const doc = await Document.findByPk(documentId, {
    include: [
      { model: SignType, attributes: ['alias', 'name'] },
      {
        model: User,
        as: 'recipient',
        attributes: ['email', 'last_name', 'first_name', 'patronymic'],
      },
      { model: DocumentStatus, attributes: ['alias'] },
    ],
  });
  if (!doc) {
    throw new ServiceError('document_not_found', 404);
  }
  if (
    !doc.SignType ||
    !['HANDWRITTEN', 'KONTUR_SIGN'].includes(doc.SignType.alias)
  ) {
    throw new ServiceError('document_sign_type_invalid', 400);
  }
  if (doc.DocumentStatus?.alias !== 'CREATED') {
    throw new ServiceError('document_status_invalid', 400);
  }
  const status = await DocumentStatus.findOne({
    where: { alias: 'AWAITING_SIGNATURE' },
    attributes: ['id', 'name', 'alias'],
  });
  if (!status) {
    throw new ServiceError('document_status_not_found', 500);
  }
  await doc.update({ status_id: status.id, updated_by: actorId });
  if (doc.recipient?.email) {
    await emailService.sendDocumentAwaitingSignatureEmail(doc.recipient, doc);
  }
  return { name: status.name, alias: status.alias };
}

function createPdfBuffer(text) {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const chunks = [];
    doc.on('data', (d) => chunks.push(d));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.text(text);
    doc.end();
  });
}

async function generateInitial(user, signTypeId) {
  const [consentType, agreementType, status] = await Promise.all([
    DocumentType.findOne({
      where: { alias: 'PERSONAL_DATA_CONSENT' },
      attributes: ['id', 'name'],
    }),
    DocumentType.findOne({
      where: { alias: 'ELECTRONIC_INTERACTION_AGREEMENT' },
      attributes: ['id', 'name'],
    }),
    DocumentStatus.findOne({ where: { alias: 'CREATED' }, attributes: ['id'] }),
  ]);
  if (!consentType || !agreementType || !status) return;
  const exists = await Document.findOne({
    where: { recipient_id: user.id, document_type_id: consentType.id },
  });
  if (!exists) {
    const pdf = await createPdfBuffer(consentType.name);
    const file = await fileService.saveGeneratedPdf(
      pdf,
      `${consentType.name}.pdf`,
      user.id
    );
    await Document.create({
      recipient_id: user.id,
      document_type_id: consentType.id,
      status_id: status.id,
      file_id: file.id,
      sign_type_id: signTypeId,
      name: consentType.name,
      document_date: new Date(),
      created_by: user.id,
      updated_by: user.id,
    });
  }
  const existsAgreement = await Document.findOne({
    where: { recipient_id: user.id, document_type_id: agreementType.id },
  });
  if (!existsAgreement) {
    const pdf = await createPdfBuffer(agreementType.name);
    const file = await fileService.saveGeneratedPdf(
      pdf,
      `${agreementType.name}.pdf`,
      user.id
    );
    await Document.create({
      recipient_id: user.id,
      document_type_id: agreementType.id,
      status_id: status.id,
      file_id: file.id,
      sign_type_id: signTypeId,
      name: agreementType.name,
      document_date: new Date(),
      created_by: user.id,
      updated_by: user.id,
    });
  }
}

export default {
  create,
  listByUser,
  listAll,
  sign,
  requestSignature,
  generateInitial,
};
