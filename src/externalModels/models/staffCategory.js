import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class StaffCategory extends Model {}

StaffCategory.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    name: { type: DataTypes.STRING(255) },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    object_status: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'StaffCategory',
    tableName: 'staff_category',
    timestamps: false,
  }
);

StaffCategory.associate = ({ ClubStaff }) => {
  if (ClubStaff) StaffCategory.hasMany(ClubStaff, { foreignKey: 'category_id' });
};

export default StaffCategory;
