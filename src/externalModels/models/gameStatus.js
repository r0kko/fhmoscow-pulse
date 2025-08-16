import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class GameStatus extends Model {}

GameStatus.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'GameStatus',
    tableName: 'game_status',
    timestamps: false,
  }
);

export default GameStatus;
