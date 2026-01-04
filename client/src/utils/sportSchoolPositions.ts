export const SPORT_SCHOOL_MANAGER_POSITIONS = [
  'DIRECTOR',
  'ADMINISTRATOR',
  'METHODIST',
  'ACCOUNTANT',
];

export const SPORT_SCHOOL_CLUB_WIDE_POSITIONS = [
  ...SPORT_SCHOOL_MANAGER_POSITIONS,
  'MEDIA_MANAGER',
];

export const SPORT_SCHOOL_TEAM_POSITIONS = ['COACH'];

export const SPORT_SCHOOL_EDITABLE_POSITIONS = [
  'ACCOUNTANT',
  'COACH',
  'MEDIA_MANAGER',
];

export function normalizeSportSchoolPosition(alias?: string | null): string {
  if (!alias) return '';
  return String(alias).trim().toUpperCase();
}

export function isSportSchoolManagerPosition(alias?: string | null): boolean {
  const normalized = normalizeSportSchoolPosition(alias);
  return SPORT_SCHOOL_MANAGER_POSITIONS.includes(normalized);
}

export function isSportSchoolClubWidePosition(alias?: string | null): boolean {
  const normalized = normalizeSportSchoolPosition(alias);
  return SPORT_SCHOOL_CLUB_WIDE_POSITIONS.includes(normalized);
}

export function isSportSchoolTeamPosition(alias?: string | null): boolean {
  const normalized = normalizeSportSchoolPosition(alias);
  return SPORT_SCHOOL_TEAM_POSITIONS.includes(normalized);
}

export function isSportSchoolEditablePosition(alias?: string | null): boolean {
  const normalized = normalizeSportSchoolPosition(alias);
  return SPORT_SCHOOL_EDITABLE_POSITIONS.includes(normalized);
}
