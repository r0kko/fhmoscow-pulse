import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Taxation extends Model {}

Taxation.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: { type: DataTypes.UUID, allowNull: false, unique: true },
    taxation_type_id: { type: DataTypes.UUID, allowNull: false },
    check_date: { type: DataTypes.DATEONLY },
    registration_date: { type: DataTypes.DATEONLY },
    ogrn: { type: DataTypes.STRING(15) },
    okved: { type: DataTypes.STRING(10) },
  },
  {
    sequelize,
    modelName: 'Taxation',
    tableName: 'taxations',
    paranoid: true,
    underscored: true,
  }
);

export default Taxation;
