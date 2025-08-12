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

Document.addHook('beforeCreate', async (doc) => {
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

export default Document;
