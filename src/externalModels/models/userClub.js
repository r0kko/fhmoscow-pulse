import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class UserClub extends Model {}

UserClub.init(
  {
    user_id: { type: DataTypes.INTEGER, primaryKey: true },
    club_id: { type: DataTypes.INTEGER, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'UserClub',
    tableName: 'user_club',
    timestamps: false,
  }
);

UserClub.associate = ({ User, Club }) => {
  UserClub.belongsTo(User, { foreignKey: 'user_id' });
  UserClub.belongsTo(Club, { foreignKey: 'club_id' });
};

export default UserClub;
