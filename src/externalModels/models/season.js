import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Season extends Model {}

Season.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    name: { type: DataTypes.STRING(255) },
    object_status: { type: DataTypes.STRING(255) },
    current: { type: DataTypes.BOOLEAN },
  },
  {
    sequelize,
    modelName: 'Season',
    tableName: 'season',
    timestamps: false,
  }
);

Season.associate = ({
  BasicDocument,
  Sdk,
  SeasonResults,
  PlayerStatistic,
  StaffStatistic,
  TournamentTable,
  CustomScore,
}) => {
  if (BasicDocument) Season.hasMany(BasicDocument, { foreignKey: 'season_id' });
  if (Sdk) Season.hasMany(Sdk, { foreignKey: 'season_id' });
  if (SeasonResults) Season.hasMany(SeasonResults, { foreignKey: 'season_id' });
  if (PlayerStatistic)
    Season.hasMany(PlayerStatistic, { foreignKey: 'season_id' });
  if (StaffStatistic)
    Season.hasMany(StaffStatistic, { foreignKey: 'season_id' });
  if (TournamentTable)
    Season.hasMany(TournamentTable, { foreignKey: 'season_id' });
  if (CustomScore) Season.hasMany(CustomScore, { foreignKey: 'season_id' });
};

export default Season;
