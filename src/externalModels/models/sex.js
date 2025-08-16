import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class Sex extends Model {}

Sex.init(
  { id: { type: DataTypes.INTEGER, primaryKey: true } },
  {
    sequelize,
    modelName: 'Sex',
    tableName: 'sex',
    timestamps: false,
  }
);

Sex.associate = ({ Player, Staff, Referee }) => {
  if (Player) Sex.hasMany(Player, { foreignKey: 'sex_id' });
  if (Staff) Sex.hasMany(Staff, { foreignKey: 'sex_id' });
  if (Referee) Sex.hasMany(Referee, { foreignKey: 'sex_id' });
};

export default Sex;
