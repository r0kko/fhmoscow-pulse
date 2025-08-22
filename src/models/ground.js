import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Ground extends Model {}

Ground.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: true, unique: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    address_id: { type: DataTypes.UUID, allowNull: true },
    yandex_url: { type: DataTypes.STRING(500) },
  },
  {
    sequelize,
    modelName: 'Ground',
    tableName: 'grounds',
    paranoid: true,
    underscored: true,
  }
);

export default Ground;
