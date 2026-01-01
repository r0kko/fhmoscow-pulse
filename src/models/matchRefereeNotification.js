import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class MatchRefereeNotification extends Model {}

MatchRefereeNotification.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    match_referee_id: { type: DataTypes.UUID, allowNull: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.STRING(40), allowNull: false },
    channel: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'EMAIL',
    },
    payload_hash: { type: DataTypes.STRING(64), allowNull: false },
    payload: { type: DataTypes.JSONB, allowNull: true },
    sent_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'MatchRefereeNotification',
    tableName: 'match_referee_notifications',
    paranoid: true,
    underscored: true,
  }
);

export default MatchRefereeNotification;
