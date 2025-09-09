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
    // Final score imported from external system (if available)
    score_team1: { type: DataTypes.INTEGER, allowNull: true },
    score_team2: { type: DataTypes.INTEGER, allowNull: true },
    schedule_locked_by_admin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // Admin lock switch; event log captures author and timestamp
    // Moscow date-only snapshot of the first known kickoff date
    scheduled_date: { type: DataTypes.DATEONLY, allowNull: true },
    // Local game status reference (SCHEDULED, POSTPONED, CANCELLED, LIVE, FINISHED)
    game_status_id: { type: DataTypes.UUID, allowNull: true },
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
