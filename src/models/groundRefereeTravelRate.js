import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class GroundRefereeTravelRate extends Model {}

GroundRefereeTravelRate.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ground_id: { type: DataTypes.UUID, allowNull: false },
    rate_code: { type: DataTypes.STRING(16), allowNull: true },
    travel_amount_rub: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: '0.00',
    },
    valid_from: { type: DataTypes.DATEONLY, allowNull: false },
    valid_to: { type: DataTypes.DATEONLY, allowNull: true },
    travel_rate_status_id: { type: DataTypes.UUID, allowNull: false },
  },
  {
    sequelize,
    modelName: 'GroundRefereeTravelRate',
    tableName: 'ground_referee_travel_rates',
    paranoid: true,
    underscored: true,
  }
);

export default GroundRefereeTravelRate;
