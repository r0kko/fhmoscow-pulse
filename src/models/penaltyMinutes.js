import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class PenaltyMinutes extends Model {}

PenaltyMinutes.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    name: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    sequelize,
    modelName: 'PenaltyMinutes',
    tableName: 'penalty_minutes',
    paranoid: true,
    underscored: true,
  }
);

export default PenaltyMinutes;
