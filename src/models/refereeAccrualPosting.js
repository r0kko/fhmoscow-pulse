import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class RefereeAccrualPosting extends Model {}

RefereeAccrualPosting.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    document_id: { type: DataTypes.UUID, allowNull: false },
    line_no: { type: DataTypes.INTEGER, allowNull: false },
    posting_type_id: { type: DataTypes.UUID, allowNull: false },
    component_id: { type: DataTypes.UUID, allowNull: false },
    amount_rub: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: '0.00',
    },
    reason_code: { type: DataTypes.STRING(64), allowNull: true },
    comment: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'RefereeAccrualPosting',
    tableName: 'referee_accrual_postings',
    paranoid: true,
    underscored: true,
  }
);

export default RefereeAccrualPosting;
