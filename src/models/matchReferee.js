import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class MatchReferee extends Model {}

MatchReferee.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    match_id: { type: DataTypes.UUID, allowNull: false },
    referee_role_id: { type: DataTypes.UUID, allowNull: false },
    user_id: { type: DataTypes.UUID, allowNull: false },
    status_id: { type: DataTypes.UUID, allowNull: false },
    published_at: { type: DataTypes.DATE, allowNull: true },
    published_by: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'MatchReferee',
    tableName: 'match_referees',
    paranoid: true,
    underscored: true,
  }
);

export default MatchReferee;
