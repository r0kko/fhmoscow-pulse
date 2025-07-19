import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class NormativeGroupType extends Model {}

NormativeGroupType.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    group_id: { type: DataTypes.UUID, allowNull: false },
    type_id: { type: DataTypes.UUID, allowNull: false },
    required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: 'NormativeGroupType',
    tableName: 'normative_group_types',
    paranoid: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['group_id', 'type_id'],
        where: { deleted_at: null },
      },
    ],
  }
);

export default NormativeGroupType;
