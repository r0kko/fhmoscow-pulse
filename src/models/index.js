import { DataTypes } from 'sequelize';

import sequelize from '../config/database.js';

import User from './user.js';
import Role from './role.js';
import UserRole from './userRole.js';
import UserStatus from './userStatus.js';
import Log from './log.js';
import EmailCode from './emailCode.js';
import SignType from './signType.js';
import UserSignType from './userSignType.js';
import Document from './document.js';
import DocumentUserSign from './documentUserSign.js';
import DocumentStatus from './documentStatus.js';
import DocumentType from './documentType.js';
import Country from './country.js';
import Passport from './passport.js';
import Inn from './inn.js';
import Snils from './snils.js';
import BankAccount from './bankAccount.js';
import Vehicle from './vehicle.js';
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
import Team from './team.js';
import TournamentType from './tournamentType.js';
import Tournament from './tournament.js';
import Stage from './stage.js';
import TournamentGroup from './tournamentGroup.js';
import TournamentTeam from './tournamentTeam.js';
import Tour from './tour.js';
import Match from './match.js';
import MatchBroadcastLink from './matchBroadcastLink.js';
import GameStatus from './gameStatus.js';
import UserTeam from './userTeam.js';
import UserClub from './userClub.js';
import Player from './player.js';
import PlayerRole from './playerRole.js';
import ClubPlayer from './clubPlayer.js';
import TeamPlayer from './teamPlayer.js';
import AvailabilityType from './availabilityType.js';
import UserAvailability from './userAvailability.js';
import Club from './club.js';
import Staff from './staff.js';
import StaffCategory from './staffCategory.js';
import ClubStaff from './clubStaff.js';
import TeamStaff from './teamStaff.js';
import GroundClub from './groundClub.js';
import GroundTeam from './groundTeam.js';
import MatchAgreementType from './matchAgreementType.js';
import MatchAgreementStatus from './matchAgreementStatus.js';
import MatchAgreement from './matchAgreement.js';
import JobLog from './jobLog.js';
import MatchPlayer from './matchPlayer.js';
import MatchStaff from './matchStaff.js';
import GameEventType from './gameEventType.js';
import PenaltyMinutes from './penaltyMinutes.js';
import GameSituation from './gameSituation.js';
import GameViolation from './gameViolation.js';
import GamePenalty from './gamePenalty.js';
import EquipmentType from './equipmentType.js';
import EquipmentManufacturer from './equipmentManufacturer.js';
import EquipmentSize from './equipmentSize.js';
import Equipment from './equipment.js';

/* 1-ко-многим: статус → пользователи */
UserStatus.hasMany(User, { foreignKey: 'status_id' });
User.belongsTo(UserStatus, { foreignKey: 'status_id' });

/* sex → users */
Sex.hasMany(User, { foreignKey: 'sex_id' });
User.belongsTo(Sex, { foreignKey: 'sex_id' });

/* многие-ко-многим: пользователь ↔ роли */
User.belongsToMany(Role, { through: UserRole, foreignKey: 'user_id' });
Role.belongsToMany(User, { through: UserRole, foreignKey: 'role_id' });

/* many-to-many: user ↔ teams */
User.belongsToMany(Team, { through: UserTeam, foreignKey: 'user_id' });
Team.belongsToMany(User, { through: UserTeam, foreignKey: 'team_id' });

/* many-to-many: user ↔ clubs */
User.belongsToMany(Club, { through: UserClub, foreignKey: 'user_id' });
Club.belongsToMany(User, { through: UserClub, foreignKey: 'club_id' });

/* clubs ↔ teams */
Club.hasMany(Team, { foreignKey: 'club_id' });
Team.belongsTo(Club, { foreignKey: 'club_id' });

/* grounds ↔ clubs/teams */
Ground.belongsToMany(Club, { through: GroundClub, foreignKey: 'ground_id' });
Club.belongsToMany(Ground, { through: GroundClub, foreignKey: 'club_id' });
Ground.belongsToMany(Team, { through: GroundTeam, foreignKey: 'ground_id' });
Team.belongsToMany(Ground, { through: GroundTeam, foreignKey: 'team_id' });

