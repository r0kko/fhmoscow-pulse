import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class RefereeQualification extends Model {}

RefereeQualification.init(
  { id: { type: DataTypes.INTEGER, primaryKey: true } },
  {
    sequelize,
    modelName: 'RefereeQualification',
    tableName: 'referee_qualification',
    timestamps: false,
  }
);

RefereeQualification.associate = ({ Referee }) => {
  if (Referee) RefereeQualification.hasMany(Referee, { foreignKey: 'qualification_id' });
};

export default RefereeQualification;
