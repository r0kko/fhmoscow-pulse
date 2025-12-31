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
    external_id: { type: DataTypes.INTEGER, allowNull: true, unique: true },
    season_id: { type: DataTypes.UUID },
    type_id: { type: DataTypes.UUID },
    competition_type_id: { type: DataTypes.UUID },
    schedule_management_type_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    full_name: { type: DataTypes.STRING(255) },
    birth_year: { type: DataTypes.INTEGER },
    match_format: { type: DataTypes.STRING(64) },
    referee_payment_type: { type: DataTypes.STRING(64) },
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
