import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Club extends Model {}

Club.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: true, unique: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    club_type_id: { type: DataTypes.UUID, allowNull: false },
    is_moscow: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'Club',
    tableName: 'clubs',
    paranoid: true,
    underscored: true,
  }
);

export default Club;
