export const SPORT_SCHOOL_MANAGER_POSITIONS = [
  'DIRECTOR',
  'ADMINISTRATOR',
  'METHODIST',
  'ACCOUNTANT',
];

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

export function isSportSchoolEditablePosition(alias?: string | null): boolean {
  const normalized = normalizeSportSchoolPosition(alias);
  return SPORT_SCHOOL_EDITABLE_POSITIONS.includes(normalized);
}
