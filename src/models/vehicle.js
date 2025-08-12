import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Vehicle extends Model {}

Vehicle.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: { type: DataTypes.UUID, allowNull: false },
    brand: { type: DataTypes.STRING(50), allowNull: false },
    model: { type: DataTypes.STRING(50) },
    number: { type: DataTypes.STRING(12), allowNull: false },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    sequelize,
    modelName: 'Vehicle',
    tableName: 'vehicles',
    paranoid: true,
    underscored: true,
  }
);

export default Vehicle;
