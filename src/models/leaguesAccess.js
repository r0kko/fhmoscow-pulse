import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class LeaguesAccess extends Model {}

LeaguesAccess.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    season_id: { type: DataTypes.UUID, allowNull: false },
    user_id: { type: DataTypes.UUID, allowNull: false },
    competition_type_id: { type: DataTypes.UUID, allowNull: false },
  },
  {
    sequelize,
    modelName: 'LeaguesAccess',
    tableName: 'leagues_access',
    paranoid: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['season_id', 'user_id', 'competition_type_id'],
        where: { deleted_at: null },
      },
    ],
  }
);

export default LeaguesAccess;
