import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class UserTeam extends Model {}

UserTeam.init(
  {
    user_id: { type: DataTypes.INTEGER, primaryKey: true },
    team_id: { type: DataTypes.INTEGER, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'UserTeam',
    tableName: 'user_team',
    timestamps: false,
  }
);

UserTeam.associate = ({ User, Team }) => {
  UserTeam.belongsTo(User, { foreignKey: 'user_id' });
  UserTeam.belongsTo(Team, { foreignKey: 'team_id' });
};

export default UserTeam;
