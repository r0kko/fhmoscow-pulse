import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class RefereeAccrualDocument extends Model {}

RefereeAccrualDocument.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    accrual_number: { type: DataTypes.STRING(24), allowNull: false },
    tournament_id: { type: DataTypes.UUID, allowNull: false },
    match_id: { type: DataTypes.UUID, allowNull: false },
    match_referee_id: { type: DataTypes.UUID, allowNull: false },
    referee_id: { type: DataTypes.UUID, allowNull: false },
    referee_role_id: { type: DataTypes.UUID, allowNull: false },
    stage_group_id: { type: DataTypes.UUID, allowNull: false },
    ground_id: { type: DataTypes.UUID, allowNull: true },
    fare_code_snapshot: { type: DataTypes.STRING(8), allowNull: false },
    tariff_rule_id: { type: DataTypes.UUID, allowNull: true },
    travel_rate_id: { type: DataTypes.UUID, allowNull: true },
    match_date_snapshot: { type: DataTypes.DATEONLY, allowNull: false },
    base_amount_rub: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: '0.00',
    },
    meal_amount_rub: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: '0.00',
    },
    travel_amount_rub: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: '0.00',
    },
    total_amount_rub: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: '0.00',
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'RUB',
    },
    document_status_id: { type: DataTypes.UUID, allowNull: false },
    source_id: { type: DataTypes.UUID, allowNull: false },
    calc_fingerprint: { type: DataTypes.STRING(64), allowNull: false },
    original_document_id: { type: DataTypes.UUID, allowNull: true },
    reviewed_by: { type: DataTypes.UUID, allowNull: true },
    approved_by: { type: DataTypes.UUID, allowNull: true },
    posted_by: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'RefereeAccrualDocument',
    tableName: 'referee_accrual_documents',
    paranoid: true,
    underscored: true,
  }
);

export default RefereeAccrualDocument;
