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
    // store 6 digit verification code
    code: { type: DataTypes.STRING(6), allowNull: false },
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
