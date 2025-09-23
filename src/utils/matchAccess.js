import { Op } from 'sequelize';

import ServiceError from '../errors/ServiceError.js';
import {
  Match,
  Team,
  User,
  Role,
  UserClub,
  SportSchoolPosition,
} from '../models/index.js';

import { hasAdminRole, hasStaffRole } from './roles.js';

export const STAFF_POSITIONS = Object.freeze({
  COACH: 'COACH',
  ACCOUNTANT: 'ACCOUNTANT',
  MEDIA_MANAGER: 'MEDIA_MANAGER',
});

const AGREEMENT_RESTRICTED_POSITIONS = new Set([
  STAFF_POSITIONS.COACH,
  STAFF_POSITIONS.ACCOUNTANT,
  STAFF_POSITIONS.MEDIA_MANAGER,
]);

const LINEUP_RESTRICTED_POSITIONS = new Set([
  STAFF_POSITIONS.ACCOUNTANT,
  STAFF_POSITIONS.MEDIA_MANAGER,
]);

function normalizePosition(alias) {
  if (!alias) return null;
  return String(alias).toUpperCase();
}

function mergeClubIdsFromUserTeams(userTeams = []) {
  const map = new Map();
  for (const team of userTeams) {
    if (!team || !team.id) continue;
    const clubId = team.club_id || null;
    if (clubId) map.set(String(team.id), clubId);
  }
  return map;
}

function extractPositionsByClub(userClubs = []) {
  const map = new Map();
  for (const membership of userClubs) {
    if (!membership || !membership.club_id) continue;
    const alias = normalizePosition(
      membership.SportSchoolPosition?.alias || membership.position_alias
    );
    if (alias) map.set(membership.club_id, alias);
  }
  return map;
}

async function ensureTeamClubIds(match, clubByTeamId, teamIdsToFetch) {
  if (!Array.isArray(teamIdsToFetch) || teamIdsToFetch.length === 0) return;
  const teams = await Team.findAll({
    where: { id: { [Op.in]: teamIdsToFetch } },
    attributes: ['id', 'club_id'],
  });
  for (const team of teams || []) {
    if (!team || !team.id) continue;
    if (team.club_id) clubByTeamId.set(String(team.id), team.club_id);
  }
  // Try to reuse preloaded associations from match object as a last resort
  try {
    if (!match) return;
    const maybeTeams = [match.HomeTeam, match.AwayTeam];
    for (const t of maybeTeams) {
      if (!t || !t.id || !t.club_id) continue;
      clubByTeamId.set(String(t.id), t.club_id);
    }
  } catch {
    /* ignore */
  }
}

