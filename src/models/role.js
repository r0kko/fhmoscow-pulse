import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Role extends Model {}

Role.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    alias: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    groupAlias: { type: DataTypes.STRING(100), allowNull: true },
    groupName: { type: DataTypes.STRING(150), allowNull: true },
    departmentAlias: { type: DataTypes.STRING(100), allowNull: true },
    departmentName: { type: DataTypes.STRING(150), allowNull: true },
    displayOrder: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Role',
    tableName: 'roles',
    paranoid: true,
    underscored: true,
  }
);

export default Role;
