import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class UserClub extends Model {}

UserClub.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sport_school_position_id: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'UserClub',
    tableName: 'user_clubs',
    paranoid: true,
    underscored: true,
    indexes: [{ unique: true, fields: ['user_id', 'club_id'] }],
  }
);

export default UserClub;
