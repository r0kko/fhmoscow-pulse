import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class TournamentIasEvent extends Model {}

TournamentIasEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    tournament_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    ias_event_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'TournamentIasEvent',
    tableName: 'tournament_ias_events',
    underscored: true,
    indexes: [{ unique: true, fields: ['tournament_id', 'ias_event_id'] }],
  }
);

export default TournamentIasEvent;
