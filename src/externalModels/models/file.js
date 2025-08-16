import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class ExtFile extends Model {}

ExtFile.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    module: { type: DataTypes.STRING(255) },
    mime_type: { type: DataTypes.STRING(255) },
    size: { type: DataTypes.INTEGER },
    name: { type: DataTypes.STRING(255) },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    object_status: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'ExtFile',
    tableName: 'file',
    timestamps: false,
  }
);

ExtFile.associate = ({ Banner, BasicDocument, Club, ClubPlayer, ClubStaff, Document, News, NewsImage, Photo, PhotoImage, Player, Protocol, Referee, Sponsor, Stadium, Team, Tournament, TournamentType, Video }) => {
  // Representative hasMany relations (keep light to avoid heavy cross-deps)
  if (Banner) ExtFile.hasMany(Banner, { foreignKey: 'image_id' });
  if (BasicDocument) ExtFile.hasMany(BasicDocument, { foreignKey: 'file_id' });
  if (Club) ExtFile.hasMany(Club, { foreignKey: 'logo_id' });
  if (ClubPlayer) ExtFile.hasMany(ClubPlayer, { foreignKey: 'photo_id' });
  if (ClubStaff) ExtFile.hasMany(ClubStaff, { foreignKey: 'photo_id' });
  if (Document) ExtFile.hasMany(Document, { foreignKey: 'file_id' });
  if (News) ExtFile.hasMany(News, { foreignKey: 'preview_image_id' });
  if (NewsImage) ExtFile.hasMany(NewsImage, { foreignKey: 'file_id' });
  if (Photo) ExtFile.hasMany(Photo, { foreignKey: 'preview_image_id' });
  if (PhotoImage) ExtFile.hasMany(PhotoImage, { foreignKey: 'file_id' });
  if (Player) ExtFile.hasMany(Player, { foreignKey: 'photo_id' });
  if (Protocol) ExtFile.hasMany(Protocol, { foreignKey: 'file_id' });
  if (Referee) ExtFile.hasMany(Referee, { foreignKey: 'photo_id' });
  if (Sponsor) ExtFile.hasMany(Sponsor, { foreignKey: 'preview_image_id' });
  if (Stadium) ExtFile.hasMany(Stadium, { foreignKey: 'image_id' });
  if (Team) ExtFile.hasMany(Team, { foreignKey: 'logo_id' });
  if (Tournament) ExtFile.hasMany(Tournament, { foreignKey: 'logo_id' });
  if (TournamentType) ExtFile.hasMany(TournamentType, { foreignKey: 'logo_id' });
  if (Video) ExtFile.hasMany(Video, { foreignKey: 'preview_image_id' });
};

export default ExtFile;
