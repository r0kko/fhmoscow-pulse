import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Snils extends Model {}

Snils.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    number: { type: DataTypes.STRING(14), allowNull: false },
  },
  {
    sequelize,
    modelName: 'Snils',
    tableName: 'snils',
    paranoid: true,
    underscored: true,
  }
);

export default Snils;
