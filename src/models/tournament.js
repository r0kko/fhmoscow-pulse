import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Tournament extends Model {}

Tournament.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    season_id: { type: DataTypes.UUID },
    type_id: { type: DataTypes.UUID },
    name: { type: DataTypes.STRING(255), allowNull: false },
    full_name: { type: DataTypes.STRING(255) },
    birth_year: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'Tournament',
    tableName: 'tournaments',
    paranoid: true,
    underscored: true,
  }
);

export default Tournament;
