import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class TeamPlayer extends Model {}

TeamPlayer.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    team_id: { type: DataTypes.UUID, allowNull: false },
    player_id: { type: DataTypes.UUID, allowNull: false },
    club_player_id: { type: DataTypes.UUID, allowNull: true },
    season_id: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'TeamPlayer',
    tableName: 'team_players',
    paranoid: true,
    underscored: true,
    indexes: [
      { fields: ['team_id'] },
      { fields: ['player_id'] },
      { fields: ['season_id'] },
    ],
  }
);

export default TeamPlayer;
