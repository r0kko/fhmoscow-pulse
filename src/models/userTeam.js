import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class UserTeam extends Model {}

UserTeam.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
  },
  {
    sequelize,
    modelName: 'UserTeam',
    tableName: 'user_teams',
    paranoid: true,
    underscored: true,
    indexes: [{ unique: true, fields: ['user_id', 'team_id'] }],
  }
);

export default UserTeam;
