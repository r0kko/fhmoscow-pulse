import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class SportSchoolPosition extends Model {}

SportSchoolPosition.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    alias: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'SportSchoolPosition',
    tableName: 'sport_school_positions',
    paranoid: true,
    underscored: true,
    defaultScope: {
      order: [['name', 'ASC']],
    },
  }
);

export default SportSchoolPosition;
