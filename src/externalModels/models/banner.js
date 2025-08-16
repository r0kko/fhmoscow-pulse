import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Banner extends Model {}

Banner.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    position_id: { type: DataTypes.INTEGER },
    image_id: { type: DataTypes.INTEGER },
    name: { type: DataTypes.STRING(255) },
    site: { type: DataTypes.STRING(255) },
    rang: { type: DataTypes.INTEGER },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    object_status: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'Banner',
    tableName: 'banner',
    timestamps: false,
  }
);

Banner.associate = ({ BannerPosition, ExtFile }) => {
  Banner.belongsTo(BannerPosition, { foreignKey: 'position_id' });
  Banner.belongsTo(ExtFile, { foreignKey: 'image_id' });
};

export default Banner;
