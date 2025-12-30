export const SPORT_SCHOOL_MANAGER_POSITIONS = ['DIRECTOR', 'ADMINISTRATOR'];

export function normalizeSportSchoolPosition(alias?: string | null): string {
  if (!alias) return '';
  return String(alias).trim().toUpperCase();
}

export function isSportSchoolManagerPosition(alias?: string | null): boolean {
  const normalized = normalizeSportSchoolPosition(alias);
  return SPORT_SCHOOL_MANAGER_POSITIONS.includes(normalized);
}
