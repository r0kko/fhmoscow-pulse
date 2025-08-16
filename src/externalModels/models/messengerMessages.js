import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class MessengerMessages extends Model {}

MessengerMessages.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true },
    queue_name: { type: DataTypes.STRING(190) },
    body: { type: DataTypes.TEXT('long') },
    headers: { type: DataTypes.TEXT('long') },
    created_at: { type: DataTypes.DATE },
    available_at: { type: DataTypes.DATE },
    delivered_at: { type: DataTypes.DATE },
  },
  {
    sequelize,
    modelName: 'MessengerMessages',
    tableName: 'messenger_messages',
    timestamps: false,
  }
);

export default MessengerMessages;
