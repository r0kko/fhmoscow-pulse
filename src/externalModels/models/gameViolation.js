import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class GameViolation extends Model {}

GameViolation.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    name: { type: DataTypes.STRING(255) },
    full_name: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'GameViolation',
    tableName: 'game_violation',
    timestamps: false,
  }
);

GameViolation.associate = ({ GameEvent }) => {
  if (GameEvent)
    GameViolation.hasMany(GameEvent, { foreignKey: 'penalty_violation_id' });
};

export default GameViolation;
