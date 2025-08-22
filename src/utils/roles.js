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
