import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class PhotoImage extends Model {}

PhotoImage.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    file_id: { type: DataTypes.INTEGER },
    photo_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'PhotoImage',
    tableName: 'photo_image',
    timestamps: false,
  }
);

PhotoImage.associate = ({ ExtFile, Photo }) => {
  PhotoImage.belongsTo(ExtFile, { foreignKey: 'file_id' });
  PhotoImage.belongsTo(Photo, { foreignKey: 'photo_id' });
  if (Photo && Photo.hasMany) Photo.hasMany(PhotoImage, { foreignKey: 'photo_id' });
};

export default PhotoImage;
