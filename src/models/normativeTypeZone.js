import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class NormativeTypeZone extends Model {}

NormativeTypeZone.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    season_id: { type: DataTypes.UUID, allowNull: false },
    normative_type_id: { type: DataTypes.UUID, allowNull: false },
    zone_id: { type: DataTypes.UUID, allowNull: false },
    min_value: { type: DataTypes.FLOAT },
    max_value: { type: DataTypes.FLOAT },
  },
  {
    sequelize,
    modelName: 'NormativeTypeZone',
    tableName: 'normative_type_zones',
    paranoid: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['normative_type_id', 'zone_id'],
        where: { deleted_at: null },
      },
    ],
  }
);

export default NormativeTypeZone;
