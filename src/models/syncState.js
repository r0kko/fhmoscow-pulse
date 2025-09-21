import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class SyncState extends Model {}

SyncState.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    job: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
    },
    last_cursor: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_mode: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    last_run_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_full_sync_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    meta: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'SyncState',
    tableName: 'sync_states',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default SyncState;
