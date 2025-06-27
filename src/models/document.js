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
    document_type_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    alias: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    file_path: { type: DataTypes.STRING(255) },
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
