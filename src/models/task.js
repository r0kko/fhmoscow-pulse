import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Task extends Model {}

Task.init(
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
    type_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT },
  },
  {
    sequelize,
    modelName: 'Task',
    tableName: 'tasks',
    paranoid: true,
    underscored: true,
  }
);

export default Task;
