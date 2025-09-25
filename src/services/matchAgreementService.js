import { Op } from 'sequelize';

import sequelize from '../config/database.js';
import ServiceError from '../errors/ServiceError.js';
import {
  Match,
  Team,
  Ground,
  GroundTeam,
  Club,
  Tournament,
  TournamentType,
  TournamentGroup,
  Tour,
  MatchAgreement,
  MatchAgreementType,
  MatchAgreementStatus,
  GameStatus,
  User,
} from '../models/index.js';
import { utcToMoscow } from '../utils/time.js';
import {
  resolveMatchAccessContext,
  evaluateStaffMatchRestrictions,
  ensureParticipantOrThrow,
} from '../utils/matchAccess.js';

import externalSync from './externalMatchSyncService.js';
import emailService from './emailService.js';
import { listTeamUsers } from './teamService.js';

function appUrl() {
  return process.env.BASE_URL || 'https://lk.fhmoscow.com';
}

function buildEventContext(match, { groundName, kickoff }) {
  return {
    matchId: match.id,
    team1: match.HomeTeam?.name || 'Команда 1',
    team2: match.AwayTeam?.name || 'Команда 2',
    tournament: match.Tournament?.name || '',
    group: match.TournamentGroup?.name || '',
    tour: match.Tour?.name || '',
    ground: groundName || match.Ground?.name || '',
    kickoff: kickoff || match.date_start,
    url: `${appUrl()}/school-matches/${match.id}/agreements`,
  };
}

function isPast(isoLike) {
  if (!isoLike) return false;
  const t = new Date(isoLike).getTime();
  return !Number.isNaN(t) && t <= Date.now();
}

