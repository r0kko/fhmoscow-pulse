import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class PhotoTags extends Model {}

PhotoTags.init(
  {
    photo_id: { type: DataTypes.INTEGER, primaryKey: true },
    tags_id: { type: DataTypes.INTEGER, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'PhotoTags',
    tableName: 'photo_tags',
    timestamps: false,
  }
);

PhotoTags.associate = ({ Photo, Tags }) => {
  PhotoTags.belongsTo(Photo, { foreignKey: 'photo_id' });
  PhotoTags.belongsTo(Tags, { foreignKey: 'tags_id' });
  if (Photo && Photo.hasMany) Photo.hasMany(PhotoTags, { foreignKey: 'photo_id' });
  if (Tags && Tags.hasMany) Tags.hasMany(PhotoTags, { foreignKey: 'tags_id' });
};

export default PhotoTags;
