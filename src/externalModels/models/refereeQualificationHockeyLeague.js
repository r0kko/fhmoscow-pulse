import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class RefereeQualificationHockeyLeague extends Model {}

RefereeQualificationHockeyLeague.init(
  { id: { type: DataTypes.INTEGER, primaryKey: true } },
  {
    sequelize,
    modelName: 'RefereeQualificationHockeyLeague',
    tableName: 'referee_qualification_hockey_league',
    timestamps: false,
  }
);

RefereeQualificationHockeyLeague.associate = ({ Referee }) => {
  if (Referee) RefereeQualificationHockeyLeague.hasMany(Referee, { foreignKey: 'qualification_hockey_league_id' });
};

export default RefereeQualificationHockeyLeague;
