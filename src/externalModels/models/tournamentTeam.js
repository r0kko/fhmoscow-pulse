import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class TournamentTeam extends Model {}

TournamentTeam.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    tournament_id: { type: DataTypes.INTEGER },
    tournament_group_id: { type: DataTypes.INTEGER },
    team_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'TournamentTeam',
    tableName: 'tournament_team',
    timestamps: false,
  }
);

TournamentTeam.associate = ({ TournamentGroup, Team, Tournament }) => {
  TournamentTeam.belongsTo(TournamentGroup, { foreignKey: 'tournament_group_id' });
  TournamentTeam.belongsTo(Team, { foreignKey: 'team_id' });
  TournamentTeam.belongsTo(Tournament, { foreignKey: 'tournament_id' });
};

export default TournamentTeam;
