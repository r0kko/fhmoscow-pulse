import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class EquipmentType extends Model {}

EquipmentType.init(
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
    modelName: 'EquipmentType',
    tableName: 'equipment_types',
    paranoid: true,
    underscored: true,
  }
);

export default EquipmentType;
