import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class TeamStaff extends Model {}

TeamStaff.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    team_id: { type: DataTypes.UUID, allowNull: false },
    staff_id: { type: DataTypes.UUID, allowNull: false },
    club_staff_id: { type: DataTypes.UUID, allowNull: true },
    season_id: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'TeamStaff',
    tableName: 'team_staff',
    paranoid: true,
    underscored: true,
    indexes: [
      { fields: ['team_id'] },
      { fields: ['staff_id'] },
      { fields: ['season_id'] },
    ],
  }
);

export default TeamStaff;
