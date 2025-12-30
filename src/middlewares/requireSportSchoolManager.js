import { Team, UserClub, SportSchoolPosition } from '../models/index.js';
import { hasAdminRole } from '../utils/roles.js';
import { isSportSchoolManagerPosition } from '../utils/sportSchoolPositions.js';

function resolveScope(req) {
  const scope = req.access || {};
  return {
    isAdmin: Boolean(scope.isAdmin),
    isStaff: Boolean(scope.isStaff),
    roles: Array.isArray(scope.roles) ? scope.roles : [],
    managerClubIds: Array.isArray(scope.managerClubIds)
      ? scope.managerClubIds
      : [],
  };
}

async function resolveClubId({ req, clubParam, teamParam }) {
  if (clubParam && req.params?.[clubParam]) {
    return { clubId: req.params[clubParam], team: null };
  }
  if (teamParam && req.params?.[teamParam]) {
    const team = await Team.findByPk(req.params[teamParam], {
      attributes: ['id', 'club_id'],
    });
    if (!team) {
      const err = new Error('team_not_found');
      err.status = 404;
      throw err;
    }
    return { clubId: team.club_id, team };
  }
  return { clubId: null, team: null };
}

async function resolveManagerAccess(userId, clubId) {
  if (!userId || !clubId) return false;
  const membership = await UserClub.findOne({
    where: { user_id: userId, club_id: clubId },
    include: [
      {
        model: SportSchoolPosition,
        as: 'SportSchoolPosition',
        attributes: ['alias'],
        required: false,
      },
    ],
  });
  const alias = membership?.SportSchoolPosition?.alias || null;
  return isSportSchoolManagerPosition(alias);
}

export default function requireSportSchoolManager({
  clubParam = 'id',
  teamParam = null,
} = {}) {
  return async function (req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'unauthorized' });
      }

      const scope = resolveScope(req);
      const isAdmin =
        scope.isAdmin || hasAdminRole(scope.roles || []) || false;
      if (isAdmin) return next();

      if (!scope.isStaff) {
        return res.status(403).json({ error: 'access_denied' });
      }

      const { clubId, team } = await resolveClubId({
        req,
        clubParam,
        teamParam,
      });
      if (!clubId) {
        return res.status(400).json({ error: 'club_required' });
      }

      if (scope.managerClubIds.includes(String(clubId))) {
        if (team) req.team = team;
        return next();
      }

      const allowed = await resolveManagerAccess(req.user.id, clubId);
      if (!allowed) {
        return res.status(403).json({ error: 'staff_position_restricted' });
      }
      if (team) req.team = team;
      return next();
    } catch (err) {
      if (err?.status) {
        return res.status(err.status).json({ error: err.message });
      }
      return res.status(500).json({ error: 'Server error' });
    }
  };
}
