import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class RefereeAccountingAction extends Model {}

RefereeAccountingAction.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    alias: { type: DataTypes.STRING(32), allowNull: false, unique: true },
    scope: { type: DataTypes.STRING(16), allowNull: false },
    name_ru: { type: DataTypes.STRING(128), allowNull: false },
    requires_comment: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    maker_checker_guard: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    display_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'RefereeAccountingAction',
    tableName: 'referee_accounting_actions',
    paranoid: true,
    underscored: true,
  }
);

export default RefereeAccountingAction;
