import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class NormativeType extends Model {}

NormativeType.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    season_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    alias: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    online_available: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    value_type_id: { type: DataTypes.UUID, allowNull: false },
    unit_id: { type: DataTypes.UUID, allowNull: false },
  },
  {
    sequelize,
    modelName: 'NormativeType',
    tableName: 'normative_types',
    paranoid: true,
    underscored: true,
  }
);

export default NormativeType;
