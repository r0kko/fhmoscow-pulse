import { DataTypes, Model } from 'sequelize';

import sequelize from '../config/database.js';

class BankAccount extends Model {}

BankAccount.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: { type: DataTypes.UUID, allowNull: false },
    number: { type: DataTypes.STRING(20), allowNull: false },
    bic: { type: DataTypes.STRING(9), allowNull: false },
    bank_name: { type: DataTypes.STRING(255) },
    correspondent_account: { type: DataTypes.STRING(20) },
    swift: { type: DataTypes.STRING(20) },
    inn: { type: DataTypes.STRING(12) },
    kpp: { type: DataTypes.STRING(9) },
    address: { type: DataTypes.STRING(255) },
  },
  {
    sequelize,
    modelName: 'BankAccount',
    tableName: 'bank_accounts',
    paranoid: true,
    underscored: true,
  }
);

export default BankAccount;
