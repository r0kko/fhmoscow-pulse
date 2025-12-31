const SPORT_SCHOOL_MANAGER_POSITIONS = Object.freeze([
  'DIRECTOR',
  'ADMINISTRATOR',
  'METHODIST',
  'ACCOUNTANT',
]);

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

function isSportSchoolEditablePosition(alias) {
  const normalized = normalizeSportSchoolPosition(alias);
  return SPORT_SCHOOL_EDITABLE_POSITIONS.includes(normalized);
}

export {
  SPORT_SCHOOL_MANAGER_POSITIONS,
  SPORT_SCHOOL_EDITABLE_POSITIONS,
  normalizeSportSchoolPosition,
  isSportSchoolManagerPosition,
  isSportSchoolEditablePosition,
};
