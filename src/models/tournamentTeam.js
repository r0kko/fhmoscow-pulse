import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class TournamentTeam extends Model {}

TournamentTeam.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    tournament_id: { type: DataTypes.UUID },
    tournament_group_id: { type: DataTypes.UUID },
    team_id: { type: DataTypes.UUID },
  },
  {
    sequelize,
    modelName: 'TournamentTeam',
    tableName: 'tournament_teams',
    paranoid: true,
    underscored: true,
  }
);

export default TournamentTeam;
