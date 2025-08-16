import { DataTypes, Model } from 'sequelize';

import sequelize from '../../config/externalMariaDb.js';

class RefereeCategory extends Model {}

RefereeCategory.init(
  { id: { type: DataTypes.INTEGER, primaryKey: true } },
  {
    sequelize,
    modelName: 'RefereeCategory',
    tableName: 'referee_category',
    timestamps: false,
  }
);

RefereeCategory.associate = ({ Referee }) => {
  if (Referee) RefereeCategory.hasMany(Referee, { foreignKey: 'category_id' });
};

export default RefereeCategory;
