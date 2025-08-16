import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class TournamentGroup extends Model {}

TournamentGroup.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    tournament_id: { type: DataTypes.INTEGER },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    name: { type: DataTypes.STRING(255) },
    object_status: { type: DataTypes.STRING(255) },
    stage_id: { type: DataTypes.INTEGER },
    completed: { type: DataTypes.BOOLEAN },
  },
  {
    sequelize,
    modelName: 'TournamentGroup',
    tableName: 'group',
    timestamps: false,
  }
);

TournamentGroup.associate = ({ Stage, Tournament, Tour, TournamentTable, CustomScore, TournamentTeam }) => {
  TournamentGroup.belongsTo(Stage, { foreignKey: 'stage_id' });
  TournamentGroup.belongsTo(Tournament, { foreignKey: 'tournament_id' });
  if (Tour) TournamentGroup.hasMany(Tour, { foreignKey: 'tournament_group_id' });
  if (TournamentTable) TournamentGroup.hasMany(TournamentTable, { foreignKey: 'tournament_group_id' });
  if (CustomScore) TournamentGroup.hasMany(CustomScore, { foreignKey: 'tournament_group_id' });
  if (TournamentTeam) TournamentGroup.hasMany(TournamentTeam, { foreignKey: 'tournament_group_id' });
};

export default TournamentGroup;
