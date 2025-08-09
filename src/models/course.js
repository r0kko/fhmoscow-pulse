import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Course extends Model {}

Course.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT },
    responsible_id: { type: DataTypes.UUID, allowNull: false },
    telegram_url: { type: DataTypes.STRING(500) },
  },
  {
    sequelize,
    modelName: 'Course',
    tableName: 'courses',
    paranoid: true,
    underscored: true,
  }
);

export default Course;
