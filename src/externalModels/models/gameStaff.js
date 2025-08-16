import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class GameStaff extends Model {}

GameStaff.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    game_id: { type: DataTypes.INTEGER },
    staff_id: { type: DataTypes.INTEGER },
    team_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'GameStaff',
    tableName: 'game_staff',
    timestamps: false,
  }
);

GameStaff.associate = ({ Game, Staff, Team }) => {
  GameStaff.belongsTo(Game, { foreignKey: 'game_id' });
  GameStaff.belongsTo(Staff, { foreignKey: 'staff_id' });
  GameStaff.belongsTo(Team, { foreignKey: 'team_id' });
};

export default GameStaff;
