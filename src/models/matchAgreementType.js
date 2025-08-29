import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class MatchAgreementType extends Model {}

MatchAgreementType.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    alias: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'MatchAgreementType',
    tableName: 'match_agreement_types',
    paranoid: true,
    underscored: true,
  }
);

export default MatchAgreementType;
