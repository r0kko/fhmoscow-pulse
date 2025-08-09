import { DataTypes, Model } from 'sequelize';

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
  },
  {
    sequelize,
    modelName: 'Document',
    tableName: 'documents',
    paranoid: true,
    underscored: true,
  }
);

export default Document;
