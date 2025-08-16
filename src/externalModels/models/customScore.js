import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class CustomScore extends Model {}

CustomScore.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    season_id: { type: DataTypes.INTEGER },
    tournament_id: { type: DataTypes.INTEGER },
    tournament_group_id: { type: DataTypes.INTEGER },
    team_id: { type: DataTypes.INTEGER },
    custom_score: { type: DataTypes.INTEGER },
    moscow_standings: { type: DataTypes.BOOLEAN },
  },
  {
    sequelize,
    modelName: 'CustomScore',
    tableName: 'custom_score',
    timestamps: false,
  }
);

CustomScore.associate = ({ Season, Tournament, TournamentGroup, Team }) => {
  CustomScore.belongsTo(Season, { foreignKey: 'season_id' });
  CustomScore.belongsTo(Tournament, { foreignKey: 'tournament_id' });
  CustomScore.belongsTo(TournamentGroup, { foreignKey: 'tournament_group_id' });
  CustomScore.belongsTo(Team, { foreignKey: 'team_id' });
};

export default CustomScore;
