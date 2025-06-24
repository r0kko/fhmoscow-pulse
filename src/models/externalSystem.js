import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class ExternalSystem extends Model {}

ExternalSystem.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(100), allowNull: false },
    alias: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'ExternalSystem',
    tableName: 'external_systems',
    paranoid: true,
    underscored: true,
  }
);

export default ExternalSystem;
