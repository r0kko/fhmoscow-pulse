import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class GamePenalty extends Model {}

GamePenalty.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    game_id: { type: DataTypes.UUID, allowNull: false },
    event_type_id: { type: DataTypes.UUID, allowNull: false },
    penalty_player_id: { type: DataTypes.UUID, allowNull: true },
    penalty_violation_id: { type: DataTypes.UUID, allowNull: true },
    minute: { type: DataTypes.INTEGER, allowNull: true },
    second: { type: DataTypes.INTEGER, allowNull: true },
    period: { type: DataTypes.INTEGER, allowNull: true },
    penalty_minutes_id: { type: DataTypes.UUID, allowNull: true },
    team_penalty: { type: DataTypes.BOOLEAN, allowNull: true },
    external_fp: { type: DataTypes.STRING(64), allowNull: true },
  },
  {
    sequelize,
    modelName: 'GamePenalty',
    tableName: 'game_penalties',
    paranoid: true,
    underscored: true,
  }
);

export default GamePenalty;
