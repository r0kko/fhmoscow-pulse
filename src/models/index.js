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
import MedicalCertificate from './medicalCertificate.js';
import File from './file.js';
import MedicalCertificateType from './medicalCertificateType.js';
import MedicalCertificateFile from './medicalCertificateFile.js';
import TaxationType from './taxationType.js';
import Taxation from './taxation.js';
import ExternalSystem from './externalSystem.js';
import UserExternalId from './userExternalId.js';
import AddressType from './addressType.js';
import Address from './address.js';
import UserAddress from './userAddress.js';
import ParkingType from './parkingType.js';
import CampStadium from './campStadium.js';
import CampStadiumParkingType from './campStadiumParkingType.js';
import TrainingType from './trainingType.js';
import Training from './training.js';
import Season from './season.js';
import RefereeGroup from './refereeGroup.js';
import RefereeGroupUser from './refereeGroupUser.js';
import TrainingRefereeGroup from './trainingRefereeGroup.js';
import MedicalCenter from './medicalCenter.js';
import MedicalExam from './medicalExam.js';
import MedicalExamRegistration from './medicalExamRegistration.js';
import TrainingRegistration from './trainingRegistration.js';
import TrainingRole from './trainingRole.js';

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
User.hasOne(MedicalCertificate, { foreignKey: 'user_id' });
MedicalCertificate.belongsTo(User, { foreignKey: 'user_id' });
MedicalCertificate.hasMany(MedicalCertificateFile, {
  foreignKey: 'medical_certificate_id',
});
MedicalCertificateFile.belongsTo(MedicalCertificate, {
  foreignKey: 'medical_certificate_id',
});
MedicalCertificateFile.belongsTo(File, { foreignKey: 'file_id' });
File.hasMany(MedicalCertificateFile, { foreignKey: 'file_id' });
MedicalCertificateType.hasMany(MedicalCertificateFile, {
  foreignKey: 'type_id',
});
MedicalCertificateFile.belongsTo(MedicalCertificateType, {
  foreignKey: 'type_id',
});
User.hasOne(Taxation, { foreignKey: 'user_id' });
Taxation.belongsTo(User, { foreignKey: 'user_id' });
TaxationType.hasMany(Taxation, { foreignKey: 'taxation_type_id' });
Taxation.belongsTo(TaxationType, { foreignKey: 'taxation_type_id' });

/* addresses */
User.hasMany(UserAddress, { foreignKey: 'user_id' });
UserAddress.belongsTo(User, { foreignKey: 'user_id' });
Address.hasMany(UserAddress, { foreignKey: 'address_id' });
UserAddress.belongsTo(Address, { foreignKey: 'address_id' });
AddressType.hasMany(UserAddress, { foreignKey: 'address_type_id' });
UserAddress.belongsTo(AddressType, { foreignKey: 'address_type_id' });

/* camp stadiums */
CampStadium.belongsTo(Address, { foreignKey: 'address_id' });
Address.hasMany(CampStadium, { foreignKey: 'address_id' });
CampStadium.belongsToMany(ParkingType, {
  through: CampStadiumParkingType,
  foreignKey: 'camp_stadium_id',
});
ParkingType.belongsToMany(CampStadium, {
  through: CampStadiumParkingType,
  foreignKey: 'parking_type_id',
});
CampStadium.hasMany(CampStadiumParkingType, { foreignKey: 'camp_stadium_id' });
CampStadiumParkingType.belongsTo(CampStadium, {
  foreignKey: 'camp_stadium_id',
});
ParkingType.hasMany(CampStadiumParkingType, { foreignKey: 'parking_type_id' });
CampStadiumParkingType.belongsTo(ParkingType, {
  foreignKey: 'parking_type_id',
});

/* trainings */
TrainingType.hasMany(Training, { foreignKey: 'type_id' });
Training.belongsTo(TrainingType, { foreignKey: 'type_id' });
CampStadium.hasMany(Training, { foreignKey: 'camp_stadium_id' });
Training.belongsTo(CampStadium, { foreignKey: 'camp_stadium_id' });
Season.hasMany(Training, { foreignKey: 'season_id' });
Training.belongsTo(Season, { foreignKey: 'season_id' });
Training.belongsToMany(RefereeGroup, {
  through: TrainingRefereeGroup,
  foreignKey: 'training_id',
});
RefereeGroup.belongsToMany(Training, {
  through: TrainingRefereeGroup,
  foreignKey: 'group_id',
});
Training.hasMany(TrainingRefereeGroup, { foreignKey: 'training_id' });
TrainingRefereeGroup.belongsTo(Training, { foreignKey: 'training_id' });
RefereeGroup.hasMany(TrainingRefereeGroup, { foreignKey: 'group_id' });
TrainingRefereeGroup.belongsTo(RefereeGroup, { foreignKey: 'group_id' });
Season.hasMany(RefereeGroup, { foreignKey: 'season_id' });
RefereeGroup.belongsTo(Season, { foreignKey: 'season_id' });
Training.hasMany(TrainingRegistration, { foreignKey: 'training_id' });
TrainingRegistration.belongsTo(Training, { foreignKey: 'training_id' });
User.hasMany(TrainingRegistration, { foreignKey: 'user_id' });
TrainingRegistration.belongsTo(User, { foreignKey: 'user_id' });
TrainingRole.hasMany(TrainingRegistration, { foreignKey: 'training_role_id' });
TrainingRegistration.belongsTo(TrainingRole, {
  foreignKey: 'training_role_id',
});
User.belongsToMany(RefereeGroup, {
  through: RefereeGroupUser,
  foreignKey: 'user_id',
});
RefereeGroup.belongsToMany(User, {
  through: RefereeGroupUser,
  foreignKey: 'group_id',
});
RefereeGroup.hasMany(RefereeGroupUser, { foreignKey: 'group_id' });
RefereeGroupUser.belongsTo(RefereeGroup, { foreignKey: 'group_id' });
User.hasOne(RefereeGroupUser, { foreignKey: 'user_id' });
RefereeGroupUser.belongsTo(User, { foreignKey: 'user_id' });

/* medical centers */
MedicalCenter.belongsTo(Address, { foreignKey: 'address_id' });
Address.hasMany(MedicalCenter, { foreignKey: 'address_id' });
MedicalCenter.hasMany(MedicalExam, { foreignKey: 'medical_center_id' });
MedicalExam.belongsTo(MedicalCenter, { foreignKey: 'medical_center_id' });
MedicalExam.hasMany(MedicalExamRegistration, { foreignKey: 'medical_exam_id' });
MedicalExamRegistration.belongsTo(MedicalExam, {
  foreignKey: 'medical_exam_id',
});
User.hasMany(MedicalExamRegistration, { foreignKey: 'user_id' });
MedicalExamRegistration.belongsTo(User, { foreignKey: 'user_id' });

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
  AddressType,
  Address,
  UserAddress,
  MedicalCertificate,
  ParkingType,
  CampStadium,
  CampStadiumParkingType,
  TrainingType,
  Training,
  Season,
  RefereeGroup,
  RefereeGroupUser,
  TrainingRefereeGroup,
  File,
  MedicalCertificateType,
  MedicalCertificateFile,
  MedicalCenter,
  MedicalExam,
  MedicalExamRegistration,
  TrainingRole,
  TrainingRegistration,
};
