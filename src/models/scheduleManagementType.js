import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class ScheduleManagementType extends Model {}

ScheduleManagementType.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    alias: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
  },
  {
    sequelize,
    modelName: 'ScheduleManagementType',
    tableName: 'schedule_management_types',
    paranoid: true,
    underscored: true,
  }
);

export default ScheduleManagementType;
