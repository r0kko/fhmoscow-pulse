import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class GameEvent extends Model {}

GameEvent.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    game_id: { type: DataTypes.INTEGER },
    event_type_id: { type: DataTypes.INTEGER },
    goal_author_id: { type: DataTypes.INTEGER },
    goal_assistant1_id: { type: DataTypes.INTEGER },
    goal_assistant2_id: { type: DataTypes.INTEGER },
    goal_situation_id: { type: DataTypes.INTEGER },
    shootout_player_id: { type: DataTypes.INTEGER },
    penalty_player_id: { type: DataTypes.INTEGER },
    penalty_violation_id: { type: DataTypes.INTEGER },
    goalkeeper_team1_id: { type: DataTypes.INTEGER },
    goalkeeper_team2_id: { type: DataTypes.INTEGER },
    minute: { type: DataTypes.INTEGER },
    second: { type: DataTypes.INTEGER },
    goal_free_throw: { type: DataTypes.BOOLEAN },
    team_id: { type: DataTypes.INTEGER },
    period: { type: DataTypes.INTEGER },
    shootout_goalkeeper_id: { type: DataTypes.INTEGER },
    shootout_realised: { type: DataTypes.BOOLEAN },
    penalty_minutes_id: { type: DataTypes.INTEGER },
    penalty_finish_minute: { type: DataTypes.INTEGER },
    penalty_finish_second: { type: DataTypes.INTEGER },
    team_penalty: { type: DataTypes.BOOLEAN },
  },
  {
    sequelize,
    modelName: 'GameEvent',
    tableName: 'game_event',
    timestamps: false,
  }
);

GameEvent.associate = ({ Game, GameEventType, GameSituation, GameViolation, PenaltyMinutes, Player, Team }) => {
  GameEvent.belongsTo(Game, { foreignKey: 'game_id' });
  GameEvent.belongsTo(GameEventType, { foreignKey: 'event_type_id' });
  GameEvent.belongsTo(GameSituation, { foreignKey: 'goal_situation_id' });
  GameEvent.belongsTo(GameViolation, { foreignKey: 'penalty_violation_id' });
  GameEvent.belongsTo(PenaltyMinutes, { foreignKey: 'penalty_minutes_id' });
  GameEvent.belongsTo(Player, { as: 'shootout_goalkeeper', foreignKey: 'shootout_goalkeeper_id' });
  GameEvent.belongsTo(Player, { as: 'shootout_player', foreignKey: 'shootout_player_id' });
  GameEvent.belongsTo(Player, { as: 'goalkeeper_team1', foreignKey: 'goalkeeper_team1_id' });
  GameEvent.belongsTo(Player, { as: 'goalkeeper_team2', foreignKey: 'goalkeeper_team2_id' });
  GameEvent.belongsTo(Player, { as: 'penalty_player', foreignKey: 'penalty_player_id' });
  GameEvent.belongsTo(Player, { as: 'goal_author', foreignKey: 'goal_author_id' });
  GameEvent.belongsTo(Player, { as: 'goal_assistant2', foreignKey: 'goal_assistant2_id' });
  GameEvent.belongsTo(Player, { as: 'goal_assistant1', foreignKey: 'goal_assistant1_id' });
  GameEvent.belongsTo(Team, { foreignKey: 'team_id' });
};

export default GameEvent;
