import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class OvertimeType extends Model {}

OvertimeType.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'OvertimeType',
    tableName: 'overtime_type',
    timestamps: false,
  }
);

export default OvertimeType;
