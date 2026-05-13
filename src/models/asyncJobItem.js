import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class AsyncJobItem extends Model {}

AsyncJobItem.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    job_id: { type: DataTypes.UUID, allowNull: false },
    item_type: { type: DataTypes.STRING(64), allowNull: false },
    target_type: { type: DataTypes.STRING(64), allowNull: true },
    target_id: { type: DataTypes.UUID, allowNull: true },
    target_ref_json: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    payload_json: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    result_json: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'QUEUED',
    },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    max_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
    },
    next_attempt_at: { type: DataTypes.DATE, allowNull: true },
    locked_by: { type: DataTypes.STRING(128), allowNull: true },
    locked_at: { type: DataTypes.DATE, allowNull: true },
    lock_expires_at: { type: DataTypes.DATE, allowNull: true },
    error_code: { type: DataTypes.STRING(128), allowNull: true },
    error_message: { type: DataTypes.TEXT, allowNull: true },
    started_at: { type: DataTypes.DATE, allowNull: true },
    finished_at: { type: DataTypes.DATE, allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'AsyncJobItem',
    tableName: 'async_job_items',
    paranoid: true,
    underscored: true,
    indexes: [
      { fields: ['job_id', 'status', 'next_attempt_at'] },
      { fields: ['target_type', 'target_id'] },
    ],
  }
);

export default AsyncJobItem;
