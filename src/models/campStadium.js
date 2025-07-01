import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class CampStadium extends Model {}

CampStadium.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(255), allowNull: false },
    address_id: { type: DataTypes.UUID, allowNull: false },
    yandex_url: { type: DataTypes.STRING(500) },
    capacity: { type: DataTypes.INTEGER },
    phone: { type: DataTypes.STRING(50) },
    website: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'CampStadium',
    tableName: 'camp_stadiums',
    paranoid: true,
    underscored: true,
  }
);

export default CampStadium;
