import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class PlayerPhotoRequest extends Model {}

PlayerPhotoRequest.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    player_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    file_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    decision_reason: {
      type: DataTypes.TEXT,
    },
    reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    reviewed_at: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    modelName: 'PlayerPhotoRequest',
    tableName: 'player_photo_requests',
    paranoid: true,
    underscored: true,
  }
);

export default PlayerPhotoRequest;
