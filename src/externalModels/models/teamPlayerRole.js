import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class TeamPlayerRole extends Model {}

TeamPlayerRole.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    name: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'TeamPlayerRole',
    tableName: 'team_player_role',
    timestamps: false,
  }
);

TeamPlayerRole.associate = ({ ClubPlayer, GamePlayer }) => {
  if (ClubPlayer) TeamPlayerRole.hasMany(ClubPlayer, { foreignKey: 'role_id' });
  if (GamePlayer) TeamPlayerRole.hasMany(GamePlayer, { foreignKey: 'role_id' });
};

export default TeamPlayerRole;
