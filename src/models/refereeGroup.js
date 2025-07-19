import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class RefereeGroup extends Model {}

RefereeGroup.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    season_id: { type: DataTypes.UUID, allowNull: false },
    camp_stadium_id: { type: DataTypes.UUID },
    name: { type: DataTypes.STRING(100), allowNull: false },
  },
  {
    sequelize,
    modelName: 'RefereeGroup',
    tableName: 'referee_groups',
    paranoid: true,
    underscored: true,
  }
);

export default RefereeGroup;
