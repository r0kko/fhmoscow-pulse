import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class ClubPlayer extends Model {}

ClubPlayer.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    club_id: { type: DataTypes.UUID, allowNull: true },
    player_id: { type: DataTypes.UUID, allowNull: false },
    role_id: { type: DataTypes.UUID, allowNull: true },
    number: { type: DataTypes.INTEGER, allowNull: true },
    season_id: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'ClubPlayer',
    tableName: 'club_players',
    paranoid: true,
    underscored: true,
    indexes: [
      { fields: ['club_id'] },
      { fields: ['player_id'] },
      { fields: ['role_id'] },
      { fields: ['season_id'] },
    ],
  }
);

export default ClubPlayer;
