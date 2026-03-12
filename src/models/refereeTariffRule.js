import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class RefereeTariffRule extends Model {}

RefereeTariffRule.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    tournament_id: { type: DataTypes.UUID, allowNull: false },
    stage_group_id: { type: DataTypes.UUID, allowNull: false },
    referee_role_id: { type: DataTypes.UUID, allowNull: false },
    fare_code: { type: DataTypes.STRING(8), allowNull: false },
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
    travel_mode: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'ARENA_FIXED',
    },
    valid_from: { type: DataTypes.DATEONLY, allowNull: false },
    valid_to: { type: DataTypes.DATEONLY, allowNull: true },
    tariff_status_id: { type: DataTypes.UUID, allowNull: false },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    filed_by: { type: DataTypes.UUID, allowNull: true },
    approved_by: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'RefereeTariffRule',
    tableName: 'referee_tariff_rules',
    paranoid: true,
    underscored: true,
  }
);

export default RefereeTariffRule;
