import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class EquipmentSize extends Model {}

EquipmentSize.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    alias: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'EquipmentSize',
    tableName: 'equipment_sizes',
    paranoid: true,
    underscored: true,
  }
);

export default EquipmentSize;
