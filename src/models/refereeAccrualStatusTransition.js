import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class RefereeAccrualStatusTransition extends Model {}

RefereeAccrualStatusTransition.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    from_status_id: { type: DataTypes.UUID, allowNull: false },
    action_id: { type: DataTypes.UUID, allowNull: false },
    to_status_id: { type: DataTypes.UUID, allowNull: false },
    is_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'RefereeAccrualStatusTransition',
    tableName: 'referee_accrual_status_transitions',
    paranoid: true,
    underscored: true,
  }
);

export default RefereeAccrualStatusTransition;
