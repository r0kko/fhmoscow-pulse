import { Role, UserClub, UserRole, UserTeam } from '../models/index.js';

import userService from './userService.js';

const STAFF_ROLE_ALIAS = 'SPORT_SCHOOL_STAFF';
let staffRoleIdCache = null;

async function getStaffRoleId() {
  if (staffRoleIdCache) return staffRoleIdCache;
  const role = await Role.findOne({
    where: { alias: STAFF_ROLE_ALIAS },
    attributes: ['id'],
  });
  staffRoleIdCache = role?.id || null;
  return staffRoleIdCache;
}

async function hasStaffRole(userId) {
  const roleId = await getStaffRoleId();
  if (!roleId) return false;
  const link = await UserRole.findOne({
    where: { user_id: userId, role_id: roleId },
  });
  return Boolean(link);
}

async function hasStaffLinks(userId) {
  const [clubLink, teamLink] = await Promise.all([
    UserClub.findOne({ where: { user_id: userId }, attributes: ['id'] }),
    UserTeam.findOne({ where: { user_id: userId }, attributes: ['id'] }),
  ]);
  return Boolean(clubLink || teamLink);
}

async function ensureStaffRole(userId, actorId = null) {
  const roleId = await getStaffRoleId();
  if (!roleId) return false;
  const exists = await hasStaffRole(userId);
  if (exists) return false;
  await userService.assignRole(userId, STAFF_ROLE_ALIAS, actorId);
  return true;
}

async function syncStaffRole(userId, actorId = null) {
  const roleId = await getStaffRoleId();
  if (!roleId) return null;
  const [links, role] = await Promise.all([
    hasStaffLinks(userId),
    hasStaffRole(userId),
  ]);
  if (links && !role) {
    await userService.assignRole(userId, STAFF_ROLE_ALIAS, actorId);
    return 'assigned';
  }
  if (!links && role) {
    await userService.removeRole(userId, STAFF_ROLE_ALIAS, actorId);
    return 'removed';
  }
  return null;
}

export { ensureStaffRole, syncStaffRole };
