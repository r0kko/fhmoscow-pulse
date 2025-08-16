import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class VideoTags extends Model {}

VideoTags.init(
  {
    video_id: { type: DataTypes.INTEGER, primaryKey: true },
    tags_id: { type: DataTypes.INTEGER, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'VideoTags',
    tableName: 'video_tags',
    timestamps: false,
  }
);

VideoTags.associate = ({ Tags, Video }) => {
  VideoTags.belongsTo(Tags, { foreignKey: 'tags_id' });
  VideoTags.belongsTo(Video, { foreignKey: 'video_id' });
  if (Tags && Tags.hasMany) Tags.hasMany(VideoTags, { foreignKey: 'tags_id' });
  if (Video && Video.hasMany) Video.hasMany(VideoTags, { foreignKey: 'video_id' });
};

export default VideoTags;
