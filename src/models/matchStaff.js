import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class MatchStaff extends Model {}

MatchStaff.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    match_id: { type: DataTypes.UUID, allowNull: false },
    team_id: { type: DataTypes.UUID, allowNull: false },
    team_staff_id: { type: DataTypes.UUID, allowNull: false },
    role_id: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'MatchStaff',
    tableName: 'match_staff',
    paranoid: true,
    underscored: true,
    indexes: [
      { fields: ['match_id'] },
      { fields: ['team_id'] },
      { fields: ['team_staff_id'] },
      { unique: true, fields: ['match_id', 'team_staff_id'] },
      { unique: true, fields: ['match_id', 'team_id', 'team_staff_id'] },
    ],
  }
);

export default MatchStaff;
