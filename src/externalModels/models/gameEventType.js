import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class GameEventType extends Model {}

GameEventType.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    name: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'GameEventType',
    tableName: 'game_event_type',
    timestamps: false,
  }
);

GameEventType.associate = ({ GameEvent }) => {
  if (GameEvent)
    GameEventType.hasMany(GameEvent, { foreignKey: 'event_type_id' });
};

export default GameEventType;
