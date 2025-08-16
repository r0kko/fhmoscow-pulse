import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Report extends Model {}

Report.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    referee_id: { type: DataTypes.INTEGER },
    game_id: { type: DataTypes.INTEGER },
    status_id: { type: DataTypes.INTEGER },
    date_send: { type: DataTypes.DATE },
    text: { type: DataTypes.TEXT('long') },
    comment: { type: DataTypes.TEXT('long') },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    object_status: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'Report',
    tableName: 'report',
    timestamps: false,
  }
);

Report.associate = ({ Game, Referee, ReportStatus }) => {
  Report.belongsTo(Game, { foreignKey: 'game_id' });
  Report.belongsTo(Referee, { foreignKey: 'referee_id' });
  Report.belongsTo(ReportStatus, { foreignKey: 'status_id' });
};

export default Report;
