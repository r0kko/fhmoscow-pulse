import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Video extends Model {}

Video.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    preview_image_id: { type: DataTypes.INTEGER },
    full_title: { type: DataTypes.STRING(255) },
    short_title: { type: DataTypes.STRING(255) },
    show_in_slider: { type: DataTypes.BOOLEAN },
    date_publication: { type: DataTypes.DATE },
    link: { type: DataTypes.STRING(255) },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    object_status: { type: DataTypes.STRING(255) },
    description: { type: DataTypes.TEXT('long') },
    slug: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'Video',
    tableName: 'video',
    timestamps: false,
  }
);

Video.associate = ({ ExtFile }) => {
  Video.belongsTo(ExtFile, { foreignKey: 'preview_image_id' });
};

export default Video;
