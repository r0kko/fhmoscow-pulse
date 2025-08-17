import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Team extends Model {}

Team.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    full_name: { type: DataTypes.STRING(255), allowNull: false },
    short_name: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'Team',
    tableName: 'teams',
    paranoid: true,
    underscored: true,
  }
);

export default Team;
