import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class PlayerRole extends Model {}

PlayerRole.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'PlayerRole',
    tableName: 'player_roles',
    paranoid: true,
    underscored: true,
  }
);

export default PlayerRole;
