import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Staff extends Model {}

Staff.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    reason_for_refusal: { type: DataTypes.STRING(255) },
    surname: { type: DataTypes.STRING(255) },
    name: { type: DataTypes.STRING(255) },
    patronymic: { type: DataTypes.STRING(255) },
    date_of_birth: { type: DataTypes.DATE },
    email: { type: DataTypes.STRING(255) },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    object_status: { type: DataTypes.STRING(255) },
    photo_id: { type: DataTypes.INTEGER },
    sex_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'Staff',
    tableName: 'staff',
    timestamps: false,
  }
);

Staff.associate = ({ ExtFile, Photo, Sex, ClubStaff, GameStaff, StaffStatistic, TeamStaff }) => {
  Staff.belongsTo(ExtFile, { foreignKey: 'photo_id' });
  Staff.belongsTo(Photo, { foreignKey: 'photo_id' });
  Staff.belongsTo(Sex, { foreignKey: 'sex_id' });
  if (ClubStaff) Staff.hasMany(ClubStaff, { foreignKey: 'staff_id' });
  if (GameStaff) Staff.hasMany(GameStaff, { foreignKey: 'staff_id' });
  if (StaffStatistic) Staff.hasMany(StaffStatistic, { foreignKey: 'staff_id' });
  if (TeamStaff) Staff.hasMany(TeamStaff, { foreignKey: 'staff_id' });
};

export default Staff;
