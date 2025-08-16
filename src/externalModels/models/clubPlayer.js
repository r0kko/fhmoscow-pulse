import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class ClubPlayer extends Model {}

ClubPlayer.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    club_id: { type: DataTypes.INTEGER },
    player_id: { type: DataTypes.INTEGER },
    role_id: { type: DataTypes.INTEGER },
    photo_id: { type: DataTypes.INTEGER },
    season_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'ClubPlayer',
    tableName: 'club_player',
    timestamps: false,
  }
);

ClubPlayer.associate = ({ Club, Player, TeamPlayerRole, ExtFile, Photo, Season }) => {
  ClubPlayer.belongsTo(Club, { foreignKey: 'club_id' });
  ClubPlayer.belongsTo(Player, { foreignKey: 'player_id' });
  ClubPlayer.belongsTo(TeamPlayerRole, { foreignKey: 'role_id' });
  ClubPlayer.belongsTo(ExtFile, { foreignKey: 'photo_id' });
  ClubPlayer.belongsTo(Photo, { foreignKey: 'photo_id' });
  ClubPlayer.belongsTo(Season, { foreignKey: 'season_id' });
};

export default ClubPlayer;
