import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class ClubType extends Model {}

ClubType.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    alias: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
  },
  {
    sequelize,
    modelName: 'ClubType',
    tableName: 'club_types',
    paranoid: true,
    underscored: true,
  }
);

export default ClubType;
