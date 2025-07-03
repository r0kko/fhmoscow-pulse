import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class JudgeGroupUser extends Model {}

JudgeGroupUser.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
  },
  {
    sequelize,
    modelName: 'JudgeGroupUser',
    tableName: 'judge_group_users',
    paranoid: true,
    underscored: true,
    indexes: [{ unique: true, fields: ['user_id'] }],
  }
);

export default JudgeGroupUser;
