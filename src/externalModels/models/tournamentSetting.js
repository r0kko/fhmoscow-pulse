import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class TournamentSetting extends Model {}

TournamentSetting.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    tournament_type_id: { type: DataTypes.INTEGER },
    tournament_id: { type: DataTypes.INTEGER },
    duration_period: { type: DataTypes.INTEGER },
    points_for_win: { type: DataTypes.INTEGER },
    points_for_defeat: { type: DataTypes.INTEGER },
    points_for_draw: { type: DataTypes.INTEGER },
    points_for_shootout_win: { type: DataTypes.INTEGER },
    points_for_shootout_defeat: { type: DataTypes.INTEGER },
    points_for_overtime_win: { type: DataTypes.INTEGER },
    points_for_overtime_defeat: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'TournamentSetting',
    tableName: 'tournament_setting',
    timestamps: false,
  }
);

TournamentSetting.associate = ({ Tournament, TournamentType }) => {
  TournamentSetting.belongsTo(Tournament, { foreignKey: 'tournament_id' });
  TournamentSetting.belongsTo(TournamentType, {
    foreignKey: 'tournament_type_id',
  });
};

export default TournamentSetting;
