import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class AsyncJob extends Model {}

AsyncJob.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    job_type: { type: DataTypes.STRING(64), allowNull: false },
    operation: { type: DataTypes.STRING(64), allowNull: false },
    queue: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: 'default',
    },
    scope_type: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: 'SYSTEM',
    },
    scope_id: { type: DataTypes.UUID, allowNull: true },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'QUEUED',
    },
    priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    payload_json: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    selection_json: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    result_json: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    dedupe_key: { type: DataTypes.STRING(128), allowNull: true },
    idempotency_key: { type: DataTypes.STRING(128), allowNull: true },
    requested_by_user_id: { type: DataTypes.UUID, allowNull: true },
    total_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    processed_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    success_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    skipped_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    failure_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    error_code: { type: DataTypes.STRING(128), allowNull: true },
    error_message: { type: DataTypes.TEXT, allowNull: true },
    locked_by: { type: DataTypes.STRING(128), allowNull: true },
    locked_at: { type: DataTypes.DATE, allowNull: true },
    lock_expires_at: { type: DataTypes.DATE, allowNull: true },
    scheduled_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    started_at: { type: DataTypes.DATE, allowNull: true },
    finished_at: { type: DataTypes.DATE, allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'AsyncJob',
    tableName: 'async_jobs',
    paranoid: true,
    underscored: true,
    indexes: [
      { fields: ['queue', 'status', 'scheduled_at', 'priority'] },
      { fields: ['scope_type', 'scope_id', 'status', 'created_at'] },
      { fields: ['job_type', 'operation'] },
      { fields: ['idempotency_key'] },
    ],
  }
);

export default AsyncJob;
