import { hasAdminRole } from '../utils/roles.js';
import clubUserService from '../services/clubUserService.js';
import teamService from '../services/teamService.js';

// Attaches access scope for staff/admin to req.access
export default async function accessScope(req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Не авторизовано' });
    const roles = await req.user.getRoles({ attributes: ['alias'] });
    const roleAliases = roles.map((r) => r.alias);
    const isAdmin = hasAdminRole(roleAliases) || roleAliases.includes('ADMIN');
    const isStaff = roleAliases.includes('SPORT_SCHOOL_STAFF');

    let allowedClubIds = [];
    let allowedTeamIds = [];
    // Compute staff scope for any user with staff role (including admins),
    // so endpoints can honor mine=true by restricting to personal scope.
    if (isStaff) {
      const [clubs, teams] = await Promise.all([
        clubUserService.listUserClubs(req.user.id).catch(() => []),
        teamService.listUserTeams(req.user.id).catch(() => []),
      ]);
      allowedClubIds = (clubs || []).map((c) => c.id);
      allowedTeamIds = (teams || []).map((t) => t.id);
    }

    req.access = {
      roles: roleAliases,
      isAdmin,
      isStaff,
      allowedClubIds,
      allowedTeamIds,
    };
    return next();
  } catch (err) {
    void err;
    return res.status(500).json({ error: 'Server error' });
  }
}
