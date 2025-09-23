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