function normalizeClubMoscowFlag(club) {
  if (!club) return null;
  const value = club.is_moscow;
  if (value == null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  return ['1', 'true', 't', 'yes', 'y'].includes(normalized);
}

function canUseGuestGroundSelection(match) {
  if (!match) return false;
  const doubleProtocol = Boolean(
    match?.Tournament?.TournamentType?.double_protocol
  );
  if (!doubleProtocol) return false;
  const homeFlag = normalizeClubMoscowFlag(match?.HomeTeam?.Club);
  const awayFlag = normalizeClubMoscowFlag(match?.AwayTeam?.Club);
  return homeFlag === false && awayFlag === true;
}

function buildAllowedGroundTeamIds(match) {
  const ids = new Set();
  if (match?.team1_id) ids.add(match.team1_id);
  if (canUseGuestGroundSelection(match) && match?.team2_id)
    ids.add(match.team2_id);
  return Array.from(ids);
}

async function getTypeId(alias) {
  const t = await MatchAgreementType.findOne({ where: { alias } });
  if (!t) throw new ServiceError('agreement_type_not_found', 500);
  return t.id;
}

async function getStatusId(alias) {
  const s = await MatchAgreementStatus.findOne({ where: { alias } });
  if (!s) throw new ServiceError('agreement_status_not_found', 500);
  return s.id;
}

function sameMoscowDate(a, b) {
  const am = utcToMoscow(a);
  const bm = utcToMoscow(b);
  if (!am || !bm) return false;
  return (
    am.getUTCFullYear() === bm.getUTCFullYear() &&
    am.getUTCMonth() === bm.getUTCMonth() &&
    am.getUTCDate() === bm.getUTCDate()
  );
}

async function ensureUserSide(userId, match) {
  const context = await resolveMatchAccessContext({ matchOrId: match, userId });
  ensureParticipantOrThrow(context);
  return context;
}

function assertAgreementsAllowed(context) {
  const restrictions = evaluateStaffMatchRestrictions(context);
  if (restrictions.agreementsBlocked) {
    throw new ServiceError('staff_position_restricted', 403);
  }
  return restrictions;
}

async function anyAcceptedExists(matchId) {
  const accepted = await MatchAgreementStatus.findOne({
    where: { alias: 'ACCEPTED' },
    attributes: ['id'],
  });
  if (!accepted) return false;
  const count = await MatchAgreement.count({
    where: { match_id: matchId, status_id: accepted.id },
  });
  return count > 0;
}

async function anyPendingExists(matchId) {
  const pending = await MatchAgreementStatus.findOne({
    where: { alias: 'PENDING' },
    attributes: ['id'],
  });
  if (!pending) return false;
  const count = await MatchAgreement.count({
    where: { match_id: matchId, status_id: pending.id },
  });
  return count > 0;
}

async function list(matchId, actorId) {
  const context = await resolveMatchAccessContext({
    matchOrId: matchId,
    userId: actorId,
  });
  ensureParticipantOrThrow(context);
  assertAgreementsAllowed(context);
  return MatchAgreement.findAll({
    where: { match_id: matchId },
    include: [
      { model: MatchAgreementType },
      { model: MatchAgreementStatus },
      { model: Ground },
      { model: MatchAgreement, as: 'Parent' },
      { model: User, as: 'Author' },
    ],
    order: [['created_at', 'ASC']],
  });
}

function ensureNotLocked(match) {
  if (match?.schedule_locked_by_admin) {
    throw new ServiceError('schedule_locked_by_admin', 409);
  }
}

function ensureNotCancelled(match) {
  const alias = (match?.GameStatus?.alias || '').toUpperCase();
  if (alias === 'CANCELLED') {
    throw new ServiceError('match_cancelled', 409);
  }
}

async function ensureMatchWithStatus(matchOrId) {
  // Ensure we have a Match instance with GameStatus loaded, preserving the original instance when provided
  if (!matchOrId) return null;
  if (typeof matchOrId === 'object') {
    if (matchOrId.GameStatus) return matchOrId;
    const reloaded = await Match.findByPk(matchOrId.id, {
      include: [GameStatus],
    });
    if (reloaded?.GameStatus) {
      try {
        // Preserve instance methods by attaching the relation to the original object
        matchOrId.GameStatus = reloaded.GameStatus;
      } catch {
        // Fallback define in case of sealed objects
        try {
          Object.defineProperty(matchOrId, 'GameStatus', {
            value: reloaded.GameStatus,
            enumerable: true,
            writable: true,
            configurable: true,
          });
        } catch {
          /* ignore */
        }
      }
    }
    return matchOrId;
  }
  return Match.findByPk(matchOrId, { include: [GameStatus] });
}

async function create(matchId, payload, actorId) {
  const match = await Match.findByPk(matchId, {
    include: [
      {
        model: Team,
        as: 'HomeTeam',
        include: [{ model: Club }],
      },
      {
        model: Team,
        as: 'AwayTeam',
        include: [{ model: Club }],
      },
      { model: Ground },
      {
        model: Tournament,
        include: [{ model: TournamentType }],
      },
      { model: TournamentGroup },
      { model: Tour },
      { model: GameStatus },
    ],
  });
  if (!match) throw new ServiceError('match_not_found', 404);
  if (!match.date_start) throw new ServiceError('match_date_not_set', 400);
  if (!match.team1_id) throw new ServiceError('team_not_set_for_match', 400);
  ensureNotLocked(match);
  ensureNotCancelled(match);
  if (isPast(match.date_start))
    throw new ServiceError('match_already_past', 409);

  const allowedTeamIds = buildAllowedGroundTeamIds(match);
  if (!allowedTeamIds.length)
    throw new ServiceError('team_not_set_for_match', 400);

  const context = await ensureUserSide(actorId, match);
  assertAgreementsAllowed(context);
  const { isHome, isAway } = context;

  const kickoff = new Date(payload.date_start);
  if (Number.isNaN(kickoff.getTime()))
    throw new ServiceError('invalid_kickoff_time', 400);
  const matchDate = new Date(match.date_start);
  if (!sameMoscowDate(kickoff, matchDate))
    throw new ServiceError('kickoff_date_must_match_match_date', 400);

  // Do not allow new proposals if already accepted
  if (await anyAcceptedExists(matchId))
    throw new ServiceError('agreement_already_accepted', 409);

  const ground = await Ground.findByPk(payload.ground_id);
  if (!ground) throw new ServiceError('ground_not_found', 404);

  const parentId = payload.parent_id || null;

  const created = await sequelize.transaction(async (tx) => {
    const teamCondition =
      allowedTeamIds.length === 1
        ? allowedTeamIds[0]
        : { [Op.in]: allowedTeamIds };

    if (parentId) {
      // counter-proposal by AWAY to a HOME proposal
      const parent = await MatchAgreement.findByPk(parentId, {
        include: [MatchAgreementStatus, MatchAgreementType],
        transaction: tx,
      });
      if (!parent || parent.match_id !== matchId)
        throw new ServiceError('parent_agreement_not_found', 404);

      if (parent.MatchAgreementStatus?.alias !== 'PENDING')
        throw new ServiceError('parent_not_pending', 409);

      if (parent.MatchAgreementType?.alias !== 'HOME_PROPOSAL')
        throw new ServiceError('only_counter_home_proposal', 400);

      if (!isAway) throw new ServiceError('only_away_can_counter', 403);

      // Validate ground is linked to HOME team (business rule)
      const link = await GroundTeam.findOne({
        where: { ground_id: ground.id, team_id: teamCondition },
        transaction: tx,
      });
      if (!link) throw new ServiceError('ground_not_linked_to_home_team', 400);

      // Ensure no other pending exists (except parent)
      const pending = await MatchAgreementStatus.findOne({
        where: { alias: 'PENDING' },
        attributes: ['id'],
        transaction: tx,
      });
      const others = await MatchAgreement.count({
        where: {
          match_id: matchId,
          status_id: pending.id,
          id: { [Op.ne]: parentId },
        },
        transaction: tx,
      });
      if (others > 0) throw new ServiceError('another_pending_exists', 409);

      // Supersede the parent and create new pending counter
      const supersededId = await getStatusId('SUPERSEDED');
      await parent.update(
        { status_id: supersededId, updated_by: actorId },
        {
          transaction: tx,
        }
      );
      const typeId = await getTypeId('AWAY_COUNTER');
      const statusId = await getStatusId('PENDING');
      return MatchAgreement.create(
        {
          match_id: matchId,
          type_id: typeId,
          status_id: statusId,
          author_user_id: actorId,
          ground_id: ground.id,
          date_start: kickoff,
          parent_id: parentId,
          created_by: actorId,
          updated_by: actorId,
        },
        { transaction: tx }
      );
    }

    // initial proposal by HOME
    if (!isHome) throw new ServiceError('only_home_can_propose', 403);
    // Validate ground is linked to home team
    const link = await GroundTeam.findOne({
      where: { ground_id: ground.id, team_id: teamCondition },
      transaction: tx,
    });
    if (!link) throw new ServiceError('ground_not_linked_to_home_team', 400);

    if (await anyPendingExists(matchId))
      throw new ServiceError('pending_agreement_exists', 409);

    const typeId = await getTypeId('HOME_PROPOSAL');
    const statusId = await getStatusId('PENDING');
    return MatchAgreement.create(
      {
        match_id: matchId,
        type_id: typeId,
        status_id: statusId,
        author_user_id: actorId,
        ground_id: ground.id,
        date_start: kickoff,
        parent_id: null,
        created_by: actorId,
        updated_by: actorId,
      },
      { transaction: tx }
    );
  });

  // Post-commit notifications
  try {
    const ground = await Ground.findByPk(created.ground_id);
    const ctx = buildEventContext(match, {
      groundName: ground?.name || '',
      kickoff: created.date_start,
    });
    if (created.parent_id) {
      // Counter by away -> notify home staff
      ctx.by = 'away';
      const homeUsers = await listTeamUsers(match.team1_id);
      await Promise.all(
        (homeUsers || [])
          .filter((u) => u.email)
          .map((u) =>
            emailService.sendMatchAgreementCounterProposedEmail(u, ctx)
          )
      );
    } else {
      // Initial by home -> notify away staff
      ctx.by = 'home';
      const awayUsers = await listTeamUsers(match.team2_id);
      await Promise.all(
        (awayUsers || [])
          .filter((u) => u.email)
          .map((u) => emailService.sendMatchAgreementProposedEmail(u, ctx))
      );
    }
  } catch {
    // Non-fatal
  }

  return created;
}

async function approve(agreementId, actorId) {
  // Phase 1: pre-validate and ensure external DB is updated successfully.
  const agr = await MatchAgreement.findByPk(agreementId, {
    include: [Match, MatchAgreementType, MatchAgreementStatus],
  });
  if (!agr) throw new ServiceError('agreement_not_found', 404);
  const match = await ensureMatchWithStatus(agr.Match || agr.match_id);
  if (!match) throw new ServiceError('match_not_found', 404);
  ensureNotLocked(match);
  ensureNotCancelled(match);
  if (isPast(match.date_start) || isPast(agr.date_start))
    throw new ServiceError('match_already_past', 409);

  if (agr.MatchAgreementStatus?.alias !== 'PENDING')
    throw new ServiceError('agreement_not_pending', 409);

  const context = await ensureUserSide(actorId, match);
  assertAgreementsAllowed(context);
  const { isHome, isAway } = context;

  let approvalTypeAlias = null;
  if (agr.MatchAgreementType?.alias === 'HOME_PROPOSAL') {
    if (!isAway) throw new ServiceError('only_away_can_approve_home', 403);
    approvalTypeAlias = 'AWAY_APPROVAL';
  } else if (agr.MatchAgreementType?.alias === 'AWAY_COUNTER') {
    if (!isHome) throw new ServiceError('only_home_can_approve_away', 403);
    approvalTypeAlias = 'HOME_APPROVAL';
  } else {
    throw new ServiceError('unsupported_agreement_type', 400);
  }

  if (await anyAcceptedExists(match.id))
    throw new ServiceError('agreement_already_accepted', 409);

  // Attempt external sync first (UTC -> MSK shift handled inside)
  try {
    await externalSync.syncApprovedMatchToExternal({
      matchId: match.id,
      groundId: agr.ground_id,
      dateStart: agr.date_start,
    });
  } catch (err) {
    const code =
      err?.code === 'EXTERNAL_DB_UNAVAILABLE'
        ? 'external_db_unavailable'
        : 'external_sync_failed';
    throw new ServiceError(code, 502);
  }

  // Phase 2: finalize acceptance inside a transaction.
  const res = await sequelize.transaction(async (tx) => {
    const fresh = await MatchAgreement.findByPk(agreementId, {
      include: [MatchAgreementType, MatchAgreementStatus],
      transaction: tx,
      lock: { level: tx.LOCK.UPDATE, of: MatchAgreement },
    });
    if (!fresh) throw new ServiceError('agreement_not_found', 404);
    if (fresh.MatchAgreementStatus?.alias !== 'PENDING')
      throw new ServiceError('agreement_not_pending', 409);

    const acceptedId = await getStatusId('ACCEPTED');
    const approvalTypeId = await getTypeId(approvalTypeAlias);

    await fresh.update(
      { status_id: acceptedId, updated_by: actorId },
      { transaction: tx }
    );
    await MatchAgreement.create(
      {
        match_id: match.id,
        type_id: approvalTypeId,
        status_id: acceptedId,
        author_user_id: actorId,
        ground_id: agr.ground_id,
        date_start: agr.date_start,
        parent_id: fresh.id,
        created_by: actorId,
        updated_by: actorId,
      },
      { transaction: tx }
    );

    const patch = {
      ground_id: agr.ground_id,
      date_start: agr.date_start,
      updated_by: actorId,
    };
    if (typeof match.update === 'function') {
      await match.update(patch, { transaction: tx });
    } else if (typeof Match.update === 'function') {
      await Match.update(patch, { where: { id: match.id }, transaction: tx });
    }

    return { ok: true };
  });

  // Post-commit notifications (both teams): Approved
  try {
    const withIncludes = await Match.findByPk(match.id, {
      include: [
        { model: Team, as: 'HomeTeam' },
        { model: Team, as: 'AwayTeam' },
        { model: Ground },
        { model: Tournament },
        { model: TournamentGroup },
        { model: Tour },
      ],
    });
    const ground = await Ground.findByPk(agr.ground_id);
    const ctx = buildEventContext(withIncludes || match, {
      groundName: ground?.name || '',
      kickoff: agr.date_start,
    });
    const [homeUsers, awayUsers] = await Promise.all([
      listTeamUsers(match.team1_id),
      listTeamUsers(match.team2_id),
    ]);
    const recipients = [...(homeUsers || []), ...(awayUsers || [])].filter(
      (u) => u.email
    );
    await Promise.all(
      recipients.map((u) =>
        emailService.sendMatchAgreementApprovedEmail(u, ctx)
      )
    );
  } catch {
    // ignore notification errors
  }

  return res;
}

async function decline(agreementId, actorId) {
  const result = await sequelize.transaction(async (tx) => {
    const agr = await MatchAgreement.findByPk(agreementId, {
      include: [Match, MatchAgreementType, MatchAgreementStatus],
      transaction: tx,
    });
    if (!agr) throw new ServiceError('agreement_not_found', 404);
    const match = await ensureMatchWithStatus(
      agr.Match || (await Match.findByPk(agr.match_id, { transaction: tx }))
    );
    if (!match) throw new ServiceError('match_not_found', 404);
    ensureNotLocked(match);
    if (isPast(match.date_start) || isPast(agr.date_start))
      throw new ServiceError('match_already_past', 409);

    if (agr.MatchAgreementStatus?.alias !== 'PENDING')
      throw new ServiceError('agreement_not_pending', 409);

    const context = await ensureUserSide(actorId, match);
    assertAgreementsAllowed(context);
    const { isHome, isAway } = context;
    let approvalTypeAlias = null;
    if (agr.MatchAgreementType?.alias === 'HOME_PROPOSAL') {
      if (!isAway) throw new ServiceError('only_away_can_decline_home', 403);
      approvalTypeAlias = 'AWAY_APPROVAL';
    } else if (agr.MatchAgreementType?.alias === 'AWAY_COUNTER') {
      if (!isHome) throw new ServiceError('only_home_can_decline_away', 403);
      approvalTypeAlias = 'HOME_APPROVAL';
    } else {
      throw new ServiceError('unsupported_agreement_type', 400);
    }

    const declinedId = await getStatusId('DECLINED');
    const approvalTypeId = await getTypeId(approvalTypeAlias);

    await agr.update(
      { status_id: declinedId, updated_by: actorId },
      { transaction: tx }
    );
    await MatchAgreement.create(
      {
        match_id: match.id,
        type_id: approvalTypeId,
        status_id: declinedId,
        author_user_id: actorId,
        ground_id: agr.ground_id,
        date_start: agr.date_start,
        parent_id: agr.id,
        created_by: actorId,
        updated_by: actorId,
      },
      { transaction: tx }
    );

    return { ok: true };
  });

  // Post-commit notifications: Declined
  try {
    const agr = await MatchAgreement.findByPk(agreementId, {
      include: [Match, MatchAgreementType],
    });
    if (agr?.Match) {
      const match = await Match.findByPk(agr.match_id, {
        include: [
          { model: Team, as: 'HomeTeam' },
          { model: Team, as: 'AwayTeam' },
          { model: Ground },
          { model: Tournament },
          { model: TournamentGroup },
          { model: Tour },
        ],
      });
      const ground = await Ground.findByPk(agr.ground_id);
      const ctx = buildEventContext(match, {
        groundName: ground?.name || '',
        kickoff: agr.date_start,
      });
      const [homeUsers, awayUsers] = await Promise.all([
        listTeamUsers(match.team1_id),
        listTeamUsers(match.team2_id),
      ]);
      const recipients = [...(homeUsers || []), ...(awayUsers || [])].filter(
        (u) => u.email
      );
      await Promise.all(
        recipients.map((u) =>
          emailService.sendMatchAgreementDeclinedEmail(u, ctx)
        )
      );
    }
  } catch {
    // ignore
  }

  return result;
}

export default { list, create, approve, decline, withdraw };

// List available grounds for proposals/counters.
// Defaults to HOME team grounds, extending with AWAY grounds when the Moscow rule applies.
async function listAvailableGrounds(matchId, actorId) {
  const match = await Match.findByPk(matchId, {
    include: [
      {
        model: Team,
        as: 'HomeTeam',
        include: [{ model: Club }],
      },
      {
        model: Team,
        as: 'AwayTeam',
        include: [{ model: Club }],
      },
      {
        model: Tournament,
        include: [{ model: TournamentType }],
      },
      { model: GameStatus },
    ],
  });
  if (!match) throw new ServiceError('match_not_found', 404);
  const context = await ensureUserSide(actorId, match);
  assertAgreementsAllowed(context);

  const allowedTeamIds = buildAllowedGroundTeamIds(match);
  if (!allowedTeamIds.length)
    throw new ServiceError('team_not_set_for_match', 400);

  const homeTeamId = match.team1_id;
  const isCancelled =
    (match.GameStatus?.alias || '').toUpperCase() === 'CANCELLED';
  const allowGuestSelection = canUseGuestGroundSelection(match);

  const mapGroundOptions = (list) =>
    list
      .map((g) => ({ id: g.id, name: g.name }))
      .filter((g) => Boolean(g.id) && Boolean(g.name));

  async function fetchGroundOptions(teamId) {
    if (!teamId) return [];
    const rows = await Ground.findAll({
      include: [
        {
          model: Team,
          where: { id: teamId },
          attributes: [],
          through: { attributes: [] },
          required: true,
        },
      ],
      includeIgnoreAttributes: false,
      order: [['name', 'ASC']],
    });
    return mapGroundOptions(rows);
  }

  const groups = [];
  if (!isPast(match.date_start) && !isCancelled) {
    const homeGrounds = await fetchGroundOptions(homeTeamId);
    if (homeGrounds.length) {
      const homeClub = match.HomeTeam?.Club || null;
      groups.push({
        club: homeClub
          ? {
              id: homeClub.id,
              name: homeClub.name,
              is_moscow: normalizeClubMoscowFlag(homeClub),
            }
          : null,
        grounds: homeGrounds,
      });
    }

    if (allowGuestSelection && match.team2_id) {
      const awayGrounds = await fetchGroundOptions(match.team2_id);
      if (awayGrounds.length) {
        const awayClub = match.AwayTeam?.Club || null;
        groups.push({
          club: awayClub
            ? {
                id: awayClub.id,
                name: awayClub.name,
                is_moscow: normalizeClubMoscowFlag(awayClub),
              }
            : null,
          grounds: awayGrounds,
        });
      }
    }
  }

  const primaryClub = match.HomeTeam?.Club
    ? {
        id: match.HomeTeam.Club.id,
        name: match.HomeTeam.Club.name,
        is_moscow: normalizeClubMoscowFlag(match.HomeTeam.Club),
      }
    : null;

  return {
    club: primaryClub,
    grounds: groups[0]?.grounds ?? [],
    groups,
    allow_guest_ground_selection: allowGuestSelection,
  };
}

export { listAvailableGrounds };

// Withdraw a pending proposal by its author side (home can withdraw HOME_PROPOSAL; away can withdraw AWAY_COUNTER)
async function withdraw(agreementId, actorId) {
  const result = await sequelize.transaction(async (tx) => {
    const agr = await MatchAgreement.findByPk(agreementId, {
      include: [Match, MatchAgreementType, MatchAgreementStatus],
      transaction: tx,
    });
    if (!agr) throw new ServiceError('agreement_not_found', 404);
    if (agr.MatchAgreementStatus?.alias !== 'PENDING')
      throw new ServiceError('agreement_not_pending', 409);

    const match =
      agr.Match || (await Match.findByPk(agr.match_id, { transaction: tx }));
    ensureNotLocked(match);
    const context = await ensureUserSide(actorId, match);
    assertAgreementsAllowed(context);
    const { isHome, isAway } = context;

    // Only the initiator side may withdraw
    if (
      (agr.MatchAgreementType?.alias === 'HOME_PROPOSAL' && !isHome) ||
      (agr.MatchAgreementType?.alias === 'AWAY_COUNTER' && !isAway)
    ) {
      throw new ServiceError('only_author_side_can_withdraw', 403);
    }

    // Mark as withdrawn
    let statusId;
    try {
      statusId = await getStatusId('WITHDRAWN');
    } catch {
      statusId = await getStatusId('SUPERSEDED');
    }

    await agr.update(
      { status_id: statusId, updated_by: actorId },
      {
        transaction: tx,
      }
    );
    return { ok: true };
  });

  // Post-commit notifications: Withdrawn -> notify opponent side
  try {
    const agr = await MatchAgreement.findByPk(agreementId, {
      include: [Match, MatchAgreementType],
    });
    if (agr?.Match) {
      const match = await Match.findByPk(agr.match_id, {
        include: [
          { model: Team, as: 'HomeTeam' },
          { model: Team, as: 'AwayTeam' },
          { model: Ground },
          { model: Tournament },
          { model: TournamentGroup },
          { model: Tour },
        ],
      });
      const ground = await Ground.findByPk(agr.ground_id);
      const ctx = buildEventContext(match, {
        groundName: ground?.name || '',
        kickoff: agr.date_start,
      });
      const notifyTeamId =
        agr.MatchAgreementType?.alias === 'HOME_PROPOSAL'
          ? match.team2_id
          : match.team1_id;
      const users = await listTeamUsers(notifyTeamId);
      await Promise.all(
        (users || [])
          .filter((u) => u.email)
          .map((u) => emailService.sendMatchAgreementWithdrawnEmail(u, ctx))
      );
    }
  } catch {
    // ignore
  }

  return result;
}

export { withdraw };
