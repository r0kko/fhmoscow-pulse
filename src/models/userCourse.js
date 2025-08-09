import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class UserCourse extends Model {}

UserCourse.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
  },
  {
    sequelize,
    modelName: 'UserCourse',
    tableName: 'user_courses',
    paranoid: true,
    underscored: true,
    indexes: [{ unique: true, fields: ['user_id'] }],
  }
);

export default UserCourse;
