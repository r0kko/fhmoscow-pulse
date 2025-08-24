import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class StaffCategory extends Model {}

StaffCategory.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    name: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    sequelize,
    modelName: 'StaffCategory',
    tableName: 'staff_categories',
    paranoid: true,
    underscored: true,
  }
);

export default StaffCategory;
