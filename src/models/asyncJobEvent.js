import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class AsyncJobEvent extends Model {}

AsyncJobEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    job_id: { type: DataTypes.UUID, allowNull: false },
    item_id: { type: DataTypes.UUID, allowNull: true },
    event_type: { type: DataTypes.STRING(64), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: true },
    meta_json: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'AsyncJobEvent',
    tableName: 'async_job_events',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [{ fields: ['job_id', 'created_at'] }, { fields: ['item_id'] }],
  }
);

export default AsyncJobEvent;
