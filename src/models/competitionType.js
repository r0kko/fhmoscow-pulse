import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class CompetitionType extends Model {}

CompetitionType.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    alias: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
  },
  {
    sequelize,
    modelName: 'CompetitionType',
    tableName: 'competition_types',
    paranoid: true,
    underscored: true,
  }
);

export default CompetitionType;
