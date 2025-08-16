import Joi from 'joi';

import { createModel } from './modelFactory.js';

// Minimal, conservative column validation. Unknown columns are allowed.
// Extend schemas per table as needed while keeping unknown(true).

const id = Joi.number().integer();
const int = Joi.number().integer();
const str = Joi.string();
const txt = Joi.string();
const dt = Joi.date();
const bool = Joi.boolean();

// Helper to build a model with a lightweight schema
function M(table, primaryKey = 'id', shape = {}) {
  const schema = Object.keys(shape).length
    ? Joi.object(shape).unknown(true)
    : null;
  return createModel({ table, primaryKey, schema });
}

// Core media/files
export const File = M('file', 'id', {
  id: id.required(),
  module: str,
  mime_type: str,
  size: int,
  name: str,
  date_create: dt,
  date_update: dt,
  object_status: str,
});

// Simple dictionaries / reference tables
export const Country = M('country', 'id', { id: id.required(), name: str });
export const City = M('city', 'id', {
  id: id.required(),
  name: str,
  country_id: int,
});
export const Sex = M('sex', 'id', { id: id.required(), name: str });
export const BannerPosition = M('banner_position', 'id', {
  id: id.required(),
  name: str,
});
export const GameEventType = M('game_event_type', 'id', {
  id: id.required(),
  name: str,
});
export const GamePeriod = M('game_period', 'id', {
  id: id.required(),
  name: str,
});
export const GameSituation = M('game_situation', 'id', {
  id: id.required(),
  name: str,
});
export const GameStatus = M('game_status', 'id', {
  id: id.required(),
  name: str,
});
export const GameViolation = M('game_violation', 'id', {
  id: id.required(),
  name: str,
  full_name: str,
});
export const OvertimeType = M('overtime_type', 'id', {
  id: id.required(),
  name: str,
});
export const PenaltyMinutes = M('penalty_minutes', 'id', {
  id: id.required(),
  name: str,
});
export const PayerType = M('payer_type', 'id', {
  id: id.required(),
  type: str,
});
export const RefereeCategory = M('referee_category', 'id', {
  id: id.required(),
  name: str,
});
export const RefereeQualification = M('referee_qualification', 'id', {
  id: id.required(),
  name: str,
});
export const RefereeQualificationHockeyLeague = M(
  'referee_qualification_hockey_league',
  'id',
  { id: id.required(), name: str }
);
export const ReportStatus = M('report_status', 'id', {
  id: id.required(),
  name: str,
});
export const Season = M('season', 'id', {
  id: id.required(),
  name: str,
  date_create: dt,
  date_update: dt,
  object_status: str,
  current: bool,
});
export const Stage = M('stage', 'id', {
  id: id.required(),
  tournament_id: int,
  name: str,
  date_create: dt,
  date_update: dt,
  object_status: str,
  play_off: bool,
  current: bool,
  transition: bool,
  play_off_bracket: int,
});
export const Tags = M('tags', 'id', {
  id: id.required(),
  name: str,
  date_create: dt,
  date_update: dt,
  object_status: str,
});

// Banners / sponsors
export const Banner = M('banner', 'id', {
  id: id.required(),
  position_id: int,
  image_id: int,
  name: str,
  site: str,
  rang: int,
  date_create: dt,
  date_update: dt,
  object_status: str,
});

export const Sponsor = M('sponsor', 'id', {
  id: id.required(),
  preview_image_id: int,
  name: str,
  text: txt,
  priority: int,
  date_create: dt,
  date_update: dt,
  object_status: str,
  site: str,
  banner_id: int,
  status: str,
  show_in_footer: bool,
});

// Stadiums / locations
export const Stadium = M('stadium', 'id', {
  id: id.required(),
  city_id: int,
  create_date: dt,
  update_date: dt,
  name: str,
  object_status: str,
  image_id: int,
});

// Media
export const Media = M('media', 'id', {
  id: id.required(),
  type: str,
  object_status: str,
  date_publication: dt,
  show_in_slider: int,
  tags: txt,
});

