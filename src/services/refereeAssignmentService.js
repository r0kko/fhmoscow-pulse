import { Op } from 'sequelize';

import sequelize from '../config/database.js';
import ServiceError from '../errors/ServiceError.js';
import { utcToMoscow } from '../utils/time.js';
import { REFEREE_ROLES } from '../utils/roles.js';
import logger from '../../logger.js';
import {
  Match,
  Team,
  Club,
  Ground,
  Tournament,
  CompetitionType,
  Stage,
  TournamentGroup,
  TournamentTeam,
  Tour,
  Season,
  Address,
  RefereeRole,
  RefereeRoleGroup,
  TournamentGroupReferee,
  MatchReferee,
  MatchRefereeStatus,
  MatchRefereeDraftClear,
  GameStatus,
  LeaguesAccess,
  User,
  Role,
  UserStatus,
} from '../models/index.js';

import { listForUsers as listAvailabilities } from './userAvailabilityService.js';
import { notifyRefereeAssignmentChanges } from './refereeAssignmentNotificationService.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DRAFT_STATUS_ALIAS = 'DRAFT';
const PUBLISHED_STATUS_ALIAS = 'PUBLISHED';
const CONFIRMED_STATUS_ALIAS = 'CONFIRMED';
const ASSIGNMENT_STATUS_ALIASES = [
  DRAFT_STATUS_ALIAS,
  PUBLISHED_STATUS_ALIAS,
  CONFIRMED_STATUS_ALIAS,
];

async function resolveAssignmentStatuses() {
  const statuses = await MatchRefereeStatus.findAll({
    where: { alias: { [Op.in]: ASSIGNMENT_STATUS_ALIASES } },
  });
  const byAlias = new Map(statuses.map((row) => [row.alias, row]));
  const draft = byAlias.get(DRAFT_STATUS_ALIAS);
  const published = byAlias.get(PUBLISHED_STATUS_ALIAS);
  const confirmed = byAlias.get(CONFIRMED_STATUS_ALIAS) || null;
  if (!draft || !published) {
    throw new ServiceError('referee_statuses_missing', 500);
  }
  return {
    draft,
    published,
    confirmed,
    ids: [draft.id, published.id, confirmed?.id].filter(Boolean),
  };
}

function normalizeDateKey(dateKey) {
  if (!dateKey) throw new ServiceError('date_required', 400);
  const value = String(dateKey).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ServiceError('invalid_date', 400);
  }
  return value;
}

function normalizeDateRangeFilter({ date, from, to } = {}) {
  if (date) {
    const normalized = normalizeDateKey(date);
    const bounds = moscowDayBounds(normalized);
    if (!bounds) throw new ServiceError('invalid_date', 400);
    return {
      fromDate: normalized,
      toDate: normalized,
      start: bounds.start,
      endExclusive: bounds.endExclusive,
    };
  }

  if (!from || !to) {
    throw new ServiceError('date_or_range_required', 400);
  }

  const normalizedFrom = normalizeDateKey(from);
  const normalizedTo = normalizeDateKey(to);
  if (normalizedFrom > normalizedTo) {
    throw new ServiceError('invalid_date_range', 400);
  }
  const startBounds = moscowDayBounds(normalizedFrom);
  const endBounds = moscowDayBounds(normalizedTo);
  if (!startBounds || !endBounds) {
    throw new ServiceError('invalid_date', 400);
  }
  return {
    fromDate: normalizedFrom,
    toDate: normalizedTo,
    start: startBounds.start,
    endExclusive: endBounds.endExclusive,
  };
}

function normalizeDateKeyFromValue(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const asDate = moscowDateKey(value);
    if (asDate) return asDate;
    return `${value.getUTCFullYear()}-${pad2(
      value.getUTCMonth() + 1
    )}-${pad2(value.getUTCDate())}`;
  }
  return String(value).trim().slice(0, 10);
}

