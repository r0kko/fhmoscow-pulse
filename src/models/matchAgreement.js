import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class MatchAgreement extends Model {}

MatchAgreement.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    match_id: { type: DataTypes.UUID, allowNull: false },
    type_id: { type: DataTypes.UUID, allowNull: false },
    status_id: { type: DataTypes.UUID, allowNull: false },
    author_user_id: { type: DataTypes.UUID, allowNull: false },
    ground_id: { type: DataTypes.UUID, allowNull: false },
    date_start: { type: DataTypes.DATE, allowNull: false },
    parent_id: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'MatchAgreement',
    tableName: 'match_agreements',
    paranoid: true,
    underscored: true,
    indexes: [
      { fields: ['match_id'] },
      { fields: ['type_id'] },
      { fields: ['status_id'] },
      { fields: ['author_user_id'] },
      { fields: ['ground_id'] },
      { fields: ['parent_id'] },
      { fields: ['date_start'] },
    ],
  }
);

export default MatchAgreement;
