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
    // store bcrypt hash of 6 digit code
    code: { type: DataTypes.STRING(100), allowNull: false },
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
