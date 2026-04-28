import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class MatchProtocolExportItem extends Model {}

MatchProtocolExportItem.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    job_id: { type: DataTypes.UUID, allowNull: false },
    match_id: { type: DataTypes.UUID, allowNull: false },
    external_match_id: { type: DataTypes.INTEGER, allowNull: true },
    filename: { type: DataTypes.STRING(255), allowNull: true },
    highlighted_external_player_ids: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'QUEUED',
    },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    error_code: { type: DataTypes.STRING(128), allowNull: true },
    error_message: { type: DataTypes.TEXT, allowNull: true },
    started_at: { type: DataTypes.DATE, allowNull: true },
    finished_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'MatchProtocolExportItem',
    tableName: 'match_protocol_export_items',
    paranoid: true,
    underscored: true,
    indexes: [
      { fields: ['job_id'] },
      { fields: ['match_id'] },
      { fields: ['status'] },
      { fields: ['external_match_id'] },
    ],
  }
);

export default MatchProtocolExportItem;
