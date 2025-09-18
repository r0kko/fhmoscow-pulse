import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class Player extends Model {}

Player.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    surname: { type: DataTypes.STRING(255) },
    name: { type: DataTypes.STRING(255) },
    patronymic: { type: DataTypes.STRING(255) },
    date_of_birth: { type: DataTypes.DATE },
    grip: { type: DataTypes.STRING(255) },
    height: { type: DataTypes.INTEGER },
    weight: { type: DataTypes.INTEGER },
    photo_ext_file_id: { type: DataTypes.UUID },
  },
  {
    sequelize,
    modelName: 'Player',
    tableName: 'players',
    paranoid: true,
    underscored: true,
  }
);

export default Player;
