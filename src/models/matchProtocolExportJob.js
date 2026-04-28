import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class MatchProtocolExportJob extends Model {}

MatchProtocolExportJob.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    team_id: { type: DataTypes.UUID, allowNull: false },
    season_id: { type: DataTypes.UUID, allowNull: false },
    requested_by_user_id: { type: DataTypes.UUID, allowNull: true },
    archive_file_id: { type: DataTypes.UUID, allowNull: true },
    fingerprint: { type: DataTypes.STRING(128), allowNull: false },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'QUEUED',
    },
    selected_player_ids: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    selected_external_player_ids: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    total_matches: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    processed_matches: {
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
    started_at: { type: DataTypes.DATE, allowNull: true },
    finished_at: { type: DataTypes.DATE, allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    modelName: 'MatchProtocolExportJob',
    tableName: 'match_protocol_export_jobs',
    paranoid: true,
    underscored: true,
    indexes: [
      { fields: ['team_id', 'season_id'] },
      { fields: ['requested_by_user_id'] },
      { fields: ['status'] },
      { fields: ['fingerprint'] },
      { fields: ['expires_at'] },
    ],
  }
);

export default MatchProtocolExportJob;
