import { DataTypes, Model, QueryTypes } from 'sequelize';

import sequelize from '../config/database.js';

class Document extends Model {}

Document.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    recipient_id: { type: DataTypes.UUID, allowNull: false },
    document_type_id: { type: DataTypes.UUID, allowNull: false },
    status_id: { type: DataTypes.UUID, allowNull: false },
    file_id: { type: DataTypes.UUID, allowNull: false },
    sign_type_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT },
    document_date: { type: DataTypes.DATE, allowNull: false },
    number: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'Document',
    tableName: 'documents',
    paranoid: true,
    underscored: true,
  }
);

Document.addHook('beforeValidate', async (doc) => {
  if (doc.number) return;
  const [{ nextval }] = await sequelize.query(
    // eslint-disable-next-line quotes
    "SELECT nextval('documents_number_seq') AS nextval",
    { type: QueryTypes.SELECT }
  );
  const date = doc.document_date || new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  doc.number = `${yy}.${mm}/${nextval}`;
});

// Keep user signature type in sync when agreement gets signed
Document.addHook('afterUpdate', async (doc, options) => {
  try {
    // Only react on status change
    const prev = doc.previous('status_id');
    if (!prev || prev === doc.status_id) return;

    const { DocumentStatus, DocumentType, SignType, UserSignType } =
      sequelize.models;

    // Load aliases within the same transaction if present
    const tx = options?.transaction;
    const [status, type] = await Promise.all([
      DocumentStatus.findByPk(doc.status_id, {
        attributes: ['alias'],
        transaction: tx,
      }),
      DocumentType.findByPk(doc.document_type_id, {
        attributes: ['alias'],
        transaction: tx,
      }),
    ]);
    if (status?.alias !== 'SIGNED') return;
    if (type?.alias !== 'ELECTRONIC_INTERACTION_AGREEMENT') return;

    const simple = await SignType.findOne({
      where: { alias: 'SIMPLE_ELECTRONIC' },
      attributes: ['id'],
      transaction: tx,
    });
    if (!simple) return;

    // If already set to SIMPLE_ELECTRONIC, skip; otherwise replace
    const existing = await UserSignType.findOne({
      where: { user_id: doc.recipient_id, sign_type_id: simple.id },
      transaction: tx,
    });
    if (existing) return;

    await UserSignType.destroy({
      where: { user_id: doc.recipient_id },
      transaction: tx,
    });
    await UserSignType.create(
      {
        user_id: doc.recipient_id,
        sign_type_id: simple.id,
        sign_created_date: new Date(),
        created_by: doc.updated_by || null,
        updated_by: doc.updated_by || null,
      },
      { transaction: tx }
    );
  } catch (e) {
    // Don’t block the main flow on sync issues; log if logger is available
     
    console.error('Document.afterUpdate hook failed:', e);
  }
});

export default Document;
