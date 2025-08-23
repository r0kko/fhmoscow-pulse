import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class TournamentType extends Model {}

TournamentType.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    // Some columns may be nullable in legacy DB; we map minimally
    logo_id: { type: DataTypes.INTEGER },
    tags_id: { type: DataTypes.INTEGER },
    // Extended fields used by sync
    full_name: { type: DataTypes.STRING(255) },
    double_protocol: { type: DataTypes.BOOLEAN },
    object_status: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'TournamentType',
    tableName: 'tournament_type',
    timestamps: false,
  }
);

TournamentType.associate = ({
  ExtFile,
  Tags,
  GameSetting,
  TournamentSetting,
  Tournament,
}) => {
  TournamentType.belongsTo(ExtFile, { foreignKey: 'logo_id' });
  TournamentType.belongsTo(Tags, { foreignKey: 'tags_id' });
  if (GameSetting)
    TournamentType.hasMany(GameSetting, { foreignKey: 'tournament_type_id' });
  if (TournamentSetting)
    TournamentType.hasMany(TournamentSetting, {
      foreignKey: 'tournament_type_id',
    });
  if (Tournament) TournamentType.hasMany(Tournament, { foreignKey: 'type_id' });
};

export default TournamentType;
