import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class RefereeGroupUser extends Model {}

RefereeGroupUser.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
  },
  {
    sequelize,
    modelName: 'RefereeGroupUser',
    tableName: 'referee_group_users',
    paranoid: true,
    underscored: true,
    indexes: [{ unique: true, fields: ['user_id'] }],
  }
);

export default RefereeGroupUser;
