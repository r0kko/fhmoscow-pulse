import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class GroundClub extends Model {}

GroundClub.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
  },
  {
    sequelize,
    modelName: 'GroundClub',
    tableName: 'ground_clubs',
    paranoid: true,
    underscored: true,
    indexes: [{ unique: true, fields: ['ground_id', 'club_id'] }],
  }
);

export default GroundClub;