export async function resolveMatchAccessContext({ matchOrId, userId }) {
  if (!userId) throw new ServiceError('user_not_found', 404);

  let match = matchOrId || null;
  if (!match || typeof match !== 'object') {
    match = await Match.findByPk(matchOrId, {
      attributes: ['id', 'team1_id', 'team2_id'],
      include: [
        { model: Team, as: 'HomeTeam', attributes: ['id', 'club_id'] },
        { model: Team, as: 'AwayTeam', attributes: ['id', 'club_id'] },
      ],
    });
  }
  if (!match) throw new ServiceError('match_not_found', 404);

  let team1Id = match.team1_id ?? null;
  let team2Id = match.team2_id ?? null;

  if ((team1Id == null || team2Id == null) && match.id) {
    try {
      const minimal = await Match.findByPk(match.id, {
        attributes: ['id', 'team1_id', 'team2_id'],
      });
      if (minimal) {
        if (team1Id == null) team1Id = minimal.team1_id ?? team1Id;
        if (team2Id == null) team2Id = minimal.team2_id ?? team2Id;
        try {
          if (match.team1_id == null) match.team1_id = team1Id;
        } catch {
          try {
            Object.defineProperty(match, 'team1_id', {
              value: team1Id,
              enumerable: true,
              writable: true,
              configurable: true,
            });
          } catch {
            /* ignore */
          }
        }
        try {
          if (match.team2_id == null) match.team2_id = team2Id;
        } catch {
          try {
            Object.defineProperty(match, 'team2_id', {
              value: team2Id,
              enumerable: true,
              writable: true,
              configurable: true,
            });
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* ignore re-fetch failures */
    }
  }

  const user = await User.findByPk(userId, {
    include: [
      {
        model: Team,
        attributes: ['id', 'club_id'],
        through: { attributes: [] },
        required: false,
      },
      {
        model: Role,
        attributes: ['alias'],
        through: { attributes: [] },
        required: false,
      },
      {
        model: UserClub,
        attributes: ['club_id', 'sport_school_position_id'],
        include: [
          {
            model: SportSchoolPosition,
            as: 'SportSchoolPosition',
            attributes: ['alias'],
            required: false,
          },
        ],
        required: false,
      },
    ],
  });
  if (!user) throw new ServiceError('user_not_found', 404);

  const userTeams = user.Teams || [];
  const teamIds = new Set(userTeams.map((t) => t.id));

  let isHome = false;
  let isAway = false;
  if (team1Id) isHome = teamIds.has(team1Id);
  if (team2Id) isAway = teamIds.has(team2Id);

  const clubByTeamId = mergeClubIdsFromUserTeams(userTeams);
  const missingTeamIds = [];
  if (team1Id && !clubByTeamId.has(String(team1Id)))
    missingTeamIds.push(team1Id);
  if (team2Id && !clubByTeamId.has(String(team2Id)))
    missingTeamIds.push(team2Id);
  await ensureTeamClubIds(match, clubByTeamId, missingTeamIds);

  const homeClubId = clubByTeamId.get(String(team1Id)) || null;
  const awayClubId = clubByTeamId.get(String(team2Id)) || null;

  const positionByClub = extractPositionsByClub(user.UserClubs || []);
  const homePositionAlias = homeClubId
    ? positionByClub.get(homeClubId) || null
    : null;
  const awayPositionAlias = awayClubId
    ? positionByClub.get(awayClubId) || null
    : null;

  const roles = user.Roles || [];
  const isAdmin = hasAdminRole(roles);
  const hasStaff = hasStaffRole(roles);

  return {
    match,
    user,
    roles,
    isHome,
    isAway,
    isAdmin,
    hasStaff,
    homeClubId,
    awayClubId,
    homePositionAlias,
    awayPositionAlias,
  };
}

export function evaluateStaffMatchRestrictions(
  context,
  { respectAdmin = true } = {}
) {
  if (!context)
    return {
      agreementsBlocked: false,
      lineupsBlocked: false,
      activePositions: [],
    };
  const {
    roles = [],
    isHome,
    isAway,
    isAdmin,
    hasStaff,
    homePositionAlias,
    awayPositionAlias,
  } = context;

  const admin = respectAdmin ? isAdmin || hasAdminRole(roles) : false;
  const staff = hasStaff ?? hasStaffRole(roles);

  const activePositions = [];
  if (isHome && homePositionAlias) activePositions.push(homePositionAlias);
  if (isAway && awayPositionAlias) activePositions.push(awayPositionAlias);

  const agreementsBlocked =
    staff &&
    !admin &&
    activePositions.some((alias) => AGREEMENT_RESTRICTED_POSITIONS.has(alias));

  const lineupsBlocked =
    staff &&
    !admin &&
    activePositions.some((alias) => LINEUP_RESTRICTED_POSITIONS.has(alias));

  return {
    agreementsBlocked,
    lineupsBlocked,
    activePositions: Array.from(new Set(activePositions)),
  };
}

export function buildPermissionPayload(restrictions, context = null) {
  const res = restrictions || {};
  const ctx = context || {};
  return {
    agreements: {
      allowed: !res.agreementsBlocked,
      reason: res.agreementsBlocked ? 'staff_position_restricted' : null,
    },
    lineups: {
      allowed: !res.lineupsBlocked,
      reason: res.lineupsBlocked ? 'staff_position_restricted' : null,
    },
    staff_positions: {
      active: res.activePositions || [],
      home: ctx.homePositionAlias || null,
      away: ctx.awayPositionAlias || null,
    },
  };
}

export function ensureParticipantOrThrow(context) {
  if (!context) throw new ServiceError('forbidden_not_match_member', 403);
  const match = context.match || null;
  const team1 = match?.team1_id || null;
  const team2 = match?.team2_id || null;
  if (!team1 && !team2) throw new ServiceError('match_teams_not_set', 409);
  if (!context.isHome && !context.isAway)
    throw new ServiceError('forbidden_not_match_member', 403);
}
