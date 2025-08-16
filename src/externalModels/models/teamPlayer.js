import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class TeamPlayer extends Model {}

TeamPlayer.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    player_id: { type: DataTypes.INTEGER },
    team_id: { type: DataTypes.INTEGER },
    contract_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'TeamPlayer',
    tableName: 'team_player',
    timestamps: false,
  }
);

TeamPlayer.associate = ({ ClubPlayer, Player, Team }) => {
  TeamPlayer.belongsTo(ClubPlayer, { foreignKey: 'contract_id' });
  TeamPlayer.belongsTo(Player, { foreignKey: 'player_id' });
  TeamPlayer.belongsTo(Team, { foreignKey: 'team_id' });
};

export default TeamPlayer;