export const Photo = M('photo', 'id', {
  id: id.required(),
  preview_image_id: int,
  full_title: str,
  short_title: str,
  show_in_slider: bool,
  date_publication: dt,
  date_create: dt,
  date_update: dt,
  object_status: str,
  slug: str,
  description: txt,
});

export const PhotoImage = M('photo_image', 'id', {
  id: id.required(),
  file_id: int,
  photo_id: int,
  name: str,
  date_create: dt,
  date_update: dt,
  object_status: str,
  description: str,
});

export const PhotoTags = M('photo_tags', undefined, {
  photo_id: int,
  tags_id: int,
});

export const Video = M('video', 'id', {
  id: id.required(),
  preview_image_id: int,
  full_title: str,
  short_title: str,
  show_in_slider: bool,
  date_publication: dt,
  link: str,
  date_create: dt,
  date_update: dt,
  object_status: str,
  description: txt,
  slug: str,
});

export const VideoTags = M('video_tags', undefined, {
  video_id: int,
  tags_id: int,
});

// News / pages / docs
export const News = M('news', 'id', {
  id: id.required(),
  preview_image_id: int,
  full_title: txt,
  short_title: str,
  preview_text: txt,
  text: txt,
  show_in_slider: bool,
  date_publication: dt,
  date_create: dt,
  date_update: dt,
  object_status: str,
  document_id: int,
  slug: str,
});

export const NewsImage = M('news_image', 'id', {
  id: id.required(),
  file_id: int,
  news_id: int,
  name: str,
  date_create: dt,
  date_update: dt,
  object_status: str,
});
export const NewsTags = M('news_tags', undefined, {
  news_id: int,
  tags_id: int,
});

export const PageEditor = M('page_editor', 'id', {
  id: id.required(),
  title: str,
  slug: str,
  html: txt,
  date_create: dt,
  date_update: dt,
  object_status: str,
});

export const BasicDocumentParentCategory = M(
  'basic_document_parent_category',
  'id',
  {
    id: id.required(),
    name: str,
    date_create: dt,
    date_update: dt,
    object_status: str,
    rang: int,
  }
);

export const BasicDocument = M('basic_document', 'id', {
  id: id.required(),
  file_id: int,
  name: str,
  date_create: dt,
  date_update: dt,
  object_status: str,
  category_id: int,
  season_id: int,
  tournament_id: int,
  rang: int,
});

export const Document = M('document', 'id', {
  id: id.required(),
  file_id: int,
  player_id: int,
  name: str,
  date_create: dt,
  date_update: dt,
  object_status: str,
});

export const Protocol = M('protocol', 'id', {
  id: id.required(),
  file_id: int,
  game_id: int,
  date_create: dt,
  date_update: dt,
  object_status: str,
});

// Clubs / teams / players / staff
export const Club = M('club', 'id', {
  id: id.required(),
  date_create: dt,
  date_update: dt,
  full_name: str,
  short_name: str,
  address: str,
  phone: str,
  email: str,
  description: txt,
  site: str,
  object_status: str,
  logo_id: int,
  tags_id: int,
  is_moscow: bool,
  rang: int,
});

export const Team = M('team', 'id', {
  id: id.required(),
  club_id: int,
  date_create: dt,
  date_update: dt,
  full_name: str,
  short_name: str,
  address: str,
  phone: str,
  email: str,
  description: str,
  site: str,
  object_status: str,
  logo_id: int,
  stadium_id: int,
  year: int,
  tags_id: int,
});

export const Staff = M('staff', 'id', {
  id: id.required(),
  reason_for_refusal: str,
  surname: str,
  name: str,
  patronymic: str,
  date_of_birth: dt,
  email: str,
  date_create: dt,
  date_update: dt,
  object_status: str,
  photo_id: int,
  sex_id: int,
});

export const StaffCategory = M('staff_category', 'id', {
  id: id.required(),
  name: str,
  date_create: dt,
  date_update: dt,
  object_status: str,
});

export const Player = M('player', 'id', {
  id: id.required(),
  grip: str,
  height: int,
  weight: int,
  repeated: bool,
  reason_for_refusal: str,
  surname: str,
  name: str,
  patronymic: str,
  date_of_birth: dt,
  email: str,
  date_create: dt,
  date_update: dt,
  object_status: str,
  photo_id: int,
  sex_id: int,
});

