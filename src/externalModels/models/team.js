import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Team extends Model {}

Team.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    club_id: { type: DataTypes.INTEGER },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    full_name: { type: DataTypes.STRING(255) },
    short_name: { type: DataTypes.STRING(255) },
    address: { type: DataTypes.STRING(255) },
    phone: { type: DataTypes.STRING(255) },
    email: { type: DataTypes.STRING(255) },
    description: { type: DataTypes.STRING(255) },
    site: { type: DataTypes.STRING(255) },
    object_status: { type: DataTypes.STRING(255) },
    logo_id: { type: DataTypes.INTEGER },
    stadium_id: { type: DataTypes.INTEGER },
    year: { type: DataTypes.INTEGER },
    tags_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'Team',
    tableName: 'team',
    timestamps: false,
  }
);

Team.associate = ({
  Club,
  ExtFile,
  Stadium,
  Tags,
  GamePlayer,
  GameStaff,
  PlayerStatistic,
  StaffStatistic,
  TournamentTable,
  CustomScore,
  UserTeam,
  TeamPlayer,
}) => {
  Team.belongsTo(Club, { foreignKey: 'club_id' });
  Team.belongsTo(ExtFile, { foreignKey: 'logo_id' });
  Team.belongsTo(Stadium, { foreignKey: 'stadium_id' });
  Team.belongsTo(Tags, { foreignKey: 'tags_id' });
  if (GamePlayer) Team.hasMany(GamePlayer, { foreignKey: 'team_id' });
  if (GameStaff) Team.hasMany(GameStaff, { foreignKey: 'team_id' });
  if (PlayerStatistic) Team.hasMany(PlayerStatistic, { foreignKey: 'team_id' });
  if (StaffStatistic) Team.hasMany(StaffStatistic, { foreignKey: 'team_id' });
  if (TournamentTable) Team.hasMany(TournamentTable, { foreignKey: 'team_id' });
  if (CustomScore) Team.hasMany(CustomScore, { foreignKey: 'team_id' });
  if (UserTeam) Team.hasMany(UserTeam, { foreignKey: 'team_id' });
  if (TeamPlayer) Team.hasMany(TeamPlayer, { foreignKey: 'team_id' });
};

export default Team;
