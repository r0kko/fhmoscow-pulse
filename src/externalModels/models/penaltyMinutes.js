import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class PenaltyMinutes extends Model {}

PenaltyMinutes.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'PenaltyMinutes',
    tableName: 'penalty_minutes',
    timestamps: false,
  }
);

PenaltyMinutes.associate = ({ GameEvent }) => {
  if (GameEvent) PenaltyMinutes.hasMany(GameEvent, { foreignKey: 'penalty_minutes_id' });
};

export default PenaltyMinutes;
