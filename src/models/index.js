import { DataTypes } from 'sequelize';

import sequelize from '../config/database.js';

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
import Ground from './ground.js';
import TrainingType from './trainingType.js';
import Training from './training.js';
import Season from './season.js';
import RefereeGroup from './refereeGroup.js';
import RefereeGroupUser from './refereeGroupUser.js';
import TrainingRefereeGroup from './trainingRefereeGroup.js';
import Course from './course.js';
import UserCourse from './userCourse.js';
import TrainingCourse from './trainingCourse.js';
import MedicalCenter from './medicalCenter.js';
import MedicalExam from './medicalExam.js';
import MedicalExamRegistration from './medicalExamRegistration.js';
import MedicalExamRegistrationStatus from './medicalExamRegistrationStatus.js';
import TrainingRegistration from './trainingRegistration.js';
import TrainingRole from './trainingRole.js';
import Sex from './sex.js';
import NormativeValueType from './normativeValueType.js';
import MeasurementUnit from './measurementUnit.js';
import NormativeZone from './normativeZone.js';
import NormativeGroup from './normativeGroup.js';
import NormativeType from './normativeType.js';
import NormativeTypeZone from './normativeTypeZone.js';
import NormativeGroupType from './normativeGroupType.js';
import NormativeResult from './normativeResult.js';
import NormativeTicket from './normativeTicket.js';
import TaskType from './taskType.js';
import TaskStatus from './taskStatus.js';
import Task from './task.js';
import TicketType from './ticketType.js';
import TicketStatus from './ticketStatus.js';
import Ticket from './ticket.js';
import TicketFile from './ticketFile.js';

/* 1-ко-многим: статус → пользователи */
UserStatus.hasMany(User, { foreignKey: 'status_id' });
User.belongsTo(UserStatus, { foreignKey: 'status_id' });

/* sex → users */
Sex.hasMany(User, { foreignKey: 'sex_id' });
User.belongsTo(Sex, { foreignKey: 'sex_id' });

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

/* grounds */
Ground.belongsTo(Address, { foreignKey: 'address_id' });
Address.hasMany(Ground, { foreignKey: 'address_id' });

/* trainings */
TrainingType.hasMany(Training, { foreignKey: 'type_id' });
Training.belongsTo(TrainingType, { foreignKey: 'type_id' });
Ground.hasMany(Training, { foreignKey: 'ground_id' });
Training.belongsTo(Ground, { foreignKey: 'ground_id' });
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

Training.belongsToMany(Course, {
  through: TrainingCourse,
  foreignKey: 'training_id',
});
Course.belongsToMany(Training, {
  through: TrainingCourse,
  foreignKey: 'course_id',
});
Training.hasMany(TrainingCourse, { foreignKey: 'training_id' });
TrainingCourse.belongsTo(Training, { foreignKey: 'training_id' });
Course.hasMany(TrainingCourse, { foreignKey: 'course_id' });
TrainingCourse.belongsTo(Course, { foreignKey: 'course_id' });

/* courses */
Course.belongsTo(User, { foreignKey: 'responsible_id', as: 'Responsible' });
User.hasMany(Course, {
  foreignKey: 'responsible_id',
  as: 'ResponsibleCourses',
});
Course.belongsToMany(User, { through: UserCourse, foreignKey: 'course_id' });
User.belongsToMany(Course, { through: UserCourse, foreignKey: 'user_id' });
Course.hasMany(UserCourse, { foreignKey: 'course_id' });
UserCourse.belongsTo(Course, { foreignKey: 'course_id' });
User.hasOne(UserCourse, { foreignKey: 'user_id' });
UserCourse.belongsTo(User, { foreignKey: 'user_id' });

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
MedicalExamRegistrationStatus.hasMany(MedicalExamRegistration, {
  foreignKey: 'status_id',
});
MedicalExamRegistration.belongsTo(MedicalExamRegistrationStatus, {
  foreignKey: 'status_id',
});

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

/* tasks */
TaskType.hasMany(Task, { foreignKey: 'type_id' });
Task.belongsTo(TaskType, { foreignKey: 'type_id' });
TaskStatus.hasMany(Task, { foreignKey: 'status_id' });
Task.belongsTo(TaskStatus, { foreignKey: 'status_id' });
User.hasMany(Task, { foreignKey: 'user_id' });
Task.belongsTo(User, { foreignKey: 'user_id' });

/* tickets */
TicketType.hasMany(Ticket, { foreignKey: 'type_id' });
Ticket.belongsTo(TicketType, { foreignKey: 'type_id' });
TicketStatus.hasMany(Ticket, { foreignKey: 'status_id' });
Ticket.belongsTo(TicketStatus, { foreignKey: 'status_id' });
User.hasMany(Ticket, { foreignKey: 'user_id' });
Ticket.belongsTo(User, { foreignKey: 'user_id' });
Ticket.hasMany(TicketFile, { foreignKey: 'ticket_id' });
TicketFile.belongsTo(Ticket, { foreignKey: 'ticket_id' });
File.hasMany(TicketFile, { foreignKey: 'file_id' });
TicketFile.belongsTo(File, { foreignKey: 'file_id' });

