import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Season extends Model {}

Season.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    alias: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'Season',
    tableName: 'seasons',
    paranoid: true,
    underscored: true,
  }
);

export default Season;