export const PlayerPosition = M('player_position', 'id', {
  id: id.required(),
  name: str,
  abbreviation: str,
});

export const TeamPlayerRole = M('team_player_role', 'id', {
  id: id.required(),
  name: str,
  abbreviation: str,
});

export const ClubPlayer = M('club_player', 'id', {
  id: id.required(),
  club_id: int,
  player_id: int,
  date_create: dt,
  date_update: dt,
  object_status: str,
  role_id: int,
  photo_id: int,
  number: int,
  declared: dt,
  undeclared: dt,
  season_id: int,
});

export const TeamPlayer = M('team_player', 'id', {
  id: id.required(),
  player_id: int,
  object_status: str,
  date_create: dt,
  date_update: dt,
  team_id: int,
  contract_id: int,
});

export const ClubStaff = M('club_staff', 'id', {
  id: id.required(),
  club_id: int,
  staff_id: int,
  date_create: dt,
  date_update: dt,
  object_status: str,
  photo_id: int,
  employment: str,
  category_id: int,
  season_id: int,
});

export const TeamStaff = M('team_staff', 'id', {
  id: id.required(),
  staff_id: int,
  team_id: int,
  date_create: dt,
  date_update: dt,
  object_status: str,
  contract_id: int,
});

// Tournaments / groups / tours
export const TournamentType = M('tournament_type', 'id', {
  id: id.required(),
  date_create: dt,
  date_update: dt,
  full_name: str,
  short_name: str,
  object_status: str,
  logo_id: int,
  type: int,
  description: txt,
  double_protocol: bool,
  tags_id: int,
});

export const Tournament = M('tournament', 'id', {
  id: id.required(),
  type_id: int,
  season_id: int,
  date_create: dt,
  date_update: dt,
  full_name: str,
  short_name: str,
  date_start: dt,
  date_end: dt,
  object_status: str,
  logo_id: int,
  year_of_birth: int,
  tags_id: int,
  hide_in_main_calendar: bool,
});

// group is a reserved word; quoted by factory
export const TournamentGroup = M('group', 'id', {
  id: id.required(),
  tournament_id: int,
  date_create: dt,
  date_update: dt,
  name: str,
  object_status: str,
  stage_id: int,
  completed: bool,
});

export const Tour = M('tour', 'id', {
  id: id.required(),
  tournament_group_id: int,
  name: str,
  date_start: dt,
  date_end: dt,
  date_create: dt,
  date_update: dt,
  object_status: str,
  tournament_id: int,
});

export const TournamentTeam = M('tournament_team', 'id', {
  id: id.required(),
  tournament_id: int,
  tournament_group_id: int,
  team_id: int,
  preset_team1: bool,
  preset_team2: bool,
});

export const TournamentSetting = M('tournament_setting', 'id', {
  id: id.required(),
  tournament_type_id: int,
  tournament_id: int,
  duration_period: int,
  points_for_win: int,
  points_for_defeat: int,
  points_for_draw: int,
  points_for_shootout_win: int,
  points_for_shootout_defeat: int,
  points_for_overtime_win: int,
  points_for_overtime_defeat: int,
});

export const TournamentTable = M('tournament_table', 'id', {
  id: id.required(),
  season_id: int,
  tournament_id: int,
  tournament_group_id: int,
  game_count: int,
  win_count: int,
  tie_count: int,
  loss_count: int,
  pucks_scored: int,
  pucks_missed: int,
  pucks_difference: Joi.number(),
  score: int,
  position: int,
  team_id: int,
  win_overtime_count: int,
  lose_overtime_count: int,
  moscow_standings: bool,
});

export const CustomScore = M('custom_score', 'id', {
  id: id.required(),
  season_id: int,
  tournament_id: int,
  tournament_group_id: int,
  team_id: int,
  custom_score: int,
  moscow_standings: bool,
});

