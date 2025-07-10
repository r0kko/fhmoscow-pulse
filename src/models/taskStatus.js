import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class TaskStatus extends Model {}

TaskStatus.init(
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
    modelName: 'TaskStatus',
    tableName: 'task_statuses',
    paranoid: true,
    underscored: true,
  }
);

export default TaskStatus;
