import {
  User,
  Document,
  DocumentType,
  DocumentStatus,
  UserDocument,
} from '../models/index.js';

async function listByUser(userId) {
  return UserDocument.findAll({
    where: { user_id: userId },
    include: [
      { model: Document, include: [DocumentType] },
      DocumentStatus,
    ],
  });
}

async function createForUser(userId, alias, data, actorId) {
  const [user, doc, status] = await Promise.all([
    User.findByPk(userId),
    Document.findOne({ where: { alias } }),
    DocumentStatus.findOne({ where: { alias: 'ACTIVE' } }),
  ]);
  if (!user) throw new Error('user_not_found');
  if (!doc) throw new Error('document_not_found');
  if (!status) throw new Error('status_not_found');
  const existing = await UserDocument.findOne({
    where: { user_id: userId, document_id: doc.id },
  });
  if (existing) throw new Error('user_document_exists');
  return UserDocument.create({
    user_id: userId,
    document_id: doc.id,
    status_id: status.id,
    signing_date: data.signing_date,
    valid_until: data.valid_until,
    created_by: actorId,
    updated_by: actorId,
  });
}

async function remove(id) {
  const record = await UserDocument.findByPk(id);
  if (!record) throw new Error('user_document_not_found');
  await record.destroy();
}

export default {
  listByUser,
  createForUser,
  remove,
};
