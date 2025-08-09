import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class DocumentUserSign extends Model {}

DocumentUserSign.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    document_id: { type: DataTypes.UUID, allowNull: false },
    user_id: { type: DataTypes.UUID, allowNull: false },
    sign_type_id: { type: DataTypes.UUID, allowNull: false },
  },
  {
    sequelize,
    modelName: 'DocumentUserSign',
    tableName: 'document_user_signs',
    paranoid: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['document_id', 'user_id'],
        where: { deleted_at: null },
        name: 'uq_document_user_signs_doc_user_not_deleted',
      },
    ],
  }
);

export default DocumentUserSign;
