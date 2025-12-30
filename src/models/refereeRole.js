import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class RefereeRole extends Model {}

RefereeRole.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    referee_role_group_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'RefereeRole',
    tableName: 'referee_roles',
    paranoid: true,
    underscored: true,
  }
);

export default RefereeRole;
