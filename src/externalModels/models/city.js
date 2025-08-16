import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class City extends Model {}

City.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    country_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'City',
    tableName: 'city',
    timestamps: false,
  }
);

City.associate = ({ Country, Stadium }) => {
  City.belongsTo(Country, { foreignKey: 'country_id' });
  if (Stadium) City.hasMany(Stadium, { foreignKey: 'city_id' });
};

export default City;
