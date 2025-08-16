import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class GameSetting extends Model {}

GameSetting.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    type_overtime_id: { type: DataTypes.INTEGER },
    tournament_type_id: { type: DataTypes.INTEGER },
    tournament_id: { type: DataTypes.INTEGER },
    game_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: 'GameSetting',
    tableName: 'game_setting',
    timestamps: false,
  }
);

GameSetting.associate = ({ Game, OvertimeType, Tournament, TournamentType }) => {
  GameSetting.belongsTo(Game, { foreignKey: 'game_id' });
  GameSetting.belongsTo(OvertimeType, { foreignKey: 'type_overtime_id' });
  GameSetting.belongsTo(Tournament, { foreignKey: 'tournament_id' });
  GameSetting.belongsTo(TournamentType, { foreignKey: 'tournament_type_id' });
};

export default GameSetting;
