import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class JobLog extends Model {}

JobLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    job: { type: DataTypes.STRING(100), allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false },
    started_at: { type: DataTypes.DATE, allowNull: false },
    finished_at: { type: DataTypes.DATE, allowNull: true },
    duration_ms: { type: DataTypes.INTEGER, allowNull: true },
    message: { type: DataTypes.TEXT, allowNull: true },
    error_message: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'JobLog',
    tableName: 'job_logs',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default JobLog;
