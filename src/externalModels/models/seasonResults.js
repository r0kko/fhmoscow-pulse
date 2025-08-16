import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class SeasonResults extends Model {}

SeasonResults.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    season_id: { type: DataTypes.INTEGER },
    date: { type: DataTypes.STRING(255) },
    place: { type: DataTypes.STRING(255) },
    title: { type: DataTypes.STRING(255) },
    description: { type: DataTypes.TEXT('long') },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    object_status: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'SeasonResults',
    tableName: 'season_results',
    timestamps: false,
  }
);

SeasonResults.associate = ({ Season }) => {
  SeasonResults.belongsTo(Season, { foreignKey: 'season_id' });
};

export default SeasonResults;
