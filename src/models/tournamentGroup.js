import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class TournamentGroup extends Model {}

TournamentGroup.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    tournament_id: { type: DataTypes.UUID },
    stage_id: { type: DataTypes.UUID },
    name: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'TournamentGroup',
    tableName: 'tournament_groups',
    paranoid: true,
    underscored: true,
  }
);

export default TournamentGroup;
