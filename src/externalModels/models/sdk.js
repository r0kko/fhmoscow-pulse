import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Sdk extends Model {}

Sdk.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    season_id: { type: DataTypes.INTEGER },
    file_id: { type: DataTypes.INTEGER },
    title: { type: DataTypes.STRING(255) },
    date_publication: { type: DataTypes.DATE },
    description: { type: DataTypes.TEXT('long') },
    month: { type: DataTypes.INTEGER },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    object_status: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'Sdk',
    tableName: 'sdk',
    timestamps: false,
  }
);

Sdk.associate = ({ ExtFile, Season }) => {
  Sdk.belongsTo(ExtFile, { foreignKey: 'file_id' });
  Sdk.belongsTo(Season, { foreignKey: 'season_id' });
};

export default Sdk;
