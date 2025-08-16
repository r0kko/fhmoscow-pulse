import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class PlayerStatistic extends Model {}

PlayerStatistic.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    season_id: { type: DataTypes.INTEGER },
    tournament_id: { type: DataTypes.INTEGER },
    team_id: { type: DataTypes.INTEGER },
    player_id: { type: DataTypes.INTEGER },
    game_id: { type: DataTypes.INTEGER },
    goal: { type: DataTypes.INTEGER },
    assist: { type: DataTypes.INTEGER },
    goal_pass: { type: DataTypes.INTEGER },
    penalty: { type: DataTypes.INTEGER },
    missed: { type: DataTypes.INTEGER },
    time: { type: DataTypes.DOUBLE },
    reliability_factor: { type: DataTypes.DOUBLE },
    game_time_percent: { type: DataTypes.INTEGER },
    is_started: { type: DataTypes.BOOLEAN },
  },
  {
    sequelize,
    modelName: 'PlayerStatistic',
    tableName: 'player_statistic',
    timestamps: false,
  }
);

PlayerStatistic.associate = ({ Game, Player, Season, Team, Tournament }) => {
  PlayerStatistic.belongsTo(Game, { foreignKey: 'game_id' });
  PlayerStatistic.belongsTo(Player, { foreignKey: 'player_id' });
  PlayerStatistic.belongsTo(Season, { foreignKey: 'season_id' });
  PlayerStatistic.belongsTo(Team, { foreignKey: 'team_id' });
  PlayerStatistic.belongsTo(Tournament, { foreignKey: 'tournament_id' });
};

export default PlayerStatistic;
