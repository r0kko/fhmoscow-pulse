import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class UserAvailability extends Model {}

UserAvailability.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    type_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    from_time: { type: DataTypes.TIME },
    to_time: { type: DataTypes.TIME },
  },
  {
    sequelize,
    modelName: 'UserAvailability',
    tableName: 'user_availabilities',
    paranoid: true,
    underscored: true,
  }
);

export default UserAvailability;