// Games
export const Game = M('game', 'id', {
  id: id.required(),
  date_create: dt,
  date_update: dt,
  date_start: dt,
  tour_id: int,
  stadium_id: int,
  object_status: str,
  team1_id: int,
  team2_id: int,
  score_team1: int,
  score_team2: int,
  broadcast: txt,
  number_viewers: int,
  number_game: int,
  status: int,
  match_number_playoff: int,
  play_off_info: str,
  shootout_score_team1: int,
  shootout_score_team2: int,
  broadcast2: txt,
  technical_defeat: bool,
  points_for_tournament_table_team1: int,
  points_for_tournament_table_team2: int,
  cancel_status: int,
});

export const GameAssignment = M('game_assignment', 'id', {
  id: id.required(),
  game_id: int,
  stadium_id: int,
  date_start: dt,
  status: int,
});

export const GameEvent = M('game_event', 'id', {
  id: id.required(),
  game_id: int,
  event_type_id: int,
  goal_author_id: int,
  goal_assistant1_id: int,
  goal_assistant2_id: int,
  goal_situation_id: int,
  shootout_player_id: int,
  penalty_player_id: int,
  penalty_violation_id: int,
  goalkeeper_team1_id: int,
  goalkeeper_team2_id: int,
  minute: int,
  second: int,
  goal_free_throw: bool,
  team_id: int,
  period: int,
  shootout_goalkeeper_id: int,
  shootout_realised: bool,
  penalty_minutes_id: int,
  penalty_finish_minute: int,
  penalty_finish_second: int,
  team_penalty: bool,
});

export const GamePlayer = M('game_player', 'id', {
  id: id.required(),
  player_id: int,
  game_id: int,
  number: int,
  position_id: int,
  role_id: int,
  team_id: int,
  lineup_number: int,
  played: bool,
  played_in_lineup: int,
});

export const GameReferee = M('game_referee', 'id', {
  id: id.required(),
  referee_id: int,
  game_id: int,
  position: str,
});

export const GameRemark = M('game_remark', 'id', {
  id: id.required(),
  game_id: int,
  type: int,
  description: txt,
});

export const GameSetting = M('game_setting', 'id', {
  id: id.required(),
  type_overtime_id: int,
  number_periods: int,
  number_timeouts: int,
  duration_timeout: int,
  duration_small_fine: int,
  duration_big_fine: int,
  duration_disciplined_fine: int,
  duration_disqualification_fine: int,
  duration_game_fine: int,
  tournament_type_id: int,
  tournament_id: int,
  game_id: int,
});

export const GameStaff = M('game_staff', 'id', {
  id: id.required(),
  game_id: int,
  staff_id: int,
  team_id: int,
  position: str,
});

// Stats and results
export const PlayerStatistic = M('player_statistic', 'id', {
  id: id.required(),
  season_id: int,
  tournament_id: int,
  team_id: int,
  player_id: int,
  game_id: int,
  goal: int,
  assist: int,
  goal_pass: int,
  penalty: int,
  missed: int,
  time: Joi.number(),
  reliability_factor: Joi.number(),
  game_time_percent: int,
  is_started: bool,
});

export const StaffStatistic = M('staff_statistic', 'id', {
  id: id.required(),
  season_id: int,
  tournament_id: int,
  team_id: int,
  staff_id: int,
  game_count: int,
  win_count: int,
  tie_count: int,
  loss_count: int,
});

export const SeasonResults = M('season_results', 'id', {
  id: id.required(),
  season_id: int,
  date: str,
  place: str,
  title: str,
  description: txt,
  date_create: dt,
  date_update: dt,
  object_status: str,
});

// Referees and related
export const Referee = M('referee', 'id', {
  id: id.required(),
  category_id: int,
  date_create: dt,
  date_update: dt,
  email: str,
  object_status: str,
  employment: str,
  reason_for_refusal: str,
  surname: str,
  name: str,
  patronymic: str,
  date_of_birth: dt,
  photo_id: int,
  sex_id: int,
  qualification_id: int,
  assigned_date: dt,
  qualification_order: str,
  qualification_hockey_league_id: int,
  phone: str,
  phone_add: str,
  telegram: str,
  height: int,
  weight: int,
  sweater_number: int,
  car: str,
  car_licence_plate: str,
  second_car: str,
  second_car_licence_plate: str,
});

