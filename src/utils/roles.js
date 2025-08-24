export const ADMINISTRATOR_ROLES = ['ADMIN'];

export const ADMIN_ROLES = [
  ...ADMINISTRATOR_ROLES,
  'FIELD_REFEREE_SPECIALIST',
  'BRIGADE_REFEREE_SPECIALIST',
];

export const REFEREE_ROLES = ['REFEREE', 'BRIGADE_REFEREE'];

// For endpoints and features available only to field referees
export const FIELD_REFEREE_ROLES = ['REFEREE'];

export const BRIGADE_REFEREE_ROLES = ['BRIGADE_REFEREE'];

// Staff of a sports school
export const STAFF_ROLES = ['SPORT_SCHOOL_STAFF'];

export function hasRole(roles, allowed) {
  return roles.some((r) => allowed.includes(r.alias ?? r));
}

export function hasAdminRole(roles) {
  return hasRole(roles, ADMIN_ROLES);
}

export function hasRefereeRole(roles) {
  return hasRole(roles, REFEREE_ROLES);
}

export function hasFieldRefereeRole(roles) {
  return hasRole(roles, FIELD_REFEREE_ROLES);
}

export function isBrigadeRefereeOnly(roles) {
  const list = roles.map((r) => r.alias ?? r);
  return list.includes('BRIGADE_REFEREE') && !list.includes('REFEREE');
}

export function hasStaffRole(roles) {
  return hasRole(roles, STAFF_ROLES);
}

export function isStaffOnly(roles) {
  const list = roles.map((r) => r.alias ?? r);
  const hasStaff = list.includes('SPORT_SCHOOL_STAFF');
  if (!hasStaff) return false;
  // Only staff role, no other roles
  return list.every((alias) => STAFF_ROLES.includes(alias));
}
