import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class RefereeAccrualComponent extends Model {}

RefereeAccrualComponent.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    alias: { type: DataTypes.STRING(32), allowNull: false, unique: true },
    name_ru: { type: DataTypes.STRING(128), allowNull: false },
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
    modelName: 'RefereeAccrualComponent',
    tableName: 'referee_accrual_components',
    paranoid: true,
    underscored: true,
  }
);

export default RefereeAccrualComponent;
