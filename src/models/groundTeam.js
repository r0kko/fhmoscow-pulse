import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class GroundTeam extends Model {}

GroundTeam.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
  },
  {
    sequelize,
    modelName: 'GroundTeam',
    tableName: 'ground_teams',
    paranoid: true,
    underscored: true,
    indexes: [{ unique: true, fields: ['ground_id', 'team_id'] }],
  }
);

export default GroundTeam;
