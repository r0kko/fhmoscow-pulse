import { Op } from 'sequelize';

import {
  Document,
  DocumentType,
  SignType,
  File,
  DocumentUserSign,
  UserSignType,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

async function create(data, userId) {
  const doc = await Document.create({
    recipient_id: data.recipientId,
    document_type_id: data.documentTypeId,
    file_id: data.fileId,
    sign_type_id: data.signTypeId,
    name: data.name,
    description: data.description,
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
      { model: File, attributes: ['id', 'path'] },
      {
        model: DocumentUserSign,
        attributes: ['id', 'user_id', 'created_at'],
        required: false,
      },
    ],
    order: [['created_at', 'DESC']],
  });
  return docs.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    documentType: d.DocumentType
      ? { name: d.DocumentType.name, alias: d.DocumentType.alias }
      : null,
    signType: d.SignType
      ? { name: d.SignType.name, alias: d.SignType.alias }
      : null,
    file: d.File ? { id: d.File.id, path: d.File.path } : null,
    signs: d.DocumentUserSigns.map((s) => ({
      id: s.id,
      userId: s.user_id,
      createdAt: s.created_at,
    })),
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
}

export default { create, listByUser, sign };
