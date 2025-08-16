import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class ReportStatus extends Model {}

ReportStatus.init(
  { id: { type: DataTypes.INTEGER, primaryKey: true } },
  {
    sequelize,
    modelName: 'ReportStatus',
    tableName: 'report_status',
    timestamps: false,
  }
);

export default ReportStatus;