/* players and memberships */
Player.belongsToMany(Team, { through: TeamPlayer, foreignKey: 'player_id' });
Team.belongsToMany(Player, { through: TeamPlayer, foreignKey: 'team_id' });
Team.hasMany(TeamPlayer, { foreignKey: 'team_id' });
TeamPlayer.belongsTo(Team, { foreignKey: 'team_id' });
Player.hasMany(TeamPlayer, { foreignKey: 'player_id' });
TeamPlayer.belongsTo(Player, { foreignKey: 'player_id' });
Club.hasMany(ClubPlayer, { foreignKey: 'club_id' });
ClubPlayer.belongsTo(Club, { foreignKey: 'club_id' });
Player.belongsToMany(Club, { through: ClubPlayer, foreignKey: 'player_id' });
Club.belongsToMany(Player, { through: ClubPlayer, foreignKey: 'club_id' });
Player.hasMany(ClubPlayer, { foreignKey: 'player_id' });
ClubPlayer.belongsTo(Player, { foreignKey: 'player_id' });
PlayerRole.hasMany(ClubPlayer, { foreignKey: 'role_id' });
ClubPlayer.belongsTo(PlayerRole, { foreignKey: 'role_id' });
ClubPlayer.hasMany(TeamPlayer, { foreignKey: 'club_player_id' });
TeamPlayer.belongsTo(ClubPlayer, { foreignKey: 'club_player_id' });
Season.hasMany(ClubPlayer, { foreignKey: 'season_id' });
ClubPlayer.belongsTo(Season, { foreignKey: 'season_id' });
Season.hasMany(TeamPlayer, { foreignKey: 'season_id' });
TeamPlayer.belongsTo(Season, { foreignKey: 'season_id' });

/* staff and memberships (mirror players) */
Staff.belongsToMany(Team, { through: TeamStaff, foreignKey: 'staff_id' });
Team.belongsToMany(Staff, { through: TeamStaff, foreignKey: 'team_id' });
Team.hasMany(TeamStaff, { foreignKey: 'team_id' });
TeamStaff.belongsTo(Team, { foreignKey: 'team_id' });
Staff.hasMany(TeamStaff, { foreignKey: 'staff_id' });
TeamStaff.belongsTo(Staff, { foreignKey: 'staff_id' });
Club.hasMany(ClubStaff, { foreignKey: 'club_id' });
ClubStaff.belongsTo(Club, { foreignKey: 'club_id' });
Staff.belongsToMany(Club, { through: ClubStaff, foreignKey: 'staff_id' });
Club.belongsToMany(Staff, { through: ClubStaff, foreignKey: 'club_id' });
Staff.hasMany(ClubStaff, { foreignKey: 'staff_id' });
ClubStaff.belongsTo(Staff, { foreignKey: 'staff_id' });
StaffCategory.hasMany(ClubStaff, { foreignKey: 'category_id' });
ClubStaff.belongsTo(StaffCategory, { foreignKey: 'category_id' });
ClubStaff.hasMany(TeamStaff, { foreignKey: 'club_staff_id' });
TeamStaff.belongsTo(ClubStaff, { foreignKey: 'club_staff_id' });
Season.hasMany(ClubStaff, { foreignKey: 'season_id' });
ClubStaff.belongsTo(Season, { foreignKey: 'season_id' });
Season.hasMany(TeamStaff, { foreignKey: 'season_id' });
TeamStaff.belongsTo(Season, { foreignKey: 'season_id' });

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
User.hasMany(Vehicle, { foreignKey: 'user_id' });
Vehicle.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(UserAvailability, { foreignKey: 'user_id' });
UserAvailability.belongsTo(User, { foreignKey: 'user_id' });
AvailabilityType.hasMany(UserAvailability, { foreignKey: 'type_id' });
UserAvailability.belongsTo(AvailabilityType, { foreignKey: 'type_id' });
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
Ground.belongsTo(Address, {
  foreignKey: 'address_id',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});
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
Training.hasMany(TrainingRegistration, {
  foreignKey: 'training_id',
  as: 'TeacherRegistrations',
});
TrainingRegistration.belongsTo(Training, {
  foreignKey: 'training_id',
  as: 'TeacherTraining',
});
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

/* tournaments */
TournamentType.hasMany(Tournament, { foreignKey: 'type_id' });
Tournament.belongsTo(TournamentType, { foreignKey: 'type_id' });
Season.hasMany(Tournament, { foreignKey: 'season_id' });
Tournament.belongsTo(Season, { foreignKey: 'season_id' });

Tournament.hasMany(Stage, { foreignKey: 'tournament_id' });
Stage.belongsTo(Tournament, { foreignKey: 'tournament_id' });

Tournament.hasMany(TournamentGroup, { foreignKey: 'tournament_id' });
TournamentGroup.belongsTo(Tournament, { foreignKey: 'tournament_id' });
Stage.hasMany(TournamentGroup, { foreignKey: 'stage_id' });
TournamentGroup.belongsTo(Stage, { foreignKey: 'stage_id' });

/* tours */
Tournament.hasMany(Tour, { foreignKey: 'tournament_id' });
Tour.belongsTo(Tournament, { foreignKey: 'tournament_id' });
Stage.hasMany(Tour, { foreignKey: 'stage_id' });
Tour.belongsTo(Stage, { foreignKey: 'stage_id' });
TournamentGroup.hasMany(Tour, { foreignKey: 'tournament_group_id' });
Tour.belongsTo(TournamentGroup, { foreignKey: 'tournament_group_id' });

