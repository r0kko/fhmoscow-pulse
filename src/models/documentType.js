import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class DocumentType extends Model {}

DocumentType.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    alias: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    generated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'DocumentType',
    tableName: 'document_types',
    paranoid: true,
    underscored: true,
  }
);

export default DocumentType;
