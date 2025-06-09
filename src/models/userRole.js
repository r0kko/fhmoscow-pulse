import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class UserRole extends Model {}

UserRole.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
  },
  {
    sequelize,
    modelName: 'UserRole',
    tableName: 'user_roles',
    paranoid: true,
    underscored: true,
    indexes: [{ unique: true, fields: ['user_id', 'role_id'] }],
  }
);

export default UserRole;
