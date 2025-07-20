import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class NormativeZone extends Model {}

NormativeZone.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    alias: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    color: { type: DataTypes.STRING(20) },
  },
  {
    sequelize,
    modelName: 'NormativeZone',
    tableName: 'normative_zones',
    paranoid: true,
    underscored: true,
  }
);

export default NormativeZone;
