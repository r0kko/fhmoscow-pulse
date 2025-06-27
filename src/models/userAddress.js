import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class UserAddress extends Model {}

UserAddress.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: { type: DataTypes.UUID, allowNull: false },
    address_id: { type: DataTypes.UUID, allowNull: false },
    address_type_id: { type: DataTypes.UUID, allowNull: false },
  },
  {
    sequelize,
    modelName: 'UserAddress',
    tableName: 'user_addresses',
    paranoid: true,
    underscored: true,
  }
);

export default UserAddress;