function moscowDayBounds(dateKey) {
  const start = new Date(`${dateKey}T00:00:00+03:00`);
  if (Number.isNaN(start.getTime())) return null;
  const endExclusive = new Date(start.getTime() + DAY_MS);
  return { start, endExclusive };
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatHm(date) {
  if (!date) return null;
  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

function moscowDateKey(date) {
  const msk = utcToMoscow(date);
  if (!msk) return null;
  return msk.toISOString().slice(0, 10);
}

function buildDateKeysRange(fromDate, toDate) {
  if (!fromDate || !toDate) return [];
  const keys = [];
  let cursor = new Date(`${fromDate}T00:00:00+03:00`);
  const end = new Date(`${toDate}T00:00:00+03:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }
  while (cursor <= end) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  return keys;
}

function buildDefaultAvailabilityByDate(dateKeys = []) {
  const entry = {
    status: 'FREE',
    from_time: null,
    to_time: null,
    partial_mode: null,
    preset: true,
  };
  const map = {};
  for (const dateKey of dateKeys) {
    map[dateKey] = { ...entry };
  }
  return map;
}

function buildCompetitionAliasFilters(rawAlias) {
  const value = String(rawAlias || '').trim();
  if (!value) return [];
  const filter = resolveCompetitionFilter(value);
  return Array.isArray(filter?.aliasFilterAliases)
    ? filter.aliasFilterAliases
    : [];
}

function buildCompetitionTypeWhere(rawAlias) {
  const aliases = buildCompetitionAliasFilters(rawAlias);
  if (!aliases.length) return null;
  return {
    alias: {
      [Op.in]: aliases,
    },
  };
}

function buildCompetitionNameFallbackWhere(rawAlias) {
  const raw = String(rawAlias || '').trim();
  const filter = resolveCompetitionFilter(raw);
  return filter?.nameFilter || null;
}

const KNOWN_COMPETITION_ALIASES = new Set([
  'YOUTH',
  'AMATEUR',
  'STUDENT',
  'PRO',
  'COMMERCIAL',
]);

function resolveCompetitionFilter(rawAlias) {
  const raw = String(rawAlias || '').trim();
  if (!raw) return { hasFilter: false };

  const upper = raw.toUpperCase();
  const normalized = upper.replace(/[%_]/g, '');
  const isProLike =
    upper === 'PRO' ||
    upper === 'PROFESSIONAL' ||
    upper === 'ПРО' ||
    upper.includes('ПРОФ') ||
    upper.includes('PROF');
  if (isProLike) {
    return {
      hasFilter: true,
      strict: true,
      aliasFilterAliases: ['PRO'],
      aliasFilter: { alias: { [Op.in]: ['PRO'] } },
      nameFilter: null,
    };
  }

  if (KNOWN_COMPETITION_ALIASES.has(upper)) {
    return {
      hasFilter: true,
      strict: true,
      aliasFilterAliases: [upper],
      aliasFilter: { alias: { [Op.in]: [upper] } },
      nameFilter: null,
    };
  }

  if (normalized.length < 3) {
    return { hasFilter: true, strict: false };
  }

  return {
    hasFilter: true,
    strict: false,
    aliasFilterAliases: [],
    aliasFilter: null,
    nameFilter: {
      [Op.or]: [{ name: { [Op.iLike]: `%${normalized}%` } }],
    },
  };
}

async function resolveCompetitionTypeIds(rawAlias = '') {
  const aliasValue = String(rawAlias || '').trim() || 'PRO';
  const strictWhere = buildCompetitionTypeWhere(aliasValue);
  if (strictWhere) {
    const rows = await CompetitionType.findAll({
      where: strictWhere,
      attributes: ['id'],
    });
    if (rows.length) return rows.map((row) => row.id);
  }
  const fallbackWhere = buildCompetitionNameFallbackWhere(aliasValue);
  if (!fallbackWhere) return [];
  const fallbackRows = await CompetitionType.findAll({
    where: fallbackWhere,
    attributes: ['id'],
  });
  return fallbackRows.map((row) => row.id);
}

function moscowTodayKey() {
  return moscowDateKey(new Date());
}

function moscowTimeSeconds(date) {
  const msk = utcToMoscow(date);
  if (!msk) return null;
  return msk.getUTCHours() * 3600 + msk.getUTCMinutes() * 60;
}

function parseTimeSeconds(value) {
  if (!value) return null;
  const text = String(value).trim();
  const parts = text.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const [hourPart, minutePart, secondPart] = parts;
  if (!/^\d{1,2}$/.test(hourPart) || !/^\d{2}$/.test(minutePart)) {
    return null;
  }
  if (secondPart !== undefined && !/^\d{2}$/.test(secondPart)) return null;
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  const second = secondPart ? Number(secondPart) : 0;
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(second) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }
  return hour * 3600 + minute * 60 + second;
}

function derivePartialMode(fromTime, toTime) {
  if (fromTime && toTime) {
    const from = parseTimeSeconds(fromTime);
    const to = parseTimeSeconds(toTime);
    if (from === null || to === null) return null;
    return from > to ? 'SPLIT' : 'WINDOW';
  }
  if (toTime && !fromTime) return 'BEFORE';
  if (fromTime && !toTime) return 'AFTER';
  return null;
}

function intervalOverlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function availabilityAllowsInterval(availability, startSeconds, endSeconds) {
  if (startSeconds === null || endSeconds === null) return false;
  if (endSeconds > 24 * 3600) return false;
  if (!availability || availability.status === 'FREE') return true;
  if (availability.status === 'BUSY') return false;
  if (availability.status !== 'PARTIAL') return true;
  const from = parseTimeSeconds(availability.from_time);
  const to = parseTimeSeconds(availability.to_time);
  const mode = derivePartialMode(availability.from_time, availability.to_time);

  if (mode === 'BEFORE') return to !== null && endSeconds <= to;
  if (mode === 'AFTER') return from !== null && startSeconds >= from;
  if (mode === 'WINDOW')
    return (
      from !== null && to !== null && startSeconds >= from && endSeconds <= to
    );
  if (mode === 'SPLIT')
    return (
      from !== null && to !== null && (endSeconds <= to || startSeconds >= from)
    );

  if (from !== null && to !== null) {
    if (from > to) {
      return endSeconds <= to || startSeconds >= from;
    }
    return startSeconds >= from && endSeconds <= to;
  }
  if (from !== null) return startSeconds >= from;
  if (to !== null) return endSeconds <= to;
  return false;
}

function buildRequirements(records = []) {
  const byGroup = new Map();
  for (const row of records) {
    const role = row.RefereeRole;
    const group = role?.RefereeRoleGroup;
    if (!role || !group) continue;
    if (!byGroup.has(row.tournament_group_id)) {
      byGroup.set(row.tournament_group_id, new Map());
    }
    const groupMap = byGroup.get(row.tournament_group_id);
    if (!groupMap.has(group.id)) {
      groupMap.set(group.id, {
        id: group.id,
        name: group.name,
        sort_order: group.sort_order ?? 0,
        roles: [],
      });
    }
    const entry = groupMap.get(group.id);
    entry.roles.push({
      id: role.id,
      name: role.name,
      sort_order: role.sort_order ?? 0,
      count: row.count,
      group_id: group.id,
    });
  }

  const result = new Map();
  for (const [groupId, groups] of byGroup.entries()) {
    const list = Array.from(groups.values()).map((g) => ({
      ...g,
      roles: g.roles.sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.name.localeCompare(b.name);
      }),
    }));
    result.set(
      groupId,
      list.sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.name.localeCompare(b.name);
      })
    );
  }
  return result;
}

function normalizeMatchDuration(duration) {
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

async function resolveMatchGroupContext(matches = []) {
  const contextByMatchId = new Map();
  const unresolved = [];

  for (const match of matches) {
    const groupId = match?.TournamentGroup?.id || match?.tournament_group_id;
    if (groupId) {
      contextByMatchId.set(match.id, {
        id: groupId,
        name: match?.TournamentGroup?.name || null,
        match_duration_minutes: normalizeMatchDuration(
          match?.TournamentGroup?.match_duration_minutes
        ),
      });
      continue;
    }
    unresolved.push(match);
  }

  if (!unresolved.length) return contextByMatchId;

  const tournamentIds = Array.from(
    new Set(unresolved.map((match) => match?.tournament_id).filter(Boolean))
  );
  const teamIds = Array.from(
    new Set(
      unresolved
        .flatMap((match) => [match?.team1_id, match?.team2_id])
        .filter(Boolean)
    )
  );

  if (!tournamentIds.length || !teamIds.length) return contextByMatchId;

  const tournamentTeams = await TournamentTeam.findAll({
    where: {
      tournament_id: { [Op.in]: tournamentIds },
      team_id: { [Op.in]: teamIds },
      tournament_group_id: { [Op.ne]: null },
    },
    attributes: ['tournament_id', 'team_id', 'tournament_group_id'],
    include: [
      {
        model: TournamentGroup,
        attributes: ['id', 'name', 'match_duration_minutes'],
        required: false,
      },
    ],
  });

  const byTournamentTeamKey = new Map();
  for (const row of tournamentTeams) {
    const key = `${row.tournament_id}:${row.team_id}`;
    if (!byTournamentTeamKey.has(key)) {
      byTournamentTeamKey.set(key, row);
    }
  }

  for (const match of unresolved) {
    const homeKey = `${match.tournament_id}:${match.team1_id}`;
    const awayKey = `${match.tournament_id}:${match.team2_id}`;
    const row =
      byTournamentTeamKey.get(homeKey) || byTournamentTeamKey.get(awayKey);
    if (!row) continue;
    contextByMatchId.set(match.id, {
      id: row.tournament_group_id || row.TournamentGroup?.id || null,
      name: row.TournamentGroup?.name || null,
      match_duration_minutes: normalizeMatchDuration(
        row.TournamentGroup?.match_duration_minutes
      ),
    });
  }

  return contextByMatchId;
}

function formatMatchAssignments(records = []) {
  const byMatch = new Map();
  for (const row of records) {
    if (!byMatch.has(row.match_id)) byMatch.set(row.match_id, []);
    byMatch.get(row.match_id).push({
      id: row.id,
      status: row.MatchRefereeStatus?.alias ?? null,
      status_id: row.status_id ?? null,
      published_at: row.published_at ?? null,
      role: row.RefereeRole
        ? {
            id: row.RefereeRole.id,
            name: row.RefereeRole.name,
            group_id: row.RefereeRole.referee_role_group_id,
            group_name: row.RefereeRole.RefereeRoleGroup?.name ?? null,
          }
        : null,
      user: row.User
        ? {
            id: row.User.id,
            last_name: row.User.last_name,
            first_name: row.User.first_name,
            patronymic: row.User.patronymic,
          }
        : null,
    });
  }
  return byMatch;
}

function formatAssignmentRow(row) {
  return {
    id: row.id,
    status: row.MatchRefereeStatus?.alias ?? null,
    status_id: row.status_id ?? null,
    role: row.RefereeRole
      ? {
          id: row.RefereeRole.id,
          name: row.RefereeRole.name,
          group_id: row.RefereeRole.referee_role_group_id,
          group_name: row.RefereeRole.RefereeRoleGroup?.name ?? null,
        }
      : null,
    user: row.User
      ? {
          id: row.User.id,
          last_name: row.User.last_name,
          first_name: row.User.first_name,
          patronymic: row.User.patronymic,
        }
      : null,
  };
}

function formatAssignmentRowWithPhone(row) {
  const formatted = formatAssignmentRow(row);
  if (formatted.user) {
    formatted.user.phone = row.User?.phone ?? null;
  }
  return formatted;
}

function assignmentKey(row) {
  if (!row) return null;
  const matchId = row.match_id || row.Match?.id;
  const roleId = row.referee_role_id || row.RefereeRole?.id;
  const userId = row.user_id || row.User?.id;
  if (!matchId || !roleId || !userId) return null;
  return `${matchId}:${roleId}:${userId}`;
}

function assignmentUserId(row) {
  return row?.user_id || row?.User?.id || null;
}

function collectChangedUserIds(before = [], after = []) {
  const beforeMap = new Map();
  before.forEach((row) => {
    const key = assignmentKey(row);
    if (!key) return;
    if (!beforeMap.has(key)) beforeMap.set(key, row);
  });
  const afterMap = new Map();
  after.forEach((row) => {
    const key = assignmentKey(row);
    if (!key) return;
    if (!afterMap.has(key)) afterMap.set(key, row);
  });
  const affected = new Set();
  for (const [key, row] of afterMap.entries()) {
    if (!beforeMap.has(key)) {
      const userId = assignmentUserId(row);
      if (userId) affected.add(userId);
    }
  }
  for (const [key, row] of beforeMap.entries()) {
    if (!afterMap.has(key)) {
      const userId = assignmentUserId(row);
      if (userId) affected.add(userId);
    }
  }
  return affected;
}

function formatUser(u, availability, availabilityByDate = null) {
  return {
    id: u.id,
    last_name: u.last_name,
    first_name: u.first_name,
    patronymic: u.patronymic,
    roles: (u.Roles || []).map((r) => r.alias),
    availability,
    availability_by_date: availabilityByDate,
  };
}

async function fetchAssignmentNotificationDetails({
  matchIds = [],
  roleIds = null,
  roleGroupIds = null,
  statusIds = [],
} = {}) {
  if (!matchIds.length || !statusIds.length) return [];
  const where = {
    match_id: { [Op.in]: matchIds },
    status_id: { [Op.in]: statusIds },
  };
  if (Array.isArray(roleIds) && roleIds.length) {
    where.referee_role_id = { [Op.in]: roleIds };
  }
  const roleInclude = {
    model: RefereeRole,
    include: [RefereeRoleGroup],
    required: false,
  };
  if (Array.isArray(roleGroupIds) && roleGroupIds.length) {
    roleInclude.where = {
      referee_role_group_id: { [Op.in]: roleGroupIds },
    };
    roleInclude.required = true;
  }
  return MatchReferee.findAll({
    where,
    include: [
      {
        model: User,
        attributes: ['id', 'first_name', 'last_name', 'patronymic', 'email'],
      },
      roleInclude,
      {
        model: Match,
        required: true,
        attributes: ['id', 'date_start'],
        include: [
          { model: Tournament, attributes: ['id', 'name', 'full_name'] },
          { model: Stage, attributes: ['id', 'name'] },
          {
            model: TournamentGroup,
            attributes: ['id', 'name', 'match_duration_minutes'],
          },
          { model: Tour, attributes: ['id', 'name'] },
          {
            model: Ground,
            attributes: ['id', 'name'],
            include: [{ model: Address, attributes: ['result', 'source'] }],
          },
          { model: Team, as: 'HomeTeam', attributes: ['id', 'name'] },
          { model: Team, as: 'AwayTeam', attributes: ['id', 'name'] },
        ],
      },
    ],
  });
}

export async function listRoleGroups() {
  return RefereeRoleGroup.findAll({
    include: [{ model: RefereeRole }],
    order: [
      ['sort_order', 'ASC'],
      ['name', 'ASC'],
      [{ model: RefereeRole }, 'sort_order', 'ASC'],
      [{ model: RefereeRole }, 'name', 'ASC'],
    ],
  });
}

export async function listMatchesByDate(params = {}) {
  const {
    date,
    from,
    to,
    competitionAlias = '',
    dateKey,
  } = typeof params === 'string' ? { date: params } : params || {};
  const filters = normalizeDateRangeFilter({
    date: date || dateKey,
    from,
    to,
  });
  const hasCompetitionAliasFilter = Boolean(
    String(competitionAlias || '').trim()
  );
  const normalizedCompetitionAlias = String(competitionAlias || '')
    .trim()
    .toUpperCase();
  const competitionAliases = buildCompetitionAliasFilters(
    normalizedCompetitionAlias
  );
  const fallbackAliasesWhere =
    buildCompetitionNameFallbackWhere(competitionAlias);
  const competitionTypeInclude = {
    model: CompetitionType,
    attributes: ['id', 'alias', 'name'],
    required: false,
  };
  const baseCompetitionAliasWhere = buildCompetitionTypeWhere(competitionAlias);
  const tournamentIds = [];
  let isStrictCompetitionFilter = false;
  const tournamentWhere = {};
  if (competitionAliases.length) {
    let tournamentWhereFromAlias = (
      await Tournament.findAll({
        attributes: ['id'],
        include: [
          {
            model: CompetitionType,
            attributes: [],
            required: true,
            where: baseCompetitionAliasWhere,
          },
        ],
      })
    ).map((row) => row.id);
    if (tournamentWhereFromAlias.length) {
      isStrictCompetitionFilter = true;
    }
    if (!tournamentWhereFromAlias.length && fallbackAliasesWhere) {
      const tournamentWhereFromName = (
        await Tournament.findAll({
          attributes: ['id'],
          where: fallbackAliasesWhere,
          include: [
            { model: CompetitionType, attributes: [], required: false },
          ],
        })
      ).map((row) => row.id);

      tournamentWhereFromAlias = tournamentWhereFromName;
    }
    if (!tournamentWhereFromAlias.length) {
      return { date: filters.fromDate, date_to: filters.toDate, matches: [] };
    }
    tournamentIds.push(...tournamentWhereFromAlias);
  }
  if (hasCompetitionAliasFilter && !competitionAliases.length) {
    let tournamentWhereFromName = [];
    if (fallbackAliasesWhere) {
      tournamentWhereFromName = (
        await Tournament.findAll({
          attributes: ['id'],
          where: fallbackAliasesWhere,
          include: [
            { model: CompetitionType, attributes: [], required: false },
          ],
        })
      ).map((row) => row.id);
    }
    if (!tournamentWhereFromName.length) {
      return { date: filters.fromDate, date_to: filters.toDate, matches: [] };
    }
    tournamentIds.push(...tournamentWhereFromName);
  }
  if (isStrictCompetitionFilter) {
    competitionTypeInclude.required = true;
    competitionTypeInclude.where = baseCompetitionAliasWhere;
  }
  if (tournamentIds.length) {
    const uniqueTournamentIds = [...new Set(tournamentIds)];
    tournamentWhere.tournament_id = { [Op.in]: uniqueTournamentIds };
  }

  const matches = await Match.findAll({
    where: {
      ...tournamentWhere,
      date_start: {
        [Op.gte]: filters.start,
        [Op.lt]: filters.endExclusive,
      },
    },
    include: [
      {
        model: Tournament,
        attributes: ['id', 'name', 'full_name', 'competition_type_id'],
        include: [competitionTypeInclude],
      },
      { model: Stage, attributes: ['id', 'name'] },
      {
        model: TournamentGroup,
        attributes: ['id', 'name', 'match_duration_minutes'],
      },
      { model: Tour, attributes: ['id', 'name'] },
      { model: Ground, attributes: ['id', 'name'] },
      {
        model: Team,
        as: 'HomeTeam',
        attributes: ['id', 'name', 'birth_year'],
        include: [{ model: Club, attributes: ['name'] }],
      },
      {
        model: Team,
        as: 'AwayTeam',
        attributes: ['id', 'name', 'birth_year'],
        include: [{ model: Club, attributes: ['name'] }],
      },
    ],
    order: [['date_start', 'ASC']],
  });

  const matchIds = matches.map((m) => m.id);
  const matchGroupContextById = await resolveMatchGroupContext(matches);
  const groupIds = Array.from(
    new Set(
      matches
        .map((match) => matchGroupContextById.get(match.id)?.id)
        .filter(Boolean)
    )
  );

  const requirementsRaw = groupIds.length
    ? await TournamentGroupReferee.findAll({
        where: { tournament_group_id: { [Op.in]: groupIds } },
        include: [
          {
            model: RefereeRole,
            include: [RefereeRoleGroup],
            required: true,
          },
        ],
        order: [
          [{ model: RefereeRole }, 'name', 'ASC'],
          [{ model: RefereeRole }, { model: RefereeRoleGroup }, 'name', 'ASC'],
        ],
      })
    : [];

  const requirementsByGroup = buildRequirements(requirementsRaw);

  const statusInfo = matchIds.length ? await resolveAssignmentStatuses() : null;
  const assignmentsRaw = matchIds.length
    ? await MatchReferee.findAll({
        where: {
          match_id: { [Op.in]: matchIds },
          status_id: { [Op.in]: statusInfo.ids },
        },
        include: [
          { model: MatchRefereeStatus, required: false },
          {
            model: RefereeRole,
            include: [RefereeRoleGroup],
            required: false,
          },
          {
            model: User,
            attributes: ['id', 'last_name', 'first_name', 'patronymic'],
          },
        ],
        order: [
          [{ model: MatchRefereeStatus }, 'alias', 'ASC'],
          [{ model: User }, 'last_name', 'ASC'],
        ],
      })
    : [];

  const assignmentsByMatch = formatMatchAssignments(assignmentsRaw);
  const draftClears = matchIds.length
    ? await MatchRefereeDraftClear.findAll({
        where: { match_id: { [Op.in]: matchIds } },
        attributes: ['match_id', 'referee_role_group_id'],
      })
    : [];
  const draftClearByMatch = new Map();
  for (const row of draftClears) {
    if (!draftClearByMatch.has(row.match_id)) {
      draftClearByMatch.set(row.match_id, []);
    }
    draftClearByMatch.get(row.match_id).push(row.referee_role_group_id);
  }

  const result = matches.map((m) => {
    const groupContext = matchGroupContextById.get(m.id) || null;
    const durationMinutes = normalizeMatchDuration(
      groupContext?.match_duration_minutes ??
        m.TournamentGroup?.match_duration_minutes
    );
    const scheduleMissing = !m.date_start;
    const durationMissing = !durationMinutes;
    const mskDate = m.date_start ? moscowDateKey(m.date_start) : null;
    const startTime = m.date_start ? formatHm(utcToMoscow(m.date_start)) : null;
    const endTime =
      m.date_start && !durationMissing
        ? formatHm(
            utcToMoscow(
              new Date(m.date_start.getTime() + durationMinutes * 60000)
            )
          )
        : null;
    const assignments = assignmentsByMatch.get(m.id) || [];
    const hasDraft = assignments.some((a) => a.status === DRAFT_STATUS_ALIAS);
    const hasPublished = assignments.some(
      (a) => a.status === PUBLISHED_STATUS_ALIAS
    );
    const homeYear = m.HomeTeam?.birth_year;
    const awayYear = m.AwayTeam?.birth_year;
    const matchYear =
      homeYear && awayYear && homeYear === awayYear
        ? homeYear
        : homeYear || awayYear || null;

    return {
      id: m.id,
      match_number: m.external_id ?? null,
      date_start: m.date_start,
      msk_date: mskDate,
      msk_start_time: startTime,
      msk_end_time: endTime,
      duration_minutes: Number.isFinite(durationMinutes)
        ? durationMinutes
        : null,
      schedule_missing: scheduleMissing,
      duration_missing: durationMissing,
      tournament: m.Tournament
        ? {
            id: m.Tournament.id,
            name: m.Tournament.name,
            short_name: m.Tournament.name || m.Tournament.full_name,
            competition_type: m.Tournament.CompetitionType
              ? {
                  id: m.Tournament.CompetitionType.id,
                  alias: m.Tournament.CompetitionType.alias,
                  name: m.Tournament.CompetitionType.name,
                }
              : null,
          }
        : null,
      stage: m.Stage ? { id: m.Stage.id, name: m.Stage.name } : null,
      group: groupContext?.id
        ? {
            id: groupContext.id,
            name: groupContext.name || m.TournamentGroup?.name || null,
          }
        : null,
      tour: m.Tour ? { id: m.Tour.id, name: m.Tour.name } : null,
      ground: m.Ground ? { id: m.Ground.id, name: m.Ground.name } : null,
      team1: m.HomeTeam
        ? {
            id: m.HomeTeam.id,
            name: m.HomeTeam.name,
            birth_year: m.HomeTeam.birth_year,
            club: m.HomeTeam.Club?.name ?? null,
          }
        : null,
      team2: m.AwayTeam
        ? {
            id: m.AwayTeam.id,
            name: m.AwayTeam.name,
            birth_year: m.AwayTeam.birth_year,
            club: m.AwayTeam.Club?.name ?? null,
          }
        : null,
      year: matchYear,
      referee_requirements: requirementsByGroup.get(groupContext?.id) || [],
      assignments,
      draft_clear_group_ids: draftClearByMatch.get(m.id) || [],
      has_draft: hasDraft,
      has_published: hasPublished,
    };
  });

  return {
    date: filters.fromDate,
    date_to: filters.toDate,
    matches: result,
  };
}

export async function listRefereesByDate({
  date,
  dateKey,
  from,
  to,
  roleAlias = '',
  competitionAlias = '',
  onlyLeaguesAccess = false,
  roleGroupId = null,
  search = '',
  limit = 200,
} = {}) {
  const filters = normalizeDateRangeFilter({
    date: date || dateKey,
    from,
    to,
  });
  const DEFAULT_LIMIT = 200;
  const MAX_LIMIT = 10000;
  const limitProvided = limit !== undefined && limit !== null;
  const rawLimit = limitProvided ? Number(limit) : DEFAULT_LIMIT;
  const normalizedLimit = Number.isFinite(rawLimit) ? rawLimit : DEFAULT_LIMIT;
  const maxLimit =
    normalizedLimit > 0
      ? Math.min(Math.max(normalizedLimit, 1), MAX_LIMIT)
      : null;
  const where = {};
  if (search) {
    const term = `%${search.trim()}%`;
    where[Op.or] = [
      { last_name: { [Op.iLike]: term } },
      { first_name: { [Op.iLike]: term } },
      { patronymic: { [Op.iLike]: term } },
      { phone: { [Op.iLike]: term } },
      { email: { [Op.iLike]: term } },
    ];
  }

  const normalizedRoleAlias = String(roleAlias || '')
    .trim()
    .toUpperCase();
  const roleFilter = normalizedRoleAlias
    ? [normalizedRoleAlias]
    : REFEREE_ROLES;
  void roleGroupId;

  if (onlyLeaguesAccess) {
    const activeSeason = await Season.findOne({
      where: { active: true },
      attributes: ['id'],
    });
    if (!activeSeason?.id) {
      return {
        date: filters.fromDate,
        date_to: filters.toDate,
        referees: [],
      };
    }
    const competitionTypeIds =
      await resolveCompetitionTypeIds(competitionAlias);
    if (!competitionTypeIds.length) {
      return {
        date: filters.fromDate,
        date_to: filters.toDate,
        referees: [],
      };
    }
    const accessRows = await LeaguesAccess.findAll({
      where: {
        season_id: activeSeason.id,
        competition_type_id: { [Op.in]: competitionTypeIds },
      },
      attributes: ['user_id'],
    });
    const allowedUserIds = [
      ...new Set(accessRows.map((row) => row.user_id).filter(Boolean)),
    ];
    if (!allowedUserIds.length) {
      return {
        date: filters.fromDate,
        date_to: filters.toDate,
        referees: [],
      };
    }
    where.id = { [Op.in]: allowedUserIds };
  }

  const userQuery = {
    where,
    include: [
      {
        model: Role,
        where: { alias: roleFilter },
        through: { attributes: [] },
        required: true,
      },
      {
        model: UserStatus,
        where: { alias: 'ACTIVE' },
        required: true,
      },
    ],
    order: [
      ['last_name', 'ASC'],
      ['first_name', 'ASC'],
    ],
  };
  if (maxLimit !== null) userQuery.limit = maxLimit;

  const users = await User.findAll(userQuery);
  const uniqueUsers = [];
  const seenUserIds = new Set();
  users.forEach((user) => {
    if (!user?.id || seenUserIds.has(user.id)) return;
    seenUserIds.add(user.id);
    uniqueUsers.push(user);
  });

  const userIds = uniqueUsers.map((u) => u.id);
  const dateRangeKeys = buildDateKeysRange(filters.fromDate, filters.toDate);
  const availRecords = userIds.length
    ? await listAvailabilities(userIds, filters.fromDate, filters.toDate)
    : [];
  const availByUserAndDate = new Map();
  for (const rec of availRecords) {
    const userId = rec?.user_id;
    if (!userId) continue;
    const day = normalizeDateKeyFromValue(rec.date);
    if (!day) continue;
    const byDate = availByUserAndDate.get(userId) || {};
    byDate[day] = {
      status: rec.AvailabilityType?.alias || 'FREE',
      from_time: rec.from_time ?? null,
      to_time: rec.to_time ?? null,
      partial_mode: derivePartialMode(rec.from_time, rec.to_time),
      preset: true,
    };
    availByUserAndDate.set(userId, byDate);
  }

  const referees = uniqueUsers.map((u) => {
    const availabilityByDate = {
      ...buildDefaultAvailabilityByDate(dateRangeKeys),
      ...(availByUserAndDate.get(u.id) || {}),
    };
    const dates = dateRangeKeys.length
      ? dateRangeKeys
      : Object.keys(availabilityByDate).sort();
    const baseAvailability = dates.length
      ? availabilityByDate[dates[0]]
      : {
          status: 'FREE',
          from_time: null,
          to_time: null,
          partial_mode: null,
          preset: false,
        };
    const preferredDate = dates.find((dateKey) => {
      const entry = availabilityByDate[dateKey];
      return entry?.preset && ['FREE', 'PARTIAL'].includes(entry?.status);
    });
    const selectedAvailability = preferredDate
      ? availabilityByDate[preferredDate]
      : baseAvailability;
    return {
      ...formatUser(u, selectedAvailability),
      availability_by_date: availabilityByDate,
    };
  });

  const available = referees.filter((ref) => {
    const availabilityEntries = Object.values(ref.availability_by_date || {});
    return availabilityEntries.some(
      (entry) => entry?.preset && ['FREE', 'PARTIAL'].includes(entry?.status)
    );
  });

  return {
    date: filters.fromDate,
    date_to: filters.toDate,
    referees: available,
  };
}

export async function listAssignmentDatesForUser(userId) {
  if (!userId) throw new ServiceError('user_not_found', 404);
  const statusInfo = await resolveAssignmentStatuses();
  const statusIds = [statusInfo.published.id];
  if (statusInfo.confirmed) statusIds.push(statusInfo.confirmed.id);
  const todayKey = moscowTodayKey();
  const todayBounds = todayKey ? moscowDayBounds(todayKey) : null;

  const matchInclude = {
    model: Match,
    required: true,
    attributes: ['id', 'date_start'],
  };
  if (todayBounds) {
    matchInclude.where = { date_start: { [Op.gte]: todayBounds.start } };
  }

  const rows = await MatchReferee.findAll({
    where: {
      user_id: userId,
      status_id: { [Op.in]: statusIds },
    },
    attributes: ['match_id', 'status_id'],
    include: [matchInclude],
    order: [[{ model: Match }, 'date_start', 'ASC']],
  });

  const matchMap = new Map();
  for (const row of rows) {
    const match = row.Match;
    if (!match?.date_start) continue;
    if (!matchMap.has(match.id)) {
      matchMap.set(match.id, {
        dateKey: moscowDateKey(match.date_start),
        hasPublished: false,
        hasConfirmed: false,
      });
    }
    const entry = matchMap.get(match.id);
    if (row.status_id === statusInfo.published.id) entry.hasPublished = true;
    if (statusInfo.confirmed && row.status_id === statusInfo.confirmed.id) {
      entry.hasConfirmed = true;
    }
  }

  const dateMap = new Map();
  for (const entry of matchMap.values()) {
    if (!entry.dateKey) continue;
    if (!dateMap.has(entry.dateKey)) {
      dateMap.set(entry.dateKey, {
        date: entry.dateKey,
        total: 0,
        published: 0,
        confirmed: 0,
      });
    }
    const day = dateMap.get(entry.dateKey);
    day.total += 1;
    if (entry.hasPublished) day.published += 1;
    else day.confirmed += 1;
  }

  const dates = Array.from(dateMap.values())
    .filter((entry) => (!todayKey ? true : entry.date >= todayKey))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { dates };
}

export async function listAssignmentsForUser(userId, dateKey) {
  if (!userId) throw new ServiceError('user_not_found', 404);
  const normalized = normalizeDateKey(dateKey);
  const bounds = moscowDayBounds(normalized);
  if (!bounds) throw new ServiceError('invalid_date', 400);
  const todayKey = moscowTodayKey();
  if (todayKey && normalized < todayKey) {
    return {
      date: normalized,
      matches: [],
      day_summary: {
        total: 0,
        published: 0,
        confirmed: 0,
        needs_confirmation: false,
      },
    };
  }
  const statusInfo = await resolveAssignmentStatuses();
  const statusIds = [statusInfo.published.id];
  if (statusInfo.confirmed) statusIds.push(statusInfo.confirmed.id);

  const userAssignments = await MatchReferee.findAll({
    where: {
      user_id: userId,
      status_id: { [Op.in]: statusIds },
    },
    include: [
      { model: MatchRefereeStatus, required: false },
      {
        model: RefereeRole,
        include: [RefereeRoleGroup],
        required: false,
      },
      {
        model: Match,
        required: true,
        where: {
          date_start: {
            [Op.gte]: bounds.start,
            [Op.lt]: bounds.endExclusive,
          },
        },
        include: [
          { model: Tournament, attributes: ['id', 'name', 'full_name'] },
          { model: Stage, attributes: ['id', 'name'] },
          {
            model: TournamentGroup,
            attributes: ['id', 'name', 'match_duration_minutes'],
          },
          {
            model: Ground,
            attributes: ['id', 'name', 'yandex_url'],
            include: [
              { model: Address, attributes: ['result', 'source', 'metro'] },
            ],
          },
          {
            model: Team,
            as: 'HomeTeam',
            attributes: ['id', 'name'],
          },
          {
            model: Team,
            as: 'AwayTeam',
            attributes: ['id', 'name'],
          },
        ],
      },
    ],
    order: [
      [{ model: Match }, 'date_start', 'ASC'],
      [{ model: MatchRefereeStatus }, 'alias', 'ASC'],
    ],
  });

  if (!userAssignments.length) {
    return {
      date: normalized,
      matches: [],
      day_summary: {
        total: 0,
        published: 0,
        confirmed: 0,
        needs_confirmation: false,
      },
    };
  }

  const matchesById = new Map();
  const matchIds = new Set();
  const userRoleGroupIds = new Set();

  for (const row of userAssignments) {
    const match = row.Match;
    if (!match) continue;
    matchIds.add(match.id);
    if (row.RefereeRole?.referee_role_group_id) {
      userRoleGroupIds.add(row.RefereeRole.referee_role_group_id);
    }
    if (!matchesById.has(match.id)) {
      const durationMinutes =
        match.TournamentGroup?.match_duration_minutes ?? null;
      const durationMissing =
        !Number.isFinite(durationMinutes) || durationMinutes <= 0;
      const startTime = match.date_start
        ? formatHm(utcToMoscow(match.date_start))
        : null;
      const endTime =
        match.date_start && !durationMissing
          ? formatHm(
              utcToMoscow(
                new Date(match.date_start.getTime() + durationMinutes * 60000)
              )
            )
          : null;
      const mskDate = match.date_start ? moscowDateKey(match.date_start) : null;
      const address =
        match.Ground?.Address?.result || match.Ground?.Address?.source || null;
      const metro = Array.isArray(match.Ground?.Address?.metro)
        ? match.Ground.Address.metro
        : [];

      matchesById.set(match.id, {
        id: match.id,
        date_start: match.date_start,
        msk_date: mskDate,
        msk_start_time: startTime,
        msk_end_time: endTime,
        duration_minutes: Number.isFinite(durationMinutes)
          ? durationMinutes
          : null,
        tournament: match.Tournament
          ? {
              id: match.Tournament.id,
              name: match.Tournament.name,
              short_name: match.Tournament.name || match.Tournament.full_name,
            }
          : null,
        stage: match.Stage
          ? { id: match.Stage.id, name: match.Stage.name }
          : null,
        group: match.TournamentGroup
          ? { id: match.TournamentGroup.id, name: match.TournamentGroup.name }
          : null,
        ground: match.Ground
          ? {
              id: match.Ground.id,
              name: match.Ground.name,
              address,
              metro,
              yandex_url: match.Ground.yandex_url || null,
            }
          : null,
        team1: match.HomeTeam
          ? { id: match.HomeTeam.id, name: match.HomeTeam.name }
          : null,
        team2: match.AwayTeam
          ? { id: match.AwayTeam.id, name: match.AwayTeam.name }
          : null,
        assignments: [],
      });
    }
  }

  const visibleGroupIds = new Set(userRoleGroupIds);
  if (visibleGroupIds.size === 0) {
    userAssignments.forEach((row) => {
      const groupId = row.RefereeRole?.referee_role_group_id;
      if (groupId) visibleGroupIds.add(groupId);
    });
  }

  const allAssignments = await MatchReferee.findAll({
    where: {
      match_id: { [Op.in]: Array.from(matchIds.values()) },
      status_id: { [Op.in]: statusIds },
    },
    include: [
      { model: MatchRefereeStatus, required: false },
      {
        model: RefereeRole,
        include: [RefereeRoleGroup],
        required: false,
      },
      {
        model: User,
        attributes: ['id', 'last_name', 'first_name', 'patronymic'],
      },
    ],
    order: [
      [{ model: RefereeRole }, 'name', 'ASC'],
      [{ model: User }, 'last_name', 'ASC'],
    ],
  });

  for (const row of allAssignments) {
    const groupId = row.RefereeRole?.referee_role_group_id;
    if (groupId && !visibleGroupIds.has(groupId)) continue;
    const matchEntry = matchesById.get(row.match_id);
    if (!matchEntry) continue;
    matchEntry.assignments.push(formatAssignmentRow(row));
  }

  const matches = Array.from(matchesById.values());
  matches.sort((a, b) => {
    const tA = a.date_start ? new Date(a.date_start).getTime() : 0;
    const tB = b.date_start ? new Date(b.date_start).getTime() : 0;
    return tA - tB;
  });

  const publishedMatches = matches.filter((match) =>
    (match.assignments || []).some(
      (assignment) =>
        assignment.user?.id === userId &&
        assignment.status === PUBLISHED_STATUS_ALIAS
    )
  ).length;
  const totalMatches = matches.length;
  const confirmedMatches = Math.max(0, totalMatches - publishedMatches);

  return {
    date: normalized,
    matches,
    day_summary: {
      total: totalMatches,
      published: publishedMatches,
      confirmed: confirmedMatches,
      needs_confirmation: publishedMatches > 0,
    },
  };
}

export async function getMatchDetailsForUser(matchId, userId) {
  if (!userId) throw new ServiceError('user_not_found', 404);
  if (!matchId) throw new ServiceError('match_not_found', 404);
  const statusInfo = await resolveAssignmentStatuses();
  const statusIds = [statusInfo.published.id];
  if (statusInfo.confirmed) statusIds.push(statusInfo.confirmed.id);

  const hasAssignment = await MatchReferee.findOne({
    where: {
      match_id: matchId,
      user_id: userId,
      status_id: { [Op.in]: statusIds },
    },
    attributes: ['id'],
  });

  if (!hasAssignment) {
    throw new ServiceError('access_denied', 403);
  }

  const match = await Match.findByPk(matchId, {
    include: [
      { model: Tournament, attributes: ['id', 'name', 'full_name'] },
      { model: Stage, attributes: ['id', 'name'] },
      {
        model: TournamentGroup,
        attributes: ['id', 'name', 'match_duration_minutes'],
      },
      { model: Tour, attributes: ['id', 'name'] },
      { model: Season, attributes: ['id', 'name'] },
      {
        model: Ground,
        attributes: ['id', 'name', 'yandex_url'],
        include: [
          { model: Address, attributes: ['result', 'source', 'metro'] },
        ],
      },
      {
        model: Team,
        as: 'HomeTeam',
        attributes: ['id', 'name'],
      },
      {
        model: Team,
        as: 'AwayTeam',
        attributes: ['id', 'name'],
      },
      { model: GameStatus, attributes: ['name', 'alias'] },
    ],
  });

  if (!match) throw new ServiceError('match_not_found', 404);

  const durationMinutes = match.TournamentGroup?.match_duration_minutes ?? null;
  const durationMissing =
    !Number.isFinite(durationMinutes) || durationMinutes <= 0;
  const startTime = match.date_start
    ? formatHm(utcToMoscow(match.date_start))
    : null;
  const endTime =
    match.date_start && !durationMissing
      ? formatHm(
          utcToMoscow(
            new Date(match.date_start.getTime() + durationMinutes * 60000)
          )
        )
      : null;
  const mskDate = match.date_start ? moscowDateKey(match.date_start) : null;
  const address =
    match.Ground?.Address?.result || match.Ground?.Address?.source || null;
  const metro = Array.isArray(match.Ground?.Address?.metro)
    ? match.Ground.Address.metro
    : [];

  const assignmentRows = await MatchReferee.findAll({
    where: {
      match_id: matchId,
    },
    include: [
      { model: MatchRefereeStatus, required: false },
      {
        model: RefereeRole,
        include: [RefereeRoleGroup],
        required: false,
      },
      {
        model: User,
        attributes: ['id', 'last_name', 'first_name', 'patronymic', 'phone'],
      },
    ],
    order: [
      [{ model: RefereeRole }, 'name', 'ASC'],
      [{ model: User }, 'last_name', 'ASC'],
    ],
  });

  return {
    match: {
      id: match.id,
      date_start: match.date_start,
      msk_date: mskDate,
      msk_start_time: startTime,
      msk_end_time: endTime,
      duration_minutes: Number.isFinite(durationMinutes)
        ? durationMinutes
        : null,
      tournament: match.Tournament
        ? {
            id: match.Tournament.id,
            name: match.Tournament.name,
            short_name: match.Tournament.name || match.Tournament.full_name,
          }
        : null,
      stage: match.Stage
        ? { id: match.Stage.id, name: match.Stage.name }
        : null,
      group: match.TournamentGroup
        ? { id: match.TournamentGroup.id, name: match.TournamentGroup.name }
        : null,
      tour: match.Tour ? { id: match.Tour.id, name: match.Tour.name } : null,
      season: match.Season
        ? { id: match.Season.id, name: match.Season.name }
        : null,
      ground: match.Ground
        ? {
            id: match.Ground.id,
            name: match.Ground.name,
            address,
            metro,
            yandex_url: match.Ground.yandex_url || null,
          }
        : null,
      team1: match.HomeTeam
        ? { id: match.HomeTeam.id, name: match.HomeTeam.name }
        : null,
      team2: match.AwayTeam
        ? { id: match.AwayTeam.id, name: match.AwayTeam.name }
        : null,
      status: match.GameStatus
        ? { name: match.GameStatus.name, alias: match.GameStatus.alias }
        : null,
      assignments: assignmentRows.map(formatAssignmentRowWithPhone),
    },
  };
}

export async function confirmAssignmentsForMatch(matchId, userId) {
  if (!userId) throw new ServiceError('user_not_found', 404);
  const statusInfo = await resolveAssignmentStatuses();
  if (!statusInfo.confirmed) {
    throw new ServiceError('referee_statuses_missing', 500);
  }
  const statusIds = [statusInfo.published.id, statusInfo.confirmed.id];

  const existing = await MatchReferee.findAll({
    where: {
      match_id: matchId,
      user_id: userId,
      status_id: { [Op.in]: statusIds },
    },
    include: [
      { model: MatchRefereeStatus, required: false },
      { model: RefereeRole, include: [RefereeRoleGroup], required: false },
    ],
  });

  if (!existing.length) {
    throw new ServiceError('referee_assignments_missing', 400);
  }

  const hasPublished = existing.some(
    (row) => row.status_id === statusInfo.published.id
  );

  if (hasPublished) {
    await MatchReferee.update(
      {
        status_id: statusInfo.confirmed.id,
        updated_by: userId,
      },
      {
        where: {
          match_id: matchId,
          user_id: userId,
          status_id: statusInfo.published.id,
        },
      }
    );
  }

  const fresh = await MatchReferee.findAll({
    where: {
      match_id: matchId,
      user_id: userId,
      status_id: { [Op.in]: statusIds },
    },
    include: [
      { model: MatchRefereeStatus, required: false },
      { model: RefereeRole, include: [RefereeRoleGroup], required: false },
    ],
  });

  return { assignments: fresh.map(formatAssignmentRow) };
}

export async function confirmAssignmentsForDate(dateKey, userId) {
  if (!userId) throw new ServiceError('user_not_found', 404);
  const normalized = normalizeDateKey(dateKey);
  const bounds = moscowDayBounds(normalized);
  if (!bounds) throw new ServiceError('invalid_date', 400);
  const statusInfo = await resolveAssignmentStatuses();
  if (!statusInfo.confirmed) {
    throw new ServiceError('referee_statuses_missing', 500);
  }

  const dayRows = await MatchReferee.findAll({
    where: {
      user_id: userId,
      status_id: {
        [Op.in]: [statusInfo.published.id, statusInfo.confirmed.id],
      },
    },
    attributes: ['match_id', 'status_id'],
    include: [
      {
        model: Match,
        required: true,
        attributes: ['id'],
        where: {
          date_start: {
            [Op.gte]: bounds.start,
            [Op.lt]: bounds.endExclusive,
          },
        },
      },
    ],
  });

  if (!dayRows.length) {
    throw new ServiceError('referee_assignments_missing', 400);
  }

  const matchIds = Array.from(
    new Set(
      dayRows
        .filter((row) => row.status_id === statusInfo.published.id)
        .map((row) => row.match_id)
    )
  );

  if (!matchIds.length) {
    return {
      date: normalized,
      confirmed_matches: [],
      confirmed_count: 0,
      already_confirmed: true,
    };
  }

  await MatchReferee.update(
    {
      status_id: statusInfo.confirmed.id,
      updated_by: userId,
    },
    {
      where: {
        user_id: userId,
        match_id: { [Op.in]: matchIds },
        status_id: statusInfo.published.id,
      },
    }
  );

  return {
    date: normalized,
    confirmed_matches: matchIds,
    confirmed_count: matchIds.length,
  };
}

export async function updateMatchReferees(
  matchId,
  assignments = [],
  actorId,
  { roleGroupId = null, clearPublished = false } = {}
) {
  if (!Array.isArray(assignments)) {
    throw new ServiceError('referee_assignments_required', 400);
  }
  if (!roleGroupId) {
    throw new ServiceError('referee_role_group_required', 400);
  }

  const roleGroup = await RefereeRoleGroup.findByPk(roleGroupId);
  if (!roleGroup) {
    throw new ServiceError('referee_role_group_not_found', 404);
  }

  const statusInfo = await resolveAssignmentStatuses();

  const match = await Match.findByPk(matchId, {
    include: [
      { model: TournamentGroup, attributes: ['id', 'match_duration_minutes'] },
    ],
  });
  if (!match) throw new ServiceError('match_not_found', 404);
  if (!match.date_start) throw new ServiceError('match_schedule_missing', 400);

  const matchGroupContextById = await resolveMatchGroupContext([match]);
  const matchGroupContext = matchGroupContextById.get(match.id) || null;
  const effectiveTournamentGroupId =
    matchGroupContext?.id || match.tournament_group_id || null;
  const durationMinutes = normalizeMatchDuration(
    matchGroupContext?.match_duration_minutes ??
      match.TournamentGroup?.match_duration_minutes
  );
  if (!durationMinutes) {
    throw new ServiceError('match_duration_missing', 400);
  }

  const existingAssignments = await MatchReferee.findAll({
    where: { match_id: match.id, status_id: { [Op.in]: statusInfo.ids } },
    include: [{ model: RefereeRole, include: [RefereeRoleGroup] }],
  });
  const draftClearRows = await MatchRefereeDraftClear.findAll({
    where: { match_id: match.id },
    attributes: ['referee_role_group_id'],
  });
  const clearedGroupIds = new Set(
    draftClearRows.map((row) => row.referee_role_group_id).filter(Boolean)
  );

  const uniqueAssignments = [];
  const roleCounts = new Map();
  const userSet = new Set();
  for (const row of assignments) {
    const roleId = row?.role_id;
    const userId = row?.user_id;
    if (!roleId || !userId) {
      throw new ServiceError('referee_assignments_required', 400);
    }
    if (userSet.has(userId)) {
      throw new ServiceError('referee_user_duplicate', 400);
    }
    userSet.add(userId);
    roleCounts.set(roleId, (roleCounts.get(roleId) || 0) + 1);
    uniqueAssignments.push({ role_id: roleId, user_id: userId });
  }

  const groupIdValue = effectiveTournamentGroupId;
  const requirementsRaw = await TournamentGroupReferee.findAll({
    where: { tournament_group_id: groupIdValue },
    include: [
      {
        model: RefereeRole,
        required: true,
        where: { referee_role_group_id: roleGroup.id },
      },
    ],
  });

  if (!requirementsRaw.length && uniqueAssignments.length) {
    throw new ServiceError('referee_requirements_missing', 400);
  }

  const requiredByRole = new Map();
  for (const req of requirementsRaw) {
    requiredByRole.set(req.referee_role_id, req.count);
  }
  let scopedRoleIds = Array.from(requiredByRole.keys());
  if (!scopedRoleIds.length) {
    const roles = await RefereeRole.findAll({
      where: { referee_role_group_id: roleGroup.id },
      attributes: ['id'],
    });
    scopedRoleIds = roles.map((role) => role.id);
  }

  for (const [roleId, count] of roleCounts.entries()) {
    if (!requiredByRole.has(roleId)) {
      throw new ServiceError('referee_role_not_allowed', 400);
    }
    if (count > requiredByRole.get(roleId)) {
      throw new ServiceError('referee_count_exceeds_requirement', 400);
    }
  }

  const existingUserIds = new Set(
    existingAssignments.map((assignment) => assignment.user_id).filter(Boolean)
  );

  const userIds = Array.from(userSet.values());
  const newUserIds = userIds.filter((id) => !existingUserIds.has(id));
  if (newUserIds.length) {
    const include = [
      {
        model: Role,
        where: { alias: REFEREE_ROLES },
        through: { attributes: [] },
        required: true,
      },
      { model: UserStatus, where: { alias: 'ACTIVE' }, required: true },
    ];
    const users = await User.findAll({
      where: { id: { [Op.in]: newUserIds } },
      include,
    });

    if (users.length !== newUserIds.length) {
      throw new ServiceError('referee_user_not_allowed', 400);
    }
  }

  const mskDate = moscowDateKey(match.date_start);
  const startSeconds = moscowTimeSeconds(match.date_start);
  if (!mskDate || startSeconds === null) {
    throw new ServiceError('invalid_date', 400);
  }
  const endSeconds = startSeconds + durationMinutes * 60;

  const availabilityRecords = newUserIds.length
    ? await listAvailabilities(newUserIds, mskDate, mskDate)
    : [];
  const availabilityMap = new Map();
  for (const rec of availabilityRecords) {
    availabilityMap.set(rec.user_id, {
      status: rec.AvailabilityType?.alias || 'FREE',
      from_time: rec.from_time ?? null,
      to_time: rec.to_time ?? null,
    });
  }

  for (const userId of newUserIds) {
    const availability = availabilityMap.get(userId);
    if (!availability) {
      throw new ServiceError('referee_unavailable', 400);
    }
    if (availability.status !== 'FREE' && availability.status !== 'PARTIAL') {
      throw new ServiceError('referee_unavailable', 400);
    }
    if (!availabilityAllowsInterval(availability, startSeconds, endSeconds)) {
      throw new ServiceError('referee_unavailable', 400);
    }
  }

  if (newUserIds.length) {
    const bounds = moscowDayBounds(mskDate);
    if (!bounds) throw new ServiceError('invalid_date', 400);
    const otherAssignments = await MatchReferee.findAll({
      where: {
        user_id: { [Op.in]: newUserIds },
        status_id: { [Op.in]: statusInfo.ids },
      },
      include: [
        {
          model: Match,
          required: true,
          where: {
            date_start: {
              [Op.gte]: bounds.start,
              [Op.lt]: bounds.endExclusive,
            },
          },
          include: [
            {
              model: TournamentGroup,
              attributes: ['match_duration_minutes'],
            },
          ],
        },
      ],
    });

    const draftRolesByMatch = new Map();
    for (const assignment of otherAssignments) {
      if (assignment.status_id !== statusInfo.draft.id) continue;
      if (!draftRolesByMatch.has(assignment.match_id)) {
        draftRolesByMatch.set(assignment.match_id, new Set());
      }
      if (assignment.referee_role_id) {
        draftRolesByMatch
          .get(assignment.match_id)
          .add(assignment.referee_role_id);
      }
    }

    for (const assignment of otherAssignments) {
      if (assignment.match_id === match.id) continue;
      if (assignment.status_id !== statusInfo.draft.id) {
        const draftRoles = draftRolesByMatch.get(assignment.match_id);
        if (draftRoles?.has(assignment.referee_role_id)) {
          continue;
        }
      }
      const otherMatch = assignment.Match;
      if (!otherMatch?.date_start) continue;
      const otherDuration = otherMatch.TournamentGroup?.match_duration_minutes;
      if (!Number.isFinite(otherDuration) || otherDuration <= 0) {
        throw new ServiceError('referee_schedule_conflict', 400);
      }
      const otherStart = moscowTimeSeconds(otherMatch.date_start);
      const otherEnd = otherStart + otherDuration * 60;
      if (intervalOverlaps(startSeconds, endSeconds, otherStart, otherEnd)) {
        throw new ServiceError('referee_schedule_conflict', 400);
      }
    }
  }

  const assignmentsByGroup = new Map();
  for (const assignment of existingAssignments) {
    const groupId = assignment.RefereeRole?.referee_role_group_id;
    if (!groupId) continue;
    if (!assignmentsByGroup.has(groupId)) {
      assignmentsByGroup.set(groupId, {
        drafts: new Set(),
        published: new Set(),
      });
    }
    const bucket = assignmentsByGroup.get(groupId);
    if (assignment.status_id === statusInfo.draft.id) {
      if (assignment.user_id) bucket.drafts.add(assignment.user_id);
      continue;
    }
    if (
      assignment.status_id === statusInfo.published.id ||
      assignment.status_id === statusInfo.confirmed?.id
    ) {
      if (assignment.user_id) bucket.published.add(assignment.user_id);
    }
  }

  const occupiedByOtherGroup = new Set();
  for (const [groupId, bucket] of assignmentsByGroup.entries()) {
    if (groupId === roleGroup.id) continue;
    const useDraft = clearedGroupIds.has(groupId) || bucket.drafts.size > 0;
    const source = useDraft ? bucket.drafts : bucket.published;
    source.forEach((id) => occupiedByOtherGroup.add(id));
  }
  for (const userId of userIds) {
    if (occupiedByOtherGroup.has(userId)) {
      throw new ServiceError('referee_user_already_assigned', 400);
    }
  }

  const payload = uniqueAssignments.map((row) => ({
    match_id: match.id,
    referee_role_id: row.role_id,
    user_id: row.user_id,
    status_id: statusInfo.draft.id,
    created_by: actorId,
    updated_by: actorId,
  }));
  const clearRequested =
    clearPublished && payload.length === 0 && scopedRoleIds.length > 0;

  await sequelize.transaction(async (tx) => {
    if (scopedRoleIds.length) {
      await MatchReferee.destroy({
        where: {
          match_id: match.id,
          status_id: statusInfo.draft.id,
          referee_role_id: { [Op.in]: scopedRoleIds },
        },
        force: true,
        transaction: tx,
      });
    }
    if (payload.length) {
      await MatchReferee.bulkCreate(payload, { transaction: tx });
    }
    if (clearRequested) {
      await MatchRefereeDraftClear.findOrCreate({
        where: {
          match_id: match.id,
          referee_role_group_id: roleGroup.id,
        },
        defaults: {
          created_by: actorId,
          updated_by: actorId,
        },
        transaction: tx,
      });
      await MatchRefereeDraftClear.update(
        { updated_by: actorId },
        {
          where: {
            match_id: match.id,
            referee_role_group_id: roleGroup.id,
          },
          transaction: tx,
        }
      );
    } else {
      await MatchRefereeDraftClear.destroy({
        where: {
          match_id: match.id,
          referee_role_group_id: roleGroup.id,
        },
        force: true,
        transaction: tx,
      });
    }
  });

  const fresh = await MatchReferee.findAll({
    where: { match_id: match.id, status_id: { [Op.in]: statusInfo.ids } },
    include: [
      { model: MatchRefereeStatus, required: false },
      { model: RefereeRole, include: [RefereeRoleGroup] },
      {
        model: User,
        attributes: ['id', 'last_name', 'first_name', 'patronymic'],
      },
    ],
  });

  const clearRows = await MatchRefereeDraftClear.findAll({
    where: { match_id: match.id },
    attributes: ['referee_role_group_id'],
  });

  return {
    assignments: formatMatchAssignments(fresh).get(match.id) || [],
    draft_clear_group_ids: clearRows.map((row) => row.referee_role_group_id),
  };
}

export async function publishMatchReferees(matchId, actorId) {
  const statusInfo = await resolveAssignmentStatuses();
  const match = await Match.findByPk(matchId, {
    include: [{ model: TournamentGroup, attributes: ['id'] }],
  });
  if (!match) throw new ServiceError('match_not_found', 404);
  const matchGroupContextById = await resolveMatchGroupContext([match]);
  const matchGroupContext = matchGroupContextById.get(match.id) || null;
  const effectiveTournamentGroupId =
    matchGroupContext?.id || match.tournament_group_id || null;

  const assignedStatusIds = [
    statusInfo.published.id,
    statusInfo.confirmed?.id,
  ].filter(Boolean);
  const beforeDetails = await fetchAssignmentNotificationDetails({
    matchIds: [match.id],
    statusIds: assignedStatusIds,
  });

  const requirementsRaw = await TournamentGroupReferee.findAll({
    where: { tournament_group_id: effectiveTournamentGroupId },
  });
  const requiredByRole = new Map();
  for (const req of requirementsRaw) {
    requiredByRole.set(req.referee_role_id, req.count);
  }

  const draftAssignments = await MatchReferee.findAll({
    where: { match_id: match.id, status_id: statusInfo.draft.id },
  });

  if (!draftAssignments.length) {
    throw new ServiceError('referee_assignments_missing', 400);
  }

  const counts = new Map();
  for (const row of draftAssignments) {
    if (!requiredByRole.has(row.referee_role_id)) {
      throw new ServiceError('referee_role_not_allowed', 400);
    }
    counts.set(row.referee_role_id, (counts.get(row.referee_role_id) || 0) + 1);
  }

  for (const [roleId, required] of requiredByRole.entries()) {
    const current = counts.get(roleId) || 0;
    if (current !== required) {
      throw new ServiceError('referee_assignments_incomplete', 400);
    }
  }

  await sequelize.transaction(async (tx) => {
    await MatchReferee.destroy({
      where: { match_id: match.id, status_id: statusInfo.published.id },
      force: true,
      transaction: tx,
    });
    await MatchReferee.update(
      {
        status_id: statusInfo.published.id,
        published_at: new Date(),
        published_by: actorId,
        updated_by: actorId,
      },
      {
        where: { match_id: match.id, status_id: statusInfo.draft.id },
        transaction: tx,
      }
    );
  });

  const published = await MatchReferee.findAll({
    where: { match_id: match.id, status_id: statusInfo.published.id },
    include: [
      { model: MatchRefereeStatus, required: false },
      { model: RefereeRole, include: [RefereeRoleGroup] },
      {
        model: User,
        attributes: ['id', 'last_name', 'first_name', 'patronymic'],
      },
    ],
  });

  let notificationStats = {
    recipients: 0,
    queued: 0,
    failed: 0,
    published: 0,
    cancelled: 0,
    skipped_no_email: 0,
    skipped_duplicate: 0,
  };
  try {
    const afterDetails = await fetchAssignmentNotificationDetails({
      matchIds: [match.id],
      statusIds: assignedStatusIds,
    });
    notificationStats = await notifyRefereeAssignmentChanges({
      before: beforeDetails,
      after: afterDetails,
      actorId,
    });
  } catch (err) {
    logger.error('Referee assignment notifications failed', {
      error: err?.message || String(err),
      matchId,
    });
    notificationStats = { ...notificationStats, error: 'notification_failed' };
  }

  return {
    assignments: formatMatchAssignments(published).get(match.id) || [],
    notifications: notificationStats,
  };
}

export async function publishAssignmentsForDate(
  dateKey,
  actorId,
  { roleGroupIds = [] } = {}
) {
  const normalized = normalizeDateKey(dateKey);
  const uniqueGroupIds = Array.from(
    new Set((roleGroupIds || []).filter(Boolean))
  );
  if (!uniqueGroupIds.length) {
    throw new ServiceError('referee_role_group_required', 400);
  }

  const existingGroups = await RefereeRoleGroup.findAll({
    where: { id: { [Op.in]: uniqueGroupIds } },
    attributes: ['id'],
  });
  if (existingGroups.length !== uniqueGroupIds.length) {
    throw new ServiceError('referee_role_group_not_found', 404);
  }

  const statusInfo = await resolveAssignmentStatuses();
  const bounds = moscowDayBounds(normalized);
  if (!bounds) throw new ServiceError('invalid_date', 400);

  const matches = await Match.findAll({
    where: {
      date_start: {
        [Op.gte]: bounds.start,
        [Op.lt]: bounds.endExclusive,
      },
    },
    attributes: [
      'id',
      'tournament_group_id',
      'tournament_id',
      'team1_id',
      'team2_id',
      'date_start',
    ],
    include: [
      { model: TournamentGroup, attributes: ['id', 'match_duration_minutes'] },
    ],
  });

  if (!matches.length) {
    return {
      date: normalized,
      published_matches: [],
      published_count: 0,
    };
  }

  const matchIds = matches.map((match) => match.id);
  const matchesById = new Map(matches.map((match) => [match.id, match]));
  const matchGroupContextById = await resolveMatchGroupContext(matches);
  const groupIds = Array.from(
    new Set(
      matches
        .map((match) => matchGroupContextById.get(match.id)?.id)
        .filter(Boolean)
    )
  );

  const requirementsRaw = groupIds.length
    ? await TournamentGroupReferee.findAll({
        where: { tournament_group_id: { [Op.in]: groupIds } },
        include: [
          {
            model: RefereeRole,
            required: true,
            attributes: ['id', 'referee_role_group_id'],
            where: { referee_role_group_id: { [Op.in]: uniqueGroupIds } },
          },
        ],
      })
    : [];

  const roleIdsByGroupId = new Map();
  const roleGroupByRoleId = new Map();

  for (const req of requirementsRaw) {
    const roleId = req.referee_role_id;
    const groupId = req.RefereeRole?.referee_role_group_id;
    if (!roleId || !groupId) continue;
    roleGroupByRoleId.set(roleId, groupId);
    if (!roleIdsByGroupId.has(groupId)) {
      roleIdsByGroupId.set(groupId, new Set());
    }
    roleIdsByGroupId.get(groupId).add(roleId);
  }

  const requirementsByTournamentGroup = new Map();
  for (const req of requirementsRaw) {
    const tournamentGroupId = req.tournament_group_id;
    const roleId = req.referee_role_id;
    const roleGroupId = req.RefereeRole?.referee_role_group_id;
    if (!tournamentGroupId || !roleId || !roleGroupId) continue;
    if (!requirementsByTournamentGroup.has(tournamentGroupId)) {
      requirementsByTournamentGroup.set(tournamentGroupId, new Map());
    }
    const byRoleGroup = requirementsByTournamentGroup.get(tournamentGroupId);
    if (!byRoleGroup.has(roleGroupId)) {
      byRoleGroup.set(roleGroupId, new Set());
    }
    byRoleGroup.get(roleGroupId).add(roleId);
  }

  const missingRoleGroups = uniqueGroupIds.filter(
    (groupId) => !roleIdsByGroupId.get(groupId)?.size
  );
  if (missingRoleGroups.length) {
    const roles = await RefereeRole.findAll({
      where: { referee_role_group_id: { [Op.in]: missingRoleGroups } },
      attributes: ['id', 'referee_role_group_id'],
    });
    for (const role of roles) {
      const groupId = role.referee_role_group_id;
      if (!groupId || !role.id) continue;
      roleGroupByRoleId.set(role.id, groupId);
      if (!roleIdsByGroupId.has(groupId)) {
        roleIdsByGroupId.set(groupId, new Set());
      }
      roleIdsByGroupId.get(groupId).add(role.id);
    }
  }

  const allRoleIds = Array.from(
    new Set(
      Array.from(roleIdsByGroupId.values()).flatMap((set) =>
        Array.from(set.values())
      )
    )
  );
  const assignedStatusIds = [
    statusInfo.published.id,
    statusInfo.confirmed?.id,
  ].filter(Boolean);
  const beforeDetails = matchIds.length
    ? await fetchAssignmentNotificationDetails({
        matchIds,
        roleGroupIds: uniqueGroupIds,
        statusIds: assignedStatusIds,
      })
    : [];

  const assignments =
    matchIds.length && allRoleIds.length
      ? await MatchReferee.findAll({
          where: {
            match_id: { [Op.in]: matchIds },
            referee_role_id: { [Op.in]: allRoleIds },
            status_id: { [Op.in]: statusInfo.ids },
          },
        })
      : [];

  const draftRolesByGroup = new Map();
  const draftUsersByGroup = new Map();
  const publishedUsersByGroup = new Map();
  const ensureRoleUsers = (store, groupId, matchId) => {
    if (!store.has(groupId)) {
      store.set(groupId, new Map());
    }
    const byMatch = store.get(groupId);
    if (!byMatch.has(matchId)) {
      byMatch.set(matchId, new Map());
    }
    return byMatch.get(matchId);
  };

  for (const assignment of assignments) {
    const roleGroupId = roleGroupByRoleId.get(assignment.referee_role_id);
    if (!roleGroupId) continue;
    const matchId = assignment.match_id;
    const roleId = assignment.referee_role_id;
    const userId = assignment.user_id;
    if (assignment.status_id === statusInfo.draft.id) {
      if (!draftRolesByGroup.has(roleGroupId)) {
        draftRolesByGroup.set(roleGroupId, new Map());
      }
      const byMatch = draftRolesByGroup.get(roleGroupId);
      if (!byMatch.has(matchId)) {
        byMatch.set(matchId, new Set());
      }
      byMatch.get(matchId).add(roleId);
      if (!userId) continue;
      const roleUsers = ensureRoleUsers(
        draftUsersByGroup,
        roleGroupId,
        matchId
      );
      if (!roleUsers.has(roleId)) {
        roleUsers.set(roleId, new Set());
      }
      roleUsers.get(roleId).add(userId);
      continue;
    }
    if (
      assignment.status_id === statusInfo.published.id ||
      assignment.status_id === statusInfo.confirmed?.id
    ) {
      if (!userId) continue;
      const roleUsers = ensureRoleUsers(
        publishedUsersByGroup,
        roleGroupId,
        matchId
      );
      if (!roleUsers.has(roleId)) {
        roleUsers.set(roleId, new Set());
      }
      roleUsers.get(roleId).add(userId);
    }
  }

  const clearMarkers = await MatchRefereeDraftClear.findAll({
    where: {
      match_id: { [Op.in]: matchIds },
      referee_role_group_id: { [Op.in]: uniqueGroupIds },
    },
    attributes: ['match_id', 'referee_role_group_id'],
  });
  const clearByGroup = new Map();
  for (const groupId of uniqueGroupIds) {
    clearByGroup.set(groupId, new Set());
  }
  for (const row of clearMarkers) {
    if (!clearByGroup.has(row.referee_role_group_id)) continue;
    clearByGroup.get(row.referee_role_group_id).add(row.match_id);
  }

  const matchesWithDraftsByGroup = new Map();
  for (const groupId of uniqueGroupIds) {
    matchesWithDraftsByGroup.set(groupId, new Set());
  }
  for (const [groupId, byMatch] of draftRolesByGroup.entries()) {
    if (!matchesWithDraftsByGroup.has(groupId)) continue;
    byMatch.forEach((_value, matchId) => {
      matchesWithDraftsByGroup.get(groupId).add(matchId);
    });
  }

  const publishedMatches = new Set();
  await sequelize.transaction(async (tx) => {
    for (const groupId of uniqueGroupIds) {
      const roleIdList = Array.from(roleIdsByGroupId.get(groupId) || []);
      const publishMatchIds = Array.from(
        matchesWithDraftsByGroup.get(groupId) || []
      );
      const publishRoleMap = draftRolesByGroup.get(groupId) || new Map();
      const draftUsersByMatch = draftUsersByGroup.get(groupId) || new Map();
      const publishedUsersByMatch =
        publishedUsersByGroup.get(groupId) || new Map();
      const clearMatchIds = Array.from(clearByGroup.get(groupId) || []);
      if (publishMatchIds.length) {
        publishMatchIds.forEach((id) => publishedMatches.add(id));
        for (const matchId of publishMatchIds) {
          const match = matchesById.get(matchId);
          const effectiveGroupId =
            matchGroupContextById.get(matchId)?.id ||
            match?.tournament_group_id ||
            null;
          const groupRequirements = effectiveGroupId
            ? requirementsByTournamentGroup.get(effectiveGroupId)
            : null;
          const roleIdsForMatch = groupRequirements?.has(groupId)
            ? Array.from(groupRequirements.get(groupId).values())
            : roleIdList;

          const draftRoles = publishRoleMap.get(matchId) || new Set();
          const draftUsersByRole = draftUsersByMatch.get(matchId) || new Map();
          const publishedUsersByRole =
            publishedUsersByMatch.get(matchId) || new Map();
          const replaceStatuses = [
            statusInfo.published.id,
            statusInfo.confirmed?.id,
          ].filter(Boolean);

          const rolesToClear = roleIdsForMatch.filter(
            (roleId) => !draftRoles.has(roleId)
          );
          for (const roleId of rolesToClear) {
            const publishedUsers = publishedUsersByRole.get(roleId);
            if (!publishedUsers || !publishedUsers.size) continue;
            await MatchReferee.destroy({
              where: {
                match_id: matchId,
                referee_role_id: roleId,
                user_id: Array.from(publishedUsers.values()),
                status_id: { [Op.in]: replaceStatuses },
              },
              force: true,
              transaction: tx,
            });
          }

          for (const roleId of Array.from(draftRoles.values())) {
            const draftUsers = draftUsersByRole.get(roleId) || new Set();
            const publishedUsers =
              publishedUsersByRole.get(roleId) || new Set();
            const usersToRemove = Array.from(publishedUsers).filter(
              (id) => !draftUsers.has(id)
            );
            const usersToKeep = Array.from(publishedUsers).filter((id) =>
              draftUsers.has(id)
            );
            const usersToAdd = Array.from(draftUsers).filter(
              (id) => !publishedUsers.has(id)
            );

            if (usersToRemove.length) {
              await MatchReferee.destroy({
                where: {
                  match_id: matchId,
                  referee_role_id: roleId,
                  user_id: { [Op.in]: usersToRemove },
                  status_id: { [Op.in]: replaceStatuses },
                },
                force: true,
                transaction: tx,
              });
            }

            if (usersToKeep.length) {
              await MatchReferee.destroy({
                where: {
                  match_id: matchId,
                  referee_role_id: roleId,
                  user_id: { [Op.in]: usersToKeep },
                  status_id: statusInfo.draft.id,
                },
                force: true,
                transaction: tx,
              });
            }

            if (usersToAdd.length) {
              await MatchReferee.update(
                {
                  status_id: statusInfo.published.id,
                  published_at: new Date(),
                  published_by: actorId,
                  updated_by: actorId,
                },
                {
                  where: {
                    match_id: matchId,
                    referee_role_id: roleId,
                    user_id: { [Op.in]: usersToAdd },
                    status_id: statusInfo.draft.id,
                  },
                  transaction: tx,
                }
              );
            }
          }
        }
      }
      if (clearMatchIds.length) {
        clearMatchIds.forEach((id) => publishedMatches.add(id));
        for (const matchId of clearMatchIds) {
          const match = matchesById.get(matchId);
          const effectiveGroupId =
            matchGroupContextById.get(matchId)?.id ||
            match?.tournament_group_id ||
            null;
          const groupRequirements = effectiveGroupId
            ? requirementsByTournamentGroup.get(effectiveGroupId)
            : null;
          const roleIdsForMatch = groupRequirements?.has(groupId)
            ? Array.from(groupRequirements.get(groupId).values())
            : roleIdList;
          if (!roleIdsForMatch.length) continue;
          await MatchReferee.destroy({
            where: {
              match_id: matchId,
              referee_role_id: { [Op.in]: roleIdsForMatch },
              status_id: { [Op.in]: statusInfo.ids },
            },
            force: true,
            transaction: tx,
          });
        }
        await MatchRefereeDraftClear.destroy({
          where: {
            match_id: { [Op.in]: clearMatchIds },
            referee_role_group_id: groupId,
          },
          force: true,
          transaction: tx,
        });
      }
    }
  });

  const publishedList = Array.from(publishedMatches.values());
  let notificationStats = {
    recipients: 0,
    queued: 0,
    failed: 0,
    published: 0,
    cancelled: 0,
    skipped_no_email: 0,
    skipped_duplicate: 0,
  };
  try {
    const afterDetails = matchIds.length
      ? await fetchAssignmentNotificationDetails({
          matchIds,
          roleGroupIds: uniqueGroupIds,
          statusIds: assignedStatusIds,
        })
      : [];
    const affectedUserIds = collectChangedUserIds(beforeDetails, afterDetails);
    if (affectedUserIds.size && statusInfo.confirmed && matchIds.length) {
      await MatchReferee.update(
        {
          status_id: statusInfo.published.id,
          updated_by: actorId,
        },
        {
          where: {
            match_id: { [Op.in]: matchIds },
            user_id: { [Op.in]: Array.from(affectedUserIds.values()) },
            status_id: statusInfo.confirmed.id,
          },
        }
      );
    }
    notificationStats = await notifyRefereeAssignmentChanges({
      before: beforeDetails,
      after: afterDetails,
      actorId,
    });
  } catch (err) {
    logger.error('Referee assignment notifications failed', {
      error: err?.message || String(err),
      date: normalized,
    });
    notificationStats = { ...notificationStats, error: 'notification_failed' };
  }
  return {
    date: normalized,
    published_matches: publishedList,
    published_count: publishedList.length,
    notifications: notificationStats,
  };
}

export default {
  listRoleGroups,
  listMatchesByDate,
  listRefereesByDate,
  listAssignmentDatesForUser,
  listAssignmentsForUser,
  getMatchDetailsForUser,
  confirmAssignmentsForMatch,
  confirmAssignmentsForDate,
  updateMatchReferees,
  publishMatchReferees,
  publishAssignmentsForDate,
};
