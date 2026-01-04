const SPORT_SCHOOL_MANAGER_POSITIONS = Object.freeze([
  'DIRECTOR',
  'ADMINISTRATOR',
  'METHODIST',
  'ACCOUNTANT',
]);

const SPORT_SCHOOL_CLUB_WIDE_POSITIONS = Object.freeze([
  ...SPORT_SCHOOL_MANAGER_POSITIONS,
  'MEDIA_MANAGER',
]);

const SPORT_SCHOOL_TEAM_POSITIONS = Object.freeze(['COACH']);

const SPORT_SCHOOL_EDITABLE_POSITIONS = Object.freeze([
  'ACCOUNTANT',
  'COACH',
  'MEDIA_MANAGER',
]);

function normalizeSportSchoolPosition(alias) {
  if (!alias) return '';
  return String(alias).trim().toUpperCase();
}

function isSportSchoolManagerPosition(alias) {
  const normalized = normalizeSportSchoolPosition(alias);
  return SPORT_SCHOOL_MANAGER_POSITIONS.includes(normalized);
}

function isSportSchoolClubWidePosition(alias) {
  const normalized = normalizeSportSchoolPosition(alias);
  return SPORT_SCHOOL_CLUB_WIDE_POSITIONS.includes(normalized);
}

function isSportSchoolTeamPosition(alias) {
  const normalized = normalizeSportSchoolPosition(alias);
  return SPORT_SCHOOL_TEAM_POSITIONS.includes(normalized);
}

function isSportSchoolEditablePosition(alias) {
  const normalized = normalizeSportSchoolPosition(alias);
  return SPORT_SCHOOL_EDITABLE_POSITIONS.includes(normalized);
}

export {
  SPORT_SCHOOL_MANAGER_POSITIONS,
  SPORT_SCHOOL_CLUB_WIDE_POSITIONS,
  SPORT_SCHOOL_TEAM_POSITIONS,
  SPORT_SCHOOL_EDITABLE_POSITIONS,
  normalizeSportSchoolPosition,
  isSportSchoolManagerPosition,
  isSportSchoolClubWidePosition,
  isSportSchoolTeamPosition,
  isSportSchoolEditablePosition,
};
