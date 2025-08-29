import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class MatchAgreementStatus extends Model {}

MatchAgreementStatus.init(
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
    modelName: 'MatchAgreementStatus',
    tableName: 'match_agreement_statuses',
    paranoid: true,
    underscored: true,
  }
);

export default MatchAgreementStatus;
