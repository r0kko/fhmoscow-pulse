import { hasAdminRole } from '../utils/roles.js';
import { Team } from '../models/index.js';
import { isSportSchoolManagerPosition } from '../utils/sportSchoolPositions.js';
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
    let clubPositions = {};
    let managerClubIds = [];
    // Compute staff scope for any user with staff role (including admins),
    // so endpoints can honor mine=true by restricting to personal scope.
    if (isStaff) {
      const [clubs, teams] = await Promise.all([
        clubUserService.listUserClubs(req.user.id).catch(() => []),
        teamService.listUserTeams(req.user.id).catch(() => []),
      ]);
      allowedClubIds = (clubs || []).map((c) => c.id);
      allowedTeamIds = (teams || []).map((t) => t.id);
      clubPositions = (clubs || []).reduce((acc, club) => {
        if (!club?.id) return acc;
        const membership =
          typeof club.UserClub?.get === 'function'
            ? club.UserClub.get({ plain: true })
            : club.UserClub;
        const alias = membership?.SportSchoolPosition?.alias || null;
        if (alias) acc[club.id] = alias;
        return acc;
      }, {});
      managerClubIds = Object.entries(clubPositions)
        .filter(([, alias]) => isSportSchoolManagerPosition(alias))
        .map(([clubId]) => String(clubId));
      if (managerClubIds.length > 0) {
        const managerTeams = await Team.findAll({
          where: { club_id: managerClubIds },
          attributes: ['id'],
        });
        const managerTeamIds = managerTeams.map((team) => String(team.id));
        const set = new Set([
          ...allowedTeamIds.map((id) => String(id)),
          ...managerTeamIds,
        ]);
        allowedTeamIds = Array.from(set);
      }
    }

    req.access = {
      roles: roleAliases,
      isAdmin,
      isStaff,
      allowedClubIds,
      allowedTeamIds,
      clubPositions,
      managerClubIds,
    };
    return next();
  } catch (err) {
    void err;
    return res.status(500).json({ error: 'Server error' });
  }
}
