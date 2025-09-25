// Centralized client-side role groups to keep visibility rules consistent
// with server-side semantics. Mirrors src/utils/roles.js on the backend.

export type Role = string;

export const ADMINISTRATOR_ROLES: Role[] = ['ADMIN'];

export const ADMIN_ROLES: Role[] = [
  ...ADMINISTRATOR_ROLES,
  'FIELD_REFEREE_SPECIALIST',
  'BRIGADE_REFEREE_SPECIALIST',
];

export const REFEREE_ROLES: Role[] = ['REFEREE', 'BRIGADE_REFEREE'];

// For features available only to field referees
export const FIELD_REFEREE_ROLES: Role[] = ['REFEREE'];

export const BRIGADE_REFEREE_ROLES: Role[] = ['BRIGADE_REFEREE'];

// Staff of a sports school
export const STAFF_ROLES: Role[] = ['SPORT_SCHOOL_STAFF'];

// Federation staff roles
export const FHMO_STAFF_ROLES: Role[] = [
  'FHMO_JUDGING_HEAD',
  'FHMO_JUDGING_LEAD_SPECIALIST',
  'FHMO_JUDGING_SPECIALIST',
  'FHMO_JUDGING_TRAINING_CURATOR',
  'FHMO_COMPETITIONS_HEAD',
  'FHMO_COMPETITIONS_LEAD_SPECIALIST',
  'FHMO_COMPETITIONS_SPECIALIST',
  'FHMO_MEDIA_PRESS_SECRETARY',
  'FHMO_MEDIA_SMM_MANAGER',
  'FHMO_MEDIA_CONTENT_MODERATOR',
  'FHMO_LEGAL_LAWYER',
  'FHMO_ACCOUNTING_CHIEF_ACCOUNTANT',
  'FHMO_ADMINISTRATION_PRESIDENT',
  'FHMO_ADMINISTRATION_EXECUTIVE_DIRECTOR',
];

// Focused subset for media and content operations within FHMO
export const FHMO_MEDIA_CONTENT_ROLES: Role[] = ['FHMO_MEDIA_CONTENT_MODERATOR'];

type RoleInput = readonly Role[] | undefined | null;

export function hasRole(roles: RoleInput, allowed: readonly Role[]): boolean {
  return (roles || []).some((r) => allowed.includes(r));
}

export function isBrigadeRefereeOnly(roles: RoleInput): boolean {
  const list = roles || [];
  return list.includes('BRIGADE_REFEREE') && !list.includes('REFEREE');
}

export function isStaffOnly(roles: RoleInput): boolean {
  const list = roles || [];
  const hasStaff = list.includes('SPORT_SCHOOL_STAFF');
  if (!hasStaff) return false;
  return list.every((alias) => STAFF_ROLES.includes(alias));
}

export function isFhmoStaffOnly(roles: RoleInput): boolean {
  const list = roles || [];
  const hasFhmo = list.some((alias) => FHMO_STAFF_ROLES.includes(alias));
  if (!hasFhmo) return false;
  return list.every((alias) => FHMO_STAFF_ROLES.includes(alias));
}
