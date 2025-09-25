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

// Federation employees
export const FHMO_STAFF_ROLES = [
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

// Dedicated subset for media content operations within FHMO staff
export const FHMO_MEDIA_CONTENT_ROLES = ['FHMO_MEDIA_CONTENT_MODERATOR'];

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
  const list = (roles ?? []).map((r) => r.alias ?? r);
  const hasStaff = list.includes('SPORT_SCHOOL_STAFF');
  if (!hasStaff) return false;
  // Only staff role, no other roles
  return list.every((alias) => STAFF_ROLES.includes(alias));
}

export function hasFhmoStaffRole(roles) {
  return hasRole(roles, FHMO_STAFF_ROLES);
}

export function isFhmoStaffOnly(roles) {
  const list = (roles ?? []).map((r) => r.alias ?? r);
  const hasFhmo = list.some((alias) => FHMO_STAFF_ROLES.includes(alias));
  if (!hasFhmo) return false;
  return list.every((alias) => FHMO_STAFF_ROLES.includes(alias));
}
