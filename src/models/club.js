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
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
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
