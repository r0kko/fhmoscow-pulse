import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Club extends Model {}

Club.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    full_name: { type: DataTypes.STRING(255) },
    short_name: { type: DataTypes.STRING(255) },
    address: { type: DataTypes.STRING(255) },
    phone: { type: DataTypes.STRING(255) },
    email: { type: DataTypes.STRING(255) },
    description: { type: DataTypes.TEXT('long') },
    site: { type: DataTypes.STRING(255) },
    object_status: { type: DataTypes.STRING(255) },
    logo_id: { type: DataTypes.INTEGER },
    tags_id: { type: DataTypes.INTEGER },
    is_moscow: { type: DataTypes.BOOLEAN },
    rang: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'Club',
    tableName: 'club',
    timestamps: false,
  }
);

Club.associate = ({ ExtFile, Tags, ClubPlayer, ClubStaff, Team, UserClub }) => {
  Club.belongsTo(ExtFile, { foreignKey: 'logo_id' });
  Club.belongsTo(Tags, { foreignKey: 'tags_id' });
  if (ClubPlayer) Club.hasMany(ClubPlayer, { foreignKey: 'club_id' });
  if (ClubStaff) Club.hasMany(ClubStaff, { foreignKey: 'club_id' });
  if (Team) Club.hasMany(Team, { foreignKey: 'club_id' });
  if (UserClub) Club.hasMany(UserClub, { foreignKey: 'club_id' });
};

export default Club;
