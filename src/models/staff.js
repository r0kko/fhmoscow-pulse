import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Staff extends Model {}

Staff.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    surname: { type: DataTypes.STRING(255) },
    name: { type: DataTypes.STRING(255) },
    patronymic: { type: DataTypes.STRING(255) },
    date_of_birth: { type: DataTypes.DATE },
  },
  {
    sequelize,
    modelName: 'Staff',
    tableName: 'staff',
    paranoid: true,
    underscored: true,
  }
);

export default Staff;
