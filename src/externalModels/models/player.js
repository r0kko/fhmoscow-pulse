import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Player extends Model {}

Player.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    grip: { type: DataTypes.STRING(255) },
    height: { type: DataTypes.INTEGER },
    weight: { type: DataTypes.INTEGER },
    repeated: { type: DataTypes.BOOLEAN },
    reason_for_refusal: { type: DataTypes.STRING(255) },
    surname: { type: DataTypes.STRING(255) },
    name: { type: DataTypes.STRING(255) },
    patronymic: { type: DataTypes.STRING(255) },
    date_of_birth: { type: DataTypes.DATE },
    email: { type: DataTypes.STRING(255) },
    date_create: { type: DataTypes.DATE },
    date_update: { type: DataTypes.DATE },
    object_status: { type: DataTypes.STRING(255) },
    photo_id: { type: DataTypes.INTEGER },
    sex_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'Player',
    tableName: 'player',
    timestamps: false,
  }
);

Player.associate = ({
  ExtFile,
  Photo,
  Sex,
  ClubPlayer,
  TeamPlayer,
  GamePlayer,
  PlayerStatistic,
  Document,
  GameEvent,
}) => {
  Player.belongsTo(ExtFile, { foreignKey: 'photo_id' });
  Player.belongsTo(Photo, { foreignKey: 'photo_id' });
  Player.belongsTo(Sex, { foreignKey: 'sex_id' });
  if (ClubPlayer) Player.hasMany(ClubPlayer, { foreignKey: 'player_id' });
  if (TeamPlayer) Player.hasMany(TeamPlayer, { foreignKey: 'player_id' });
  if (GamePlayer) Player.hasMany(GamePlayer, { foreignKey: 'player_id' });
  if (PlayerStatistic)
    Player.hasMany(PlayerStatistic, { foreignKey: 'player_id' });
  if (Document) Player.hasMany(Document, { foreignKey: 'player_id' });
  if (GameEvent) {
    Player.hasMany(GameEvent, {
      as: 'ShootoutGoalkeeperEvents',
      foreignKey: 'shootout_goalkeeper_id',
    });
    Player.hasMany(GameEvent, {
      as: 'ShootoutPlayerEvents',
      foreignKey: 'shootout_player_id',
    });
    Player.hasMany(GameEvent, {
      as: 'GoalkeeperTeam1Events',
      foreignKey: 'goalkeeper_team1_id',
    });
    Player.hasMany(GameEvent, {
      as: 'GoalkeeperTeam2Events',
      foreignKey: 'goalkeeper_team2_id',
    });
    Player.hasMany(GameEvent, {
      as: 'PenaltyPlayerEvents',
      foreignKey: 'penalty_player_id',
    });
    Player.hasMany(GameEvent, {
      as: 'GoalAuthorEvents',
      foreignKey: 'goal_author_id',
    });
    Player.hasMany(GameEvent, {
      as: 'GoalAssistant2Events',
      foreignKey: 'goal_assistant2_id',
    });
    Player.hasMany(GameEvent, {
      as: 'GoalAssistant1Events',
      foreignKey: 'goal_assistant1_id',
    });
  }
};

export default Player;
