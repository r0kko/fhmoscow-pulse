import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class MeasurementUnit extends Model {}

MeasurementUnit.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    alias: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    fractional: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'MeasurementUnit',
    tableName: 'measurement_units',
    paranoid: true,
    underscored: true,
  }
);

export default MeasurementUnit;
