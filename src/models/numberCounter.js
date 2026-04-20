import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class NumberCounter extends Model {}

NumberCounter.init(
  {
    scope: {
      type: DataTypes.STRING(64),
      allowNull: false,
      primaryKey: true,
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    last_seq: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    modelName: 'NumberCounter',
    tableName: 'number_counters',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export default NumberCounter;
