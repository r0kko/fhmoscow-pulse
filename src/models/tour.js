import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Tour extends Model {}

Tour.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    tournament_id: { type: DataTypes.UUID },
    stage_id: { type: DataTypes.UUID },
    tournament_group_id: { type: DataTypes.UUID },
    name: { type: DataTypes.STRING(255) },
    date_start: { type: DataTypes.DATE },
    date_end: { type: DataTypes.DATE },
  },
  {
    sequelize,
    modelName: 'Tour',
    tableName: 'tours',
    paranoid: true,
    underscored: true,
  }
);

export default Tour;
