import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Sponsor extends Model {}

Sponsor.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    preview_image_id: { type: DataTypes.INTEGER },
    name: { type: DataTypes.STRING(255) },
    text: { type: DataTypes.TEXT('long') },
    priority: { type: DataTypes.INTEGER },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    object_status: { type: DataTypes.STRING(255) },
    site: { type: DataTypes.STRING(255) },
    banner_id: { type: DataTypes.INTEGER },
    status: { type: DataTypes.STRING(50) },
    show_in_footer: { type: DataTypes.BOOLEAN },
  },
  {
    sequelize,
    modelName: 'Sponsor',
    tableName: 'sponsor',
    timestamps: false,
  }
);

Sponsor.associate = ({ Banner, ExtFile }) => {
  Sponsor.belongsTo(Banner, { foreignKey: 'banner_id' });
  Sponsor.belongsTo(ExtFile, {
    as: 'previewImage',
    foreignKey: 'preview_image_id',
  });
  Sponsor.belongsTo(ExtFile, { as: 'bannerImage', foreignKey: 'banner_id' });
  if (Banner && Banner.hasMany)
    Banner.hasMany(Sponsor, { foreignKey: 'banner_id' });
};

export default Sponsor;
