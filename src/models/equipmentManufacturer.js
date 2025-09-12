import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class EquipmentManufacturer extends Model {}

EquipmentManufacturer.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    alias: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'EquipmentManufacturer',
    tableName: 'equipment_manufacturers',
    paranoid: true,
    underscored: true,
  }
);

export default EquipmentManufacturer;
