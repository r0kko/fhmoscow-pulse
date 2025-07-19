import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class NormativeGroup extends Model {}

NormativeGroup.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    season_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    alias: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: 'NormativeGroup',
    tableName: 'normative_groups',
    paranoid: true,
    underscored: true,
  }
);

export default NormativeGroup;
