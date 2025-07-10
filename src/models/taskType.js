import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class TaskType extends Model {}

TaskType.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    alias: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'TaskType',
    tableName: 'task_types',
    paranoid: true,
    underscored: true,
  }
);

export default TaskType;
