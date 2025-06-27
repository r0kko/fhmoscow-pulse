import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class UserDocument extends Model {}

UserDocument.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: { type: DataTypes.UUID, allowNull: false },
    document_id: { type: DataTypes.UUID, allowNull: false },
    status_id: { type: DataTypes.UUID, allowNull: false },
    signing_date: { type: DataTypes.DATE, allowNull: false },
    valid_until: { type: DataTypes.DATE },
  },
  {
    sequelize,
    modelName: 'UserDocument',
    tableName: 'user_documents',
    paranoid: true,
    underscored: true,
  }
);

export default UserDocument;
