import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class GamePeriod extends Model {}

GamePeriod.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'GamePeriod',
    tableName: 'game_period',
    timestamps: false,
  }
);

export default GamePeriod;
