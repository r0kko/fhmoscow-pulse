import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class News extends Model {}

News.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    preview_image_id: { type: DataTypes.INTEGER },
    full_title: { type: DataTypes.TEXT('long') },
    short_title: { type: DataTypes.STRING(255) },
    preview_text: { type: DataTypes.TEXT('long') },
    text: { type: DataTypes.TEXT('long') },
    show_in_slider: { type: DataTypes.BOOLEAN },
    date_publication: { type: DataTypes.DATE },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    object_status: { type: DataTypes.STRING(255) },
    document_id: { type: DataTypes.INTEGER },
    slug: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'News',
    tableName: 'news',
    timestamps: false,
  }
);

News.associate = ({ Document, ExtFile, NewsImage, NewsTags }) => {
  News.belongsTo(Document, { foreignKey: 'document_id' });
  News.belongsTo(ExtFile, { foreignKey: 'preview_image_id' });
  if (NewsImage) News.hasMany(NewsImage, { foreignKey: 'news_id' });
  if (NewsTags) News.hasMany(NewsTags, { foreignKey: 'news_id' });
};

export default News;