Tournament.hasMany(TournamentTeam, { foreignKey: 'tournament_id' });
TournamentTeam.belongsTo(Tournament, { foreignKey: 'tournament_id' });
TournamentGroup.hasMany(TournamentTeam, { foreignKey: 'tournament_group_id' });
TournamentTeam.belongsTo(TournamentGroup, {
  foreignKey: 'tournament_group_id',
});
Team.hasMany(TournamentTeam, { foreignKey: 'team_id' });
TournamentTeam.belongsTo(Team, { foreignKey: 'team_id' });

/* matches */
Tour.hasMany(Match, { foreignKey: 'tour_id' });
Match.belongsTo(Tour, { foreignKey: 'tour_id' });
Tournament.hasMany(Match, { foreignKey: 'tournament_id' });
Match.belongsTo(Tournament, { foreignKey: 'tournament_id' });
Stage.hasMany(Match, { foreignKey: 'stage_id' });
Match.belongsTo(Stage, { foreignKey: 'stage_id' });
TournamentGroup.hasMany(Match, { foreignKey: 'tournament_group_id' });
Match.belongsTo(TournamentGroup, { foreignKey: 'tournament_group_id' });
Ground.hasMany(Match, { foreignKey: 'ground_id' });
Match.belongsTo(Ground, { foreignKey: 'ground_id' });
Team.hasMany(Match, { foreignKey: 'team1_id', as: 'HomeMatches' });
Team.hasMany(Match, { foreignKey: 'team2_id', as: 'AwayMatches' });
Match.belongsTo(Team, { foreignKey: 'team1_id', as: 'HomeTeam' });
Match.belongsTo(Team, { foreignKey: 'team2_id', as: 'AwayTeam' });
Season.hasMany(Match, { foreignKey: 'season_id' });
Match.belongsTo(Season, { foreignKey: 'season_id' });
GameStatus.hasMany(Match, { foreignKey: 'game_status_id' });
Match.belongsTo(GameStatus, { foreignKey: 'game_status_id' });

// match broadcast links
Match.hasMany(MatchBroadcastLink, { foreignKey: 'match_id' });
MatchBroadcastLink.belongsTo(Match, { foreignKey: 'match_id' });

/* match players (lineups) */
Match.hasMany(MatchPlayer, { foreignKey: 'match_id' });
MatchPlayer.belongsTo(Match, { foreignKey: 'match_id' });
Team.hasMany(MatchPlayer, { foreignKey: 'team_id' });
MatchPlayer.belongsTo(Team, { foreignKey: 'team_id' });
TeamPlayer.hasMany(MatchPlayer, { foreignKey: 'team_player_id' });
MatchPlayer.belongsTo(TeamPlayer, { foreignKey: 'team_player_id' });
PlayerRole.hasMany(MatchPlayer, { foreignKey: 'role_id' });
MatchPlayer.belongsTo(PlayerRole, { foreignKey: 'role_id' });

/* match staff (representatives) */
Match.hasMany(MatchStaff, { foreignKey: 'match_id' });
MatchStaff.belongsTo(Match, { foreignKey: 'match_id' });
Team.hasMany(MatchStaff, { foreignKey: 'team_id' });
MatchStaff.belongsTo(Team, { foreignKey: 'team_id' });
TeamStaff.hasMany(MatchStaff, { foreignKey: 'team_staff_id' });
MatchStaff.belongsTo(TeamStaff, { foreignKey: 'team_staff_id' });

/* match agreements */
Match.hasMany(MatchAgreement, { foreignKey: 'match_id' });
MatchAgreement.belongsTo(Match, { foreignKey: 'match_id' });
MatchAgreementType.hasMany(MatchAgreement, { foreignKey: 'type_id' });
MatchAgreement.belongsTo(MatchAgreementType, { foreignKey: 'type_id' });
MatchAgreementStatus.hasMany(MatchAgreement, { foreignKey: 'status_id' });
MatchAgreement.belongsTo(MatchAgreementStatus, { foreignKey: 'status_id' });
User.hasMany(MatchAgreement, { foreignKey: 'author_user_id' });
MatchAgreement.belongsTo(User, { foreignKey: 'author_user_id', as: 'Author' });
Ground.hasMany(MatchAgreement, { foreignKey: 'ground_id' });
MatchAgreement.belongsTo(Ground, { foreignKey: 'ground_id' });
MatchAgreement.belongsTo(MatchAgreement, {
  foreignKey: 'parent_id',
  as: 'Parent',
});

