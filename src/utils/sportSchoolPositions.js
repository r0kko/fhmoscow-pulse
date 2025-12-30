const SPORT_SCHOOL_MANAGER_POSITIONS = Object.freeze([
  'DIRECTOR',
  'ADMINISTRATOR',
]);

function normalizeSportSchoolPosition(alias) {
  if (!alias) return '';
  return String(alias).trim().toUpperCase();
}

function isSportSchoolManagerPosition(alias) {
  const normalized = normalizeSportSchoolPosition(alias);
  return SPORT_SCHOOL_MANAGER_POSITIONS.includes(normalized);
}

export {
  SPORT_SCHOOL_MANAGER_POSITIONS,
  normalizeSportSchoolPosition,
  isSportSchoolManagerPosition,
};
