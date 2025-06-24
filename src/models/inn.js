import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Inn extends Model {}

Inn.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    number: { type: DataTypes.STRING(12), allowNull: false },
  },
  {
    sequelize,
    modelName: 'Inn',
    tableName: 'inns',
    paranoid: true,
    underscored: true,
  }
);

export default Inn;
