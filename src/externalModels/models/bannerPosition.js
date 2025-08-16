import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class BannerPosition extends Model {}

BannerPosition.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'BannerPosition',
    tableName: 'banner_position',
    timestamps: false,
  }
);

BannerPosition.associate = ({ Banner }) => {
  BannerPosition.hasMany(Banner, { foreignKey: 'position_id' });
};

export default BannerPosition;
