import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class MatchParticipantStaff extends Model {}

MatchParticipantStaff.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    external_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    match_id: { type: DataTypes.UUID, allowNull: false },
    team_id: { type: DataTypes.UUID, allowNull: true },
    staff_id: { type: DataTypes.UUID, allowNull: true },
    external_game_id: { type: DataTypes.INTEGER, allowNull: false },
    external_team_id: { type: DataTypes.INTEGER, allowNull: true },
    external_staff_id: { type: DataTypes.INTEGER, allowNull: true },
    position: { type: DataTypes.STRING(255), allowNull: true },
    team_side: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: 'MatchParticipantStaff',
    tableName: 'match_participant_staff',
    paranoid: true,
    underscored: true,
    indexes: [
      { fields: ['match_id'] },
      { fields: ['team_id'] },
      { fields: ['staff_id'] },
      { fields: ['external_game_id'] },
      { fields: ['external_team_id'] },
      { fields: ['external_staff_id'] },
      { fields: ['team_side'] },
    ],
  }
);

export default MatchParticipantStaff;
