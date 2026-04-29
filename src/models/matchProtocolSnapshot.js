import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class MatchProtocolSnapshot extends Model {}

MatchProtocolSnapshot.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    match_id: { type: DataTypes.UUID, allowNull: false },
    external_match_id: { type: DataTypes.INTEGER, allowNull: false },
    document_date: { type: DataTypes.DATE, allowNull: false },
    number: { type: DataTypes.STRING(32), allowNull: false, unique: true },
    upstream_etag: { type: DataTypes.STRING(255) },
    upstream_last_modified: { type: DataTypes.DATE },
    upstream_filename: { type: DataTypes.STRING(255) },
    signed_file_id: { type: DataTypes.UUID, allowNull: false },
    document_id: { type: DataTypes.UUID },
    signed_by_user_id: { type: DataTypes.UUID, allowNull: false },
    signed_role_alias: { type: DataTypes.STRING(64), allowNull: false },
    signed_at: { type: DataTypes.DATE, allowNull: false },
    render_version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    seal_asset_hash: { type: DataTypes.STRING(128), allowNull: false },
    last_checked_at: { type: DataTypes.DATE, allowNull: false },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
  },
  {
    sequelize,
    modelName: 'MatchProtocolSnapshot',
    tableName: 'match_protocol_snapshots',
    paranoid: true,
    underscored: true,
    indexes: [
      {
        fields: ['match_id', 'status', 'signed_at'],
        name: 'idx_match_protocol_snapshots_match_status_signed',
      },
      {
        fields: ['external_match_id', 'status'],
        name: 'idx_match_protocol_snapshots_external_match_status',
      },
      {
        fields: ['document_id'],
        name: 'idx_match_protocol_snapshots_document_id',
      },
      {
        unique: true,
        fields: ['match_id'],
        where: { status: 'ACTIVE', deleted_at: null },
        name: 'uq_match_protocol_snapshots_match_active',
      },
    ],
  }
);

export default MatchProtocolSnapshot;
