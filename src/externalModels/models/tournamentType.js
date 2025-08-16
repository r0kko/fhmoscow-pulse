import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class TournamentType extends Model {}

TournamentType.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    logo_id: { type: DataTypes.INTEGER },
    tags_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'TournamentType',
    tableName: 'tournament_type',
    timestamps: false,
  }
);

TournamentType.associate = ({ ExtFile, Tags, GameSetting, TournamentSetting, Tournament }) => {
  TournamentType.belongsTo(ExtFile, { foreignKey: 'logo_id' });
  TournamentType.belongsTo(Tags, { foreignKey: 'tags_id' });
  if (GameSetting) TournamentType.hasMany(GameSetting, { foreignKey: 'tournament_type_id' });
  if (TournamentSetting) TournamentType.hasMany(TournamentSetting, { foreignKey: 'tournament_type_id' });
  if (Tournament) TournamentType.hasMany(Tournament, { foreignKey: 'type_id' });
};

export default TournamentType;
