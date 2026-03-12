import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class AccountingAuditEvent extends Model {}

AccountingAuditEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    entity_type: { type: DataTypes.STRING(64), allowNull: false },
    entity_id: { type: DataTypes.UUID, allowNull: false },
    action: { type: DataTypes.STRING(64), allowNull: false },
    before_json: { type: DataTypes.JSONB, allowNull: true },
    after_json: { type: DataTypes.JSONB, allowNull: true },
    actor_id: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'AccountingAuditEvent',
    tableName: 'accounting_audit_events',
    paranoid: false,
    underscored: true,
  }
);

export default AccountingAuditEvent;
