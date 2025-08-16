import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Tournament extends Model {}

Tournament.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    type_id: { type: DataTypes.INTEGER },
    season_id: { type: DataTypes.INTEGER },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    full_name: { type: DataTypes.STRING(255) },
    short_name: { type: DataTypes.STRING(255) },
    date_start: { type: DataTypes.DATE },
    date_end: { type: DataTypes.DATE },
    object_status: { type: DataTypes.STRING(255) },
    logo_id: { type: DataTypes.INTEGER },
    year_of_birth: { type: DataTypes.INTEGER },
    tags_id: { type: DataTypes.INTEGER },
    hide_in_main_calendar: { type: DataTypes.BOOLEAN },
  },
  {
    sequelize,
    modelName: 'Tournament',
    tableName: 'tournament',
    timestamps: false,
  }
);

Tournament.associate = ({ ExtFile, Season, Tags, TournamentType, Stage, TournamentGroup, Tour, TournamentSetting, TournamentTable, TournamentTeam, CustomScore, PlayerStatistic, StaffStatistic }) => {
  Tournament.belongsTo(ExtFile, { foreignKey: 'logo_id' });
  Tournament.belongsTo(Season, { foreignKey: 'season_id' });
  Tournament.belongsTo(Tags, { foreignKey: 'tags_id' });
  Tournament.belongsTo(TournamentType, { foreignKey: 'type_id' });
  if (Stage) Tournament.hasMany(Stage, { foreignKey: 'tournament_id' });
  if (TournamentGroup) Tournament.hasMany(TournamentGroup, { foreignKey: 'tournament_id' });
  if (Tour) Tournament.hasMany(Tour, { foreignKey: 'tournament_id' });
  if (TournamentSetting) Tournament.hasMany(TournamentSetting, { foreignKey: 'tournament_id' });
  if (TournamentTable) Tournament.hasMany(TournamentTable, { foreignKey: 'tournament_id' });
  if (TournamentTeam) Tournament.hasMany(TournamentTeam, { foreignKey: 'tournament_id' });
  if (CustomScore) Tournament.hasMany(CustomScore, { foreignKey: 'tournament_id' });
  if (PlayerStatistic) Tournament.hasMany(PlayerStatistic, { foreignKey: 'tournament_id' });
  if (StaffStatistic) Tournament.hasMany(StaffStatistic, { foreignKey: 'tournament_id' });
};

export default Tournament;
