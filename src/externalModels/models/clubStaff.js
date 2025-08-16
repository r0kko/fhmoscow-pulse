import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class ClubStaff extends Model {}

ClubStaff.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    club_id: { type: DataTypes.INTEGER },
    staff_id: { type: DataTypes.INTEGER },
    photo_id: { type: DataTypes.INTEGER },
    category_id: { type: DataTypes.INTEGER },
    season_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'ClubStaff',
    tableName: 'club_staff',
    timestamps: false,
  }
);

ClubStaff.associate = ({ Club, Staff, ExtFile, Photo, StaffCategory, Season }) => {
  ClubStaff.belongsTo(Club, { foreignKey: 'club_id' });
  ClubStaff.belongsTo(Staff, { foreignKey: 'staff_id' });
  ClubStaff.belongsTo(ExtFile, { foreignKey: 'photo_id' });
  ClubStaff.belongsTo(Photo, { foreignKey: 'photo_id' });
  ClubStaff.belongsTo(StaffCategory, { foreignKey: 'category_id' });
  ClubStaff.belongsTo(Season, { foreignKey: 'season_id' });
};

export default ClubStaff;
