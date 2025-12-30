import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class TournamentGroupReferee extends Model {}

TournamentGroupReferee.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    tournament_group_id: { type: DataTypes.UUID, allowNull: false },
    referee_role_id: { type: DataTypes.UUID, allowNull: false },
    count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'TournamentGroupReferee',
    tableName: 'tournament_group_referees',
    paranoid: true,
    underscored: true,
  }
);

export default TournamentGroupReferee;