/* normatives */
NormativeValueType.hasMany(NormativeType, { foreignKey: 'value_type_id' });
NormativeType.belongsTo(NormativeValueType, { foreignKey: 'value_type_id' });
MeasurementUnit.hasMany(NormativeType, { foreignKey: 'unit_id' });
NormativeType.belongsTo(MeasurementUnit, { foreignKey: 'unit_id' });
NormativeType.belongsToMany(NormativeGroup, {
  through: NormativeGroupType,
  foreignKey: 'type_id',
});
NormativeGroup.belongsToMany(NormativeType, {
  through: NormativeGroupType,
  foreignKey: 'group_id',
});
NormativeType.hasMany(NormativeGroupType, { foreignKey: 'type_id' });
NormativeGroupType.belongsTo(NormativeType, { foreignKey: 'type_id' });
NormativeGroup.hasMany(NormativeGroupType, { foreignKey: 'group_id' });
NormativeGroupType.belongsTo(NormativeGroup, { foreignKey: 'group_id' });
Season.hasMany(NormativeGroup, { foreignKey: 'season_id' });
NormativeGroup.belongsTo(Season, { foreignKey: 'season_id' });
Season.hasMany(NormativeType, { foreignKey: 'season_id' });
NormativeType.belongsTo(Season, { foreignKey: 'season_id' });
Season.hasMany(NormativeTypeZone, { foreignKey: 'season_id' });
NormativeTypeZone.belongsTo(Season, { foreignKey: 'season_id' });
NormativeType.hasMany(NormativeTypeZone, { foreignKey: 'normative_type_id' });
NormativeTypeZone.belongsTo(NormativeType, { foreignKey: 'normative_type_id' });
NormativeZone.hasMany(NormativeTypeZone, { foreignKey: 'zone_id' });
NormativeTypeZone.belongsTo(NormativeZone, { foreignKey: 'zone_id' });
Sex.hasMany(NormativeTypeZone, { foreignKey: 'sex_id' });
NormativeTypeZone.belongsTo(Sex, { foreignKey: 'sex_id' });
User.hasMany(NormativeResult, { foreignKey: 'user_id' });
NormativeResult.belongsTo(User, { foreignKey: 'user_id' });
Season.hasMany(NormativeResult, { foreignKey: 'season_id' });
NormativeResult.belongsTo(Season, { foreignKey: 'season_id' });
Training.hasMany(NormativeResult, { foreignKey: 'training_id' });
NormativeResult.belongsTo(Training, { foreignKey: 'training_id' });
NormativeType.hasMany(NormativeResult, { foreignKey: 'type_id' });
NormativeResult.belongsTo(NormativeType, { foreignKey: 'type_id' });
NormativeValueType.hasMany(NormativeResult, { foreignKey: 'value_type_id' });
NormativeResult.belongsTo(NormativeValueType, { foreignKey: 'value_type_id' });
MeasurementUnit.hasMany(NormativeResult, { foreignKey: 'unit_id' });
NormativeResult.belongsTo(MeasurementUnit, { foreignKey: 'unit_id' });
NormativeZone.hasMany(NormativeResult, { foreignKey: 'zone_id' });
NormativeResult.belongsTo(NormativeZone, { foreignKey: 'zone_id' });

/* normative tickets */
NormativeType.hasMany(NormativeTicket, { foreignKey: 'type_id' });
NormativeTicket.belongsTo(NormativeType, { foreignKey: 'type_id' });
User.hasMany(NormativeTicket, { foreignKey: 'user_id' });
NormativeTicket.belongsTo(User, { foreignKey: 'user_id' });
Season.hasMany(NormativeTicket, { foreignKey: 'season_id' });
NormativeTicket.belongsTo(Season, { foreignKey: 'season_id' });
Ticket.hasOne(NormativeTicket, { foreignKey: 'ticket_id' });
NormativeTicket.belongsTo(Ticket, { foreignKey: 'ticket_id' });
NormativeResult.hasOne(NormativeTicket, { foreignKey: 'normative_result_id' });
NormativeTicket.belongsTo(NormativeResult, {
  foreignKey: 'normative_result_id',
});

// models that don't have standard audit columns
const auditExclude = ['Log', 'EmailCode'];
for (const model of Object.values(sequelize.models)) {
  if (!auditExclude.includes(model.name)) {
    model.rawAttributes.created_by = { type: DataTypes.UUID };
    model.rawAttributes.updated_by = { type: DataTypes.UUID };
    model.refreshAttributes();
  }
}

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
  Ground,
  TrainingType,
  Training,
  Season,
  RefereeGroup,
  RefereeGroupUser,
  TrainingRefereeGroup,
  TrainingCourse,
  File,
  MedicalCertificateType,
  MedicalCertificateFile,
  MedicalCenter,
  MedicalExam,
  MedicalExamRegistration,
  MedicalExamRegistrationStatus,
  TrainingRole,
  TrainingRegistration,
  Sex,
  Task,
  TaskType,
  TaskStatus,
  Ticket,
  TicketType,
  TicketStatus,
  TicketFile,
  Course,
  UserCourse,
  NormativeValueType,
  MeasurementUnit,
  NormativeZone,
  NormativeGroup,
  NormativeType,
  NormativeTypeZone,
  NormativeGroupType,
  NormativeResult,
  NormativeTicket,
};
