import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Match extends Model {}

Match.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    date_start: { type: DataTypes.DATE, allowNull: true },
    tournament_id: { type: DataTypes.UUID },
    stage_id: { type: DataTypes.UUID },
    tournament_group_id: { type: DataTypes.UUID },
    tour_id: { type: DataTypes.UUID },
    ground_id: { type: DataTypes.UUID },
    season_id: { type: DataTypes.UUID },
    team1_id: { type: DataTypes.UUID },
    team2_id: { type: DataTypes.UUID },
  },
  {
    sequelize,
    modelName: 'Match',
    tableName: 'matches',
    paranoid: true,
    underscored: true,
  }
);

export default Match;
