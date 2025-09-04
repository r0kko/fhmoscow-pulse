import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class MatchPlayer extends Model {}

MatchPlayer.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    match_id: { type: DataTypes.UUID, allowNull: false },
    team_id: { type: DataTypes.UUID, allowNull: false },
    team_player_id: { type: DataTypes.UUID, allowNull: false },
    // Per-match overrides
    number: { type: DataTypes.INTEGER, allowNull: true },
    role_id: { type: DataTypes.UUID, allowNull: true },
    // Leadership
    is_captain: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    assistant_order: { type: DataTypes.INTEGER, allowNull: true }, // 1 or 2
    // Double protocol support: squad number (1 or 2)
    squad_no: { type: DataTypes.INTEGER, allowNull: true },
    // For double protocol: one goalkeeper can be declared for both squads
    squad_both: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'MatchPlayer',
    tableName: 'match_players',
    paranoid: true,
    underscored: true,
    indexes: [
      { fields: ['match_id'] },
      { fields: ['team_id'] },
      { fields: ['team_player_id'] },
      { fields: ['role_id'] },
      { fields: ['squad_no'] },
      { fields: ['squad_both'] },
      { unique: true, fields: ['match_id', 'team_player_id'] },
      { unique: true, fields: ['match_id', 'team_id', 'team_player_id'] },
    ],
  }
);

export default MatchPlayer;
