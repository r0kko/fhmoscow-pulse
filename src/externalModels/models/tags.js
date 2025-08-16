import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Tags extends Model {}

Tags.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    name: { type: DataTypes.STRING(255) },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    object_status: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'Tags',
    tableName: 'tags',
    timestamps: false,
  }
);

Tags.associate = ({ Club, Team, Tournament, TournamentType, PhotoTags, NewsTags, VideoTags }) => {
  if (Club) Tags.hasMany(Club, { foreignKey: 'tags_id' });
  if (Team) Tags.hasMany(Team, { foreignKey: 'tags_id' });
  if (Tournament) Tags.hasMany(Tournament, { foreignKey: 'tags_id' });
  if (TournamentType) Tags.hasMany(TournamentType, { foreignKey: 'tags_id' });
  if (PhotoTags) Tags.hasMany(PhotoTags, { foreignKey: 'tags_id' });
  if (NewsTags) Tags.hasMany(NewsTags, { foreignKey: 'tags_id' });
  if (VideoTags) Tags.hasMany(VideoTags, { foreignKey: 'tags_id' });
};

export default Tags;
