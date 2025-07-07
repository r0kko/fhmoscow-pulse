import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Sex extends Model {}

Sex.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    alias: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'Sex',
    tableName: 'sexes',
    paranoid: true,
    underscored: true,
  }
);

export default Sex;
