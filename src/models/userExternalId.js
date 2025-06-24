import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class UserExternalId extends Model {}

UserExternalId.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: { type: DataTypes.UUID, allowNull: false },
    external_system_id: { type: DataTypes.UUID, allowNull: false },
    external_id: { type: DataTypes.STRING(50), allowNull: false },
  },
  {
    sequelize,
    modelName: 'UserExternalId',
    tableName: 'user_external_ids',
    paranoid: true,
    underscored: true,
  }
);

export default UserExternalId;
