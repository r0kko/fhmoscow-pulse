import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class SignType extends Model {}

SignType.init(
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
    modelName: 'SignType',
    tableName: 'sign_types',
    paranoid: true,
    underscored: true,
  }
);

export default SignType;
