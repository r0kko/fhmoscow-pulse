import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class MatchRefereeDraftClear extends Model {}

MatchRefereeDraftClear.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    match_id: { type: DataTypes.UUID, allowNull: false },
    referee_role_group_id: { type: DataTypes.UUID, allowNull: false },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'MatchRefereeDraftClear',
    tableName: 'match_referee_draft_clears',
    paranoid: true,
    underscored: true,
  }
);

export default MatchRefereeDraftClear;
