import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class MatchParticipantPlayer extends Model {}

MatchParticipantPlayer.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    match_id: { type: DataTypes.UUID, allowNull: false },
    team_id: { type: DataTypes.UUID, allowNull: true },
    player_id: { type: DataTypes.UUID, allowNull: true },
    role_id: { type: DataTypes.UUID, allowNull: true },
    external_game_id: { type: DataTypes.INTEGER, allowNull: false },
    external_team_id: { type: DataTypes.INTEGER, allowNull: true },
    external_player_id: { type: DataTypes.INTEGER, allowNull: true },
    role_external_id: { type: DataTypes.INTEGER, allowNull: true },
    role_name: { type: DataTypes.STRING(255), allowNull: true },
    role_abbreviation: { type: DataTypes.STRING(64), allowNull: true },
    match_position_external_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    match_position_name: { type: DataTypes.STRING(255), allowNull: true },
    match_position_abbreviation: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    number: { type: DataTypes.INTEGER, allowNull: true },
    lineup_number: { type: DataTypes.INTEGER, allowNull: true },
    played: { type: DataTypes.BOOLEAN, allowNull: true },
    played_in_lineup: { type: DataTypes.INTEGER, allowNull: true },
    team_side: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: 'MatchParticipantPlayer',
    tableName: 'match_participant_players',
    paranoid: true,
    underscored: true,
    indexes: [
      { fields: ['match_id'] },
      { fields: ['team_id'] },
      { fields: ['player_id'] },
      { fields: ['role_id'] },
      { fields: ['external_game_id'] },
      { fields: ['external_team_id'] },
      { fields: ['external_player_id'] },
      { fields: ['team_side'] },
    ],
  }
);

export default MatchParticipantPlayer;
