import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class RefereeRoleGroup extends Model {}

RefereeRoleGroup.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(150), allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'RefereeRoleGroup',
    tableName: 'referee_role_groups',
    paranoid: true,
    underscored: true,
  }
);

export default RefereeRoleGroup;
