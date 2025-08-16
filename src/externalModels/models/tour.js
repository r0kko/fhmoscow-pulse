import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Tour extends Model {}

Tour.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    tournament_group_id: { type: DataTypes.INTEGER },
    tournament_id: { type: DataTypes.INTEGER },
    name: { type: DataTypes.STRING(255) },
    date_start: { type: DataTypes.DATE },
    date_end: { type: DataTypes.DATE },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    object_status: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'Tour',
    tableName: 'tour',
    timestamps: false,
  }
);

Tour.associate = ({ TournamentGroup, Tournament, Game }) => {
  Tour.belongsTo(TournamentGroup, { foreignKey: 'tournament_group_id' });
  Tour.belongsTo(Tournament, { foreignKey: 'tournament_id' });
  if (Game) Tour.hasMany(Game, { foreignKey: 'tour_id' });
};

export default Tour;