/* game penalties (events: infractions) */
Match.hasMany(GamePenalty, { foreignKey: 'game_id' });
GamePenalty.belongsTo(Match, { foreignKey: 'game_id' });
GameEventType.hasMany(GamePenalty, { foreignKey: 'event_type_id' });
GamePenalty.belongsTo(GameEventType, { foreignKey: 'event_type_id' });
Player.hasMany(GamePenalty, { foreignKey: 'penalty_player_id' });
GamePenalty.belongsTo(Player, { foreignKey: 'penalty_player_id' });
GameViolation.hasMany(GamePenalty, { foreignKey: 'penalty_violation_id' });
GamePenalty.belongsTo(GameViolation, { foreignKey: 'penalty_violation_id' });
PenaltyMinutes.hasMany(GamePenalty, { foreignKey: 'penalty_minutes_id' });
GamePenalty.belongsTo(PenaltyMinutes, { foreignKey: 'penalty_minutes_id' });

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

/* sign types */
SignType.hasMany(UserSignType, { foreignKey: 'sign_type_id' });
UserSignType.belongsTo(SignType, { foreignKey: 'sign_type_id' });
User.hasMany(UserSignType, { foreignKey: 'user_id' });
UserSignType.belongsTo(User, { foreignKey: 'user_id' });

/* documents */
DocumentType.hasMany(Document, { foreignKey: 'document_type_id' });
Document.belongsTo(DocumentType, { foreignKey: 'document_type_id' });
SignType.hasMany(Document, { foreignKey: 'sign_type_id' });
Document.belongsTo(SignType, { foreignKey: 'sign_type_id' });
User.hasMany(Document, {
  foreignKey: 'recipient_id',
  as: 'receivedDocuments',
});
Document.belongsTo(User, {
  foreignKey: 'recipient_id',
  as: 'recipient',
});
File.hasMany(Document, { foreignKey: 'file_id' });
Document.belongsTo(File, { foreignKey: 'file_id' });
DocumentStatus.hasMany(Document, { foreignKey: 'status_id' });
Document.belongsTo(DocumentStatus, { foreignKey: 'status_id' });

Document.hasMany(DocumentUserSign, { foreignKey: 'document_id' });
DocumentUserSign.belongsTo(Document, { foreignKey: 'document_id' });
User.hasMany(DocumentUserSign, { foreignKey: 'user_id' });
DocumentUserSign.belongsTo(User, { foreignKey: 'user_id' });
SignType.hasMany(DocumentUserSign, { foreignKey: 'sign_type_id' });
DocumentUserSign.belongsTo(SignType, { foreignKey: 'sign_type_id' });

/* equipment */
EquipmentType.hasMany(Equipment, { foreignKey: 'type_id' });
Equipment.belongsTo(EquipmentType, { foreignKey: 'type_id' });
EquipmentManufacturer.hasMany(Equipment, { foreignKey: 'manufacturer_id' });
Equipment.belongsTo(EquipmentManufacturer, { foreignKey: 'manufacturer_id' });
EquipmentSize.hasMany(Equipment, { foreignKey: 'size_id' });
Equipment.belongsTo(EquipmentSize, { foreignKey: 'size_id' });
User.hasMany(Equipment, { foreignKey: 'owner_id', as: 'OwnedEquipment' });
Equipment.belongsTo(User, { foreignKey: 'owner_id', as: 'Owner' });
Document.hasMany(Equipment, {
  foreignKey: 'assignment_document_id',
  as: 'AssignedEquipment',
});
Equipment.belongsTo(Document, {
  foreignKey: 'assignment_document_id',
  as: 'AssignmentDocument',
});

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
  SignType,
  UserSignType,
  Document,
  DocumentUserSign,
  DocumentStatus,
  DocumentType,
  Country,
  Passport,
  Inn,
  Snils,
  BankAccount,
  Vehicle,
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
  Tour,
  Match,
  MatchBroadcastLink,
  GameStatus,
  MatchAgreement,
  JobLog,
  MatchAgreementType,
  MatchAgreementStatus,
  Team,
  Tournament,
  TournamentType,
  Stage,
  TournamentGroup,
  TournamentTeam,
  UserTeam,
  UserClub,
  Club,
  Player,
  PlayerRole,
  ClubPlayer,
  TeamPlayer,
  MatchPlayer,
  MatchStaff,
  GamePenalty,
  GameEventType,
  PenaltyMinutes,
  GameSituation,
  GameViolation,
  Staff,
  StaffCategory,
  ClubStaff,
  TeamStaff,
  GroundClub,
  GroundTeam,
  Course,
  UserCourse,
  AvailabilityType,
  UserAvailability,
  NormativeValueType,
  MeasurementUnit,
  NormativeZone,
  NormativeGroup,
  NormativeType,
  NormativeTypeZone,
  NormativeGroupType,
  NormativeResult,
  NormativeTicket,
  Equipment,
  EquipmentType,
  EquipmentManufacturer,
  EquipmentSize,
};
