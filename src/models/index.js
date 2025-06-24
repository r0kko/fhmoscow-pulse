import User from './user.js';
import Role from './role.js';
import UserRole from './userRole.js';
import UserStatus from './userStatus.js';
import Log from './log.js';
import EmailCode from './emailCode.js';
import DocumentType from './documentType.js';
import Country from './country.js';
import Passport from './passport.js';
import Inn from './inn.js';
import Snils from './snils.js';
import BankAccount from './bankAccount.js';
import TaxationType from './taxationType.js';
import Taxation from './taxation.js';
import ExternalSystem from './externalSystem.js';
import UserExternalId from './userExternalId.js';

/* 1-ко-многим: статус → пользователи */
UserStatus.hasMany(User, { foreignKey: 'status_id' });
User.belongsTo(UserStatus, { foreignKey: 'status_id' });

/* многие-ко-многим: пользователь ↔ роли */
User.belongsToMany(Role, { through: UserRole, foreignKey: 'user_id' });
Role.belongsToMany(User, { through: UserRole, foreignKey: 'role_id' });

/* лог ↔ пользователь (опциональная связь) */
User.hasMany(Log, { foreignKey: 'user_id' });
Log.belongsTo(User, { foreignKey: 'user_id' });

/* паспорт ↔ пользователь 1-ко-1 */
User.hasOne(Passport, { foreignKey: 'user_id' });
Passport.belongsTo(User, { foreignKey: 'user_id' });
User.hasOne(Inn, { foreignKey: 'user_id' });
Inn.belongsTo(User, { foreignKey: 'user_id' });
User.hasOne(Snils, { foreignKey: 'user_id' });
Snils.belongsTo(User, { foreignKey: 'user_id' });
User.hasOne(BankAccount, { foreignKey: 'user_id' });
BankAccount.belongsTo(User, { foreignKey: 'user_id' });
User.hasOne(Taxation, { foreignKey: 'user_id' });
Taxation.belongsTo(User, { foreignKey: 'user_id' });
TaxationType.hasMany(Taxation, { foreignKey: 'taxation_type_id' });
Taxation.belongsTo(TaxationType, { foreignKey: 'taxation_type_id' });

/* external systems */
User.hasMany(UserExternalId, { foreignKey: 'user_id' });
UserExternalId.belongsTo(User, { foreignKey: 'user_id' });
ExternalSystem.hasMany(UserExternalId, { foreignKey: 'external_system_id' });
UserExternalId.belongsTo(ExternalSystem, { foreignKey: 'external_system_id' });

/* справочники */
DocumentType.hasMany(Passport, { foreignKey: 'document_type_id' });
Passport.belongsTo(DocumentType, { foreignKey: 'document_type_id' });

Country.hasMany(Passport, { foreignKey: 'country_id' });
Passport.belongsTo(Country, { foreignKey: 'country_id' });

/* email verification codes */
User.hasMany(EmailCode, { foreignKey: 'user_id' });
EmailCode.belongsTo(User, { foreignKey: 'user_id' });

export {
  User,
  Role,
  UserRole,
  UserStatus,
  Log,
  EmailCode,
  DocumentType,
  Country,
  Passport,
  Inn,
  Snils,
  BankAccount,
  TaxationType,
  Taxation,
  ExternalSystem,
  UserExternalId,
};
