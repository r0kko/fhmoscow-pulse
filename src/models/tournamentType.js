import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class TournamentType extends Model {}

TournamentType.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    double_protocol: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'TournamentType',
    tableName: 'tournament_types',
    paranoid: true,
    underscored: true,
  }
);

export default TournamentType;
