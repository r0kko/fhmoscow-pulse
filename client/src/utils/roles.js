// Centralized client-side role groups to keep visibility rules consistent
// with server-side semantics. Mirrors src/utils/roles.js on the backend.

export const ADMINISTRATOR_ROLES = ['ADMIN'];

export const ADMIN_ROLES = [
  ...ADMINISTRATOR_ROLES,
  'FIELD_REFEREE_SPECIALIST',
  'BRIGADE_REFEREE_SPECIALIST',
];

export const REFEREE_ROLES = ['REFEREE', 'BRIGADE_REFEREE'];

// For features available only to field referees
export const FIELD_REFEREE_ROLES = ['REFEREE'];

export const BRIGADE_REFEREE_ROLES = ['BRIGADE_REFEREE'];

// Staff of a sports school
export const STAFF_ROLES = ['SPORT_SCHOOL_STAFF'];

export function hasRole(roles, allowed) {
  return (roles || []).some((r) => allowed.includes(r));
}

export function isBrigadeRefereeOnly(roles) {
  const list = roles || [];
  return list.includes('BRIGADE_REFEREE') && !list.includes('REFEREE');
}

export function isStaffOnly(roles) {
  const list = roles || [];
  const hasStaff = list.includes('SPORT_SCHOOL_STAFF');
  if (!hasStaff) return false;
  return list.every((alias) => STAFF_ROLES.includes(alias));
}
