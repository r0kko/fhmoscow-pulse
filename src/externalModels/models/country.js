import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Country extends Model {}

Country.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'Country',
    tableName: 'country',
    timestamps: false,
  }
);

Country.associate = ({ City }) => {
  Country.hasMany(City, { foreignKey: 'country_id' });
};

export default Country;
