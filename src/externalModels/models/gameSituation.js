import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class GameSituation extends Model {}

GameSituation.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'GameSituation',
    tableName: 'game_situation',
    timestamps: false,
  }
);

GameSituation.associate = ({ GameEvent }) => {
  if (GameEvent) GameSituation.hasMany(GameEvent, { foreignKey: 'goal_situation_id' });
};

export default GameSituation;
