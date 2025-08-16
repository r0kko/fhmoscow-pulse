import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class NewsTags extends Model {}

NewsTags.init(
  {
    news_id: { type: DataTypes.INTEGER, primaryKey: true },
    tags_id: { type: DataTypes.INTEGER, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'NewsTags',
    tableName: 'news_tags',
    timestamps: false,
  }
);

NewsTags.associate = ({ News, Tags }) => {
  NewsTags.belongsTo(News, { foreignKey: 'news_id' });
  NewsTags.belongsTo(Tags, { foreignKey: 'tags_id' });
  if (News && News.hasMany) News.hasMany(NewsTags, { foreignKey: 'news_id' });
  if (Tags && Tags.hasMany) Tags.hasMany(NewsTags, { foreignKey: 'tags_id' });
};

export default NewsTags;
