import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class PlayerPhotoRequestStatus extends Model {}

PlayerPhotoRequestStatus.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    alias: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'PlayerPhotoRequestStatus',
    tableName: 'player_photo_request_statuses',
    paranoid: false,
    underscored: true,
  }
);

export default PlayerPhotoRequestStatus;
