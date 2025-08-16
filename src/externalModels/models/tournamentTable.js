import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class TournamentTable extends Model {}

TournamentTable.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    season_id: { type: DataTypes.INTEGER },
    tournament_id: { type: DataTypes.INTEGER },
    tournament_group_id: { type: DataTypes.INTEGER },
    game_count: { type: DataTypes.INTEGER },
    win_count: { type: DataTypes.INTEGER },
    tie_count: { type: DataTypes.INTEGER },
    loss_count: { type: DataTypes.INTEGER },
    pucks_scored: { type: DataTypes.INTEGER },
    pucks_missed: { type: DataTypes.INTEGER },
    pucks_difference: { type: DataTypes.DOUBLE },
    score: { type: DataTypes.INTEGER },
    position: { type: DataTypes.INTEGER },
    team_id: { type: DataTypes.INTEGER },
    win_overtime_count: { type: DataTypes.INTEGER },
    lose_overtime_count: { type: DataTypes.INTEGER },
    moscow_standings: { type: DataTypes.BOOLEAN },
  },
  {
    sequelize,
    modelName: 'TournamentTable',
    tableName: 'tournament_table',
    timestamps: false,
  }
);

TournamentTable.associate = ({ TournamentGroup, Season, Team, Tournament }) => {
  TournamentTable.belongsTo(TournamentGroup, {
    foreignKey: 'tournament_group_id',
  });
  TournamentTable.belongsTo(Season, { foreignKey: 'season_id' });
  TournamentTable.belongsTo(Team, { foreignKey: 'team_id' });
  TournamentTable.belongsTo(Tournament, { foreignKey: 'tournament_id' });
};

export default TournamentTable;
