import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class AddressType extends Model {}

AddressType.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    alias: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'AddressType',
    tableName: 'address_types',
    paranoid: true,
    underscored: true,
  }
);

export default AddressType;