export const RefereeDocument = M('referee_document', 'id', {
  id: id.required(),
  referee_id: int,
  series: str,
  number: str,
  issue_place: str,
  department_code: str,
  issue_date: dt,
  place_birth: str,
  address: str,
  registration_date: dt,
});

export const RefereeTaxation = M('referee_taxation', 'id', {
  id: id.required(),
  referee_id: int,
  payer_type_id: int,
  inn: str,
  snils: str,
  ogrnip: str,
  rs: str,
  bank: str,
  ks: str,
  bik: str,
});

export const Report = M('report', 'id', {
  id: id.required(),
  referee_id: int,
  game_id: int,
  status_id: int,
  date_send: dt,
  text: txt,
  comment: txt,
  date_create: dt,
  date_update: dt,
  object_status: str,
});

// Misc
export const Sdk = M('sdk', 'id', {
  id: id.required(),
  season_id: int,
  title: str,
  date_publication: dt,
  description: txt,
  month: int,
  date_create: dt,
  date_update: dt,
  object_status: str,
  file_id: int,
});

export const Log = M('log', 'id', {
  id: id.required(),
  user_id: int,
  datetime: dt,
  entity: str,
  action: str,
  object_id: int,
});

export const User = M('user', 'id', {
  id: id.required(),
  email: str,
  roles: txt,
  password: str,
  date_create: dt,
  surname: str,
  name: str,
  patronymic: str,
  date_of_birth: dt,
  phone: str,
  date_update: dt,
  object_status: str,
  block_reason: str,
  referee_id: int,
});

export const RefreshTokens = M('refresh_tokens', 'id', {
  id: id.required(),
  refresh_token: str,
  username: str,
  valid: dt,
});

export const MessengerMessages = M('messenger_messages', 'id', {
  id: Joi.number().integer().required(),
  queue_name: str,
  body: txt,
  headers: txt,
  created_at: dt,
  available_at: dt,
  delivered_at: dt,
});

export const DoctrineMigrationVersions = M(
  'doctrine_migration_versions',
  'version',
  {
    version: str.required(),
    executed_at: dt,
    execution_time: int,
  }
);

// Link tables (composite keys). Use listBy(field, value) instead of findById.
export const UserClub = M('user_club', undefined, {
  user_id: int,
  club_id: int,
});
export const UserTeam = M('user_team', undefined, {
  user_id: int,
  team_id: int,
});

export default {
  File,
  Country,
  City,
  Sex,
  BannerPosition,
  GameEventType,
  GamePeriod,
  GameSituation,
  GameStatus,
  GameViolation,
  OvertimeType,
  PenaltyMinutes,
  PayerType,
  RefereeCategory,
  RefereeQualification,
  RefereeQualificationHockeyLeague,
  ReportStatus,
  Season,
  Stage,
  Tags,
  Banner,
  Sponsor,
  Stadium,
  Media,
  Photo,
  PhotoImage,
  PhotoTags,
  Video,
  VideoTags,
  News,
  NewsImage,
  NewsTags,
  PageEditor,
  BasicDocumentParentCategory,
  BasicDocument,
  Document,
  Protocol,
  Club,
  Team,
  Staff,
  StaffCategory,
  Player,
  PlayerPosition,
  TeamPlayerRole,
  ClubPlayer,
  TeamPlayer,
  ClubStaff,
  TeamStaff,
  TournamentType,
  Tournament,
  TournamentGroup,
  Tour,
  TournamentTeam,
  TournamentSetting,
  TournamentTable,
  CustomScore,
  Game,
  GameAssignment,
  GameEvent,
  GamePlayer,
  GameReferee,
  GameRemark,
  GameSetting,
  GameStaff,
  PlayerStatistic,
  StaffStatistic,
  SeasonResults,
  Referee,
  RefereeDocument,
  RefereeTaxation,
  Report,
  Sdk,
  Log,
  User,
  RefreshTokens,
  MessengerMessages,
  DoctrineMigrationVersions,
  UserClub,
  UserTeam,
};
