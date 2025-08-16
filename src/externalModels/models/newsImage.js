import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class NewsImage extends Model {}

NewsImage.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    file_id: { type: DataTypes.INTEGER },
    news_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'NewsImage',
    tableName: 'news_image',
    timestamps: false,
  }
);

NewsImage.associate = ({ ExtFile, News }) => {
  NewsImage.belongsTo(ExtFile, { foreignKey: 'file_id' });
  NewsImage.belongsTo(News, { foreignKey: 'news_id' });
  if (News && News.hasMany) News.hasMany(NewsImage, { foreignKey: 'news_id' });
};

export default NewsImage;
