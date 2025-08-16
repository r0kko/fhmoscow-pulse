import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Photo extends Model {}

Photo.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    preview_image_id: { type: DataTypes.INTEGER },
    full_title: { type: DataTypes.STRING(255) },
    short_title: { type: DataTypes.STRING(255) },
    show_in_slider: { type: DataTypes.BOOLEAN },
    date_publication: { type: DataTypes.DATE },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    object_status: { type: DataTypes.STRING(255) },
    slug: { type: DataTypes.STRING(255) },
    description: { type: DataTypes.TEXT('long') },
  },
  {
    sequelize,
    modelName: 'Photo',
    tableName: 'photo',
    timestamps: false,
  }
);

Photo.associate = ({ ExtFile, PhotoImage, PhotoTags }) => {
  Photo.belongsTo(ExtFile, { foreignKey: 'preview_image_id' });
  if (PhotoImage) Photo.hasMany(PhotoImage, { foreignKey: 'photo_id' });
  if (PhotoTags) Photo.hasMany(PhotoTags, { foreignKey: 'photo_id' });
};

export default Photo;
