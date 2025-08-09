import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class TrainingCourse extends Model {}

TrainingCourse.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
  },
  {
    sequelize,
    modelName: 'TrainingCourse',
    tableName: 'training_courses',
    paranoid: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['training_id', 'course_id'],
        where: { deleted_at: null },
      },
    ],
  }
);

export default TrainingCourse;
