export const ADMIN_ROLES = [
  'ADMIN',
  'FIELD_REFEREE_SPECIALIST',
  'BRIGADE_REFEREE_SPECIALIST',
];
export const REFEREE_ROLES = ['REFEREE', 'BRIGADE_REFEREE'];

export function hasRole(roles, allowed) {
  return roles.some((r) => allowed.includes(r.alias ?? r));
}

export function hasAdminRole(roles) {
  return hasRole(roles, ADMIN_ROLES);
}

export function hasRefereeRole(roles) {
  return hasRole(roles, REFEREE_ROLES);
}
