import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class GameReferee extends Model {}

GameReferee.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    referee_id: { type: DataTypes.INTEGER },
    game_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'GameReferee',
    tableName: 'game_referee',
    timestamps: false,
  }
);

GameReferee.associate = ({ Game, Referee }) => {
  GameReferee.belongsTo(Game, { foreignKey: 'game_id' });
  GameReferee.belongsTo(Referee, { foreignKey: 'referee_id' });
};

export default GameReferee;
