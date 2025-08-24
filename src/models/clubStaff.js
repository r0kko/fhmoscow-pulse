import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class ClubStaff extends Model {}

ClubStaff.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    club_id: { type: DataTypes.UUID, allowNull: true },
    staff_id: { type: DataTypes.UUID, allowNull: false },
    category_id: { type: DataTypes.UUID, allowNull: true },
    season_id: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'ClubStaff',
    tableName: 'club_staff',
    paranoid: true,
    underscored: true,
    indexes: [
      { fields: ['club_id'] },
      { fields: ['staff_id'] },
      { fields: ['category_id'] },
      { fields: ['season_id'] },
    ],
  }
);

export default ClubStaff;
