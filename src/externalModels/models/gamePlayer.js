import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class GamePlayer extends Model {}

GamePlayer.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    player_id: { type: DataTypes.INTEGER },
    game_id: { type: DataTypes.INTEGER },
    position_id: { type: DataTypes.INTEGER },
    role_id: { type: DataTypes.INTEGER },
    team_id: { type: DataTypes.INTEGER },
    number: { type: DataTypes.INTEGER },
    lineup_number: { type: DataTypes.INTEGER },
    played: { type: DataTypes.BOOLEAN },
    played_in_lineup: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'GamePlayer',
    tableName: 'game_player',
    timestamps: false,
  }
);

GamePlayer.associate = ({
  Game,
  Player,
  PlayerPosition,
  Team,
  TeamPlayerRole,
}) => {
  GamePlayer.belongsTo(Game, { foreignKey: 'game_id' });
  GamePlayer.belongsTo(Player, { foreignKey: 'player_id' });
  GamePlayer.belongsTo(PlayerPosition, { foreignKey: 'position_id' });
  GamePlayer.belongsTo(Team, { foreignKey: 'team_id' });
  GamePlayer.belongsTo(TeamPlayerRole, { foreignKey: 'role_id' });
};

export default GamePlayer;
