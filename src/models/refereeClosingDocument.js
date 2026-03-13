import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class RefereeClosingDocument extends Model {}

RefereeClosingDocument.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    tournament_id: { type: DataTypes.UUID, allowNull: false },
    referee_id: { type: DataTypes.UUID, allowNull: false },
    document_id: { type: DataTypes.UUID, allowNull: false, unique: true },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'DRAFT',
    },
    customer_snapshot_json: { type: DataTypes.JSONB, allowNull: false },
    performer_snapshot_json: { type: DataTypes.JSONB, allowNull: false },
    contract_snapshot_json: { type: DataTypes.JSONB, allowNull: true },
    fhmo_signer_snapshot_json: { type: DataTypes.JSONB, allowNull: true },
    totals_json: { type: DataTypes.JSONB, allowNull: false },
    sent_at: { type: DataTypes.DATE, allowNull: true },
    posted_at: { type: DataTypes.DATE, allowNull: true },
    canceled_at: { type: DataTypes.DATE, allowNull: true },
    deleted_by: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'RefereeClosingDocument',
    tableName: 'referee_closing_documents',
    paranoid: true,
    underscored: true,
  }
);

export default RefereeClosingDocument;
