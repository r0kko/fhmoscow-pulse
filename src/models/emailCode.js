import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class EmailCode extends Model {}

EmailCode.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: { type: DataTypes.UUID, allowNull: false },
    // Deprecated plaintext column kept for backward compatibility only.
    code: { type: DataTypes.STRING(6), allowNull: true },
    purpose: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'verify',
    },
    code_hash: { type: DataTypes.STRING(64), allowNull: true },
    attempt_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    locked_until: { type: DataTypes.DATE, allowNull: true },
    consumed_at: { type: DataTypes.DATE, allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    modelName: 'EmailCode',
    tableName: 'email_codes',
    paranoid: true,
    underscored: true,
  }
);

export default EmailCode;
