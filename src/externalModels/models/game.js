import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Game extends Model {}

Game.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    date_start: { type: DataTypes.DATE },
    tour_id: { type: DataTypes.INTEGER },
    stadium_id: { type: DataTypes.INTEGER },
    object_status: { type: DataTypes.STRING(255) },
    team1_id: { type: DataTypes.INTEGER },
    team2_id: { type: DataTypes.INTEGER },
    score_team1: { type: DataTypes.INTEGER },
    score_team2: { type: DataTypes.INTEGER },
    broadcast: { type: DataTypes.TEXT('long') },
    number_viewers: { type: DataTypes.INTEGER },
    number_game: { type: DataTypes.INTEGER },
    status: { type: DataTypes.INTEGER },
    match_number_playoff: { type: DataTypes.INTEGER },
    play_off_info: { type: DataTypes.STRING(255) },
    shootout_score_team1: { type: DataTypes.INTEGER },
    shootout_score_team2: { type: DataTypes.INTEGER },
    broadcast2: { type: DataTypes.TEXT('long') },
    technical_defeat: { type: DataTypes.BOOLEAN },
    points_for_tournament_table_team1: { type: DataTypes.INTEGER },
    points_for_tournament_table_team2: { type: DataTypes.INTEGER },
    cancel_status: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'Game',
    tableName: 'game',
    timestamps: false,
  }
);

Game.associate = ({
  Stadium,
  Team,
  Tour,
  GameAssignment,
  GameEvent,
  GamePlayer,
  GameReferee,
  GameRemark,
  GameStaff,
  Protocol,
  PlayerStatistic,
  Report,
}) => {
  Game.belongsTo(Stadium, { foreignKey: 'stadium_id' });
  Game.belongsTo(Team, { as: 'Team1', foreignKey: 'team1_id' });
  Game.belongsTo(Team, { as: 'Team2', foreignKey: 'team2_id' });
  Game.belongsTo(Tour, { foreignKey: 'tour_id' });
  if (GameAssignment) Game.hasMany(GameAssignment, { foreignKey: 'game_id' });
  if (GameEvent) Game.hasMany(GameEvent, { foreignKey: 'game_id' });
  if (GamePlayer) Game.hasMany(GamePlayer, { foreignKey: 'game_id' });
  if (GameReferee) Game.hasMany(GameReferee, { foreignKey: 'game_id' });
  if (GameRemark) Game.hasMany(GameRemark, { foreignKey: 'game_id' });
  if (GameStaff) Game.hasMany(GameStaff, { foreignKey: 'game_id' });
  if (Protocol) Game.hasMany(Protocol, { foreignKey: 'game_id' });
  if (PlayerStatistic) Game.hasMany(PlayerStatistic, { foreignKey: 'game_id' });
  if (Report) Game.hasMany(Report, { foreignKey: 'game_id' });
};

export default Game;
