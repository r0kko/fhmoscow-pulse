import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class NormativeValueType extends Model {}

NormativeValueType.init(
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
    modelName: 'NormativeValueType',
    tableName: 'normative_value_types',
    paranoid: true,
    underscored: true,
  }
);

export default NormativeValueType;
