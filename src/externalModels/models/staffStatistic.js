import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class StaffStatistic extends Model {}

StaffStatistic.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    season_id: { type: DataTypes.INTEGER },
    tournament_id: { type: DataTypes.INTEGER },
    team_id: { type: DataTypes.INTEGER },
    staff_id: { type: DataTypes.INTEGER },
    game_count: { type: DataTypes.INTEGER },
    win_count: { type: DataTypes.INTEGER },
    tie_count: { type: DataTypes.INTEGER },
    loss_count: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'StaffStatistic',
    tableName: 'staff_statistic',
    timestamps: false,
  }
);

StaffStatistic.associate = ({ Season, Staff, Team, Tournament }) => {
  StaffStatistic.belongsTo(Season, { foreignKey: 'season_id' });
  StaffStatistic.belongsTo(Staff, { foreignKey: 'staff_id' });
  StaffStatistic.belongsTo(Team, { foreignKey: 'team_id' });
  StaffStatistic.belongsTo(Tournament, { foreignKey: 'tournament_id' });
};

export default StaffStatistic;
