import { Op } from 'sequelize';

import sequelize from '../config/database.js';
import ServiceError from '../errors/ServiceError.js';
import {
  Match,
  Team,
  User,
  Ground,
  GroundTeam,
  Club,
  MatchAgreement,
  MatchAgreementType,
  MatchAgreementStatus,
} from '../models/index.js';
import { utcToMoscow } from '../utils/time.js';

import externalSync from './externalMatchSyncService.js';

function isPast(isoLike) {
  if (!isoLike) return false;
  const t = new Date(isoLike).getTime();
  return !Number.isNaN(t) && t <= Date.now();
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
  const user = await User.findByPk(userId, { include: [Team] });
  if (!user) throw new ServiceError('user_not_found', 404);
  const teamIds = new Set((user.Teams || []).map((t) => t.id));
  const isHome = match.team1_id && teamIds.has(match.team1_id);
  const isAway = match.team2_id && teamIds.has(match.team2_id);
  if (!isHome && !isAway)
    throw new ServiceError('forbidden_not_match_member', 403);
  return { isHome, isAway };
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

async function list(matchId) {
  const match = await Match.findByPk(matchId);
  if (!match) throw new ServiceError('match_not_found', 404);
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

async function create(matchId, payload, actorId) {
  const match = await Match.findByPk(matchId);
  if (!match) throw new ServiceError('match_not_found', 404);
  if (!match.date_start) throw new ServiceError('match_date_not_set', 400);
  if (isPast(match.date_start))
    throw new ServiceError('match_already_past', 409);

  const { isHome, isAway } = await ensureUserSide(actorId, match);

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

  return sequelize.transaction(async (tx) => {
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

      // Validate ground is linked to away team
      const link = await GroundTeam.findOne({
        where: { ground_id: ground.id, team_id: match.team1_id },
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
      where: { ground_id: ground.id, team_id: match.team1_id },
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
}

async function approve(agreementId, actorId) {
  // Phase 1: pre-validate and ensure external DB is updated successfully.
  const agr = await MatchAgreement.findByPk(agreementId, {
    include: [Match, MatchAgreementType, MatchAgreementStatus],
  });
  if (!agr) throw new ServiceError('agreement_not_found', 404);
  const match = agr.Match || (await Match.findByPk(agr.match_id));
  if (!match) throw new ServiceError('match_not_found', 404);
  if (isPast(match.date_start) || isPast(agr.date_start))
    throw new ServiceError('match_already_past', 409);

  if (agr.MatchAgreementStatus?.alias !== 'PENDING')
    throw new ServiceError('agreement_not_pending', 409);

  const { isHome, isAway } = await ensureUserSide(actorId, match);

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
  return sequelize.transaction(async (tx) => {
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

    await match.update(
      {
        ground_id: agr.ground_id,
        date_start: agr.date_start,
        updated_by: actorId,
      },
      { transaction: tx }
    );

    return { ok: true };
  });
}

async function decline(agreementId, actorId) {
  return sequelize.transaction(async (tx) => {
    const agr = await MatchAgreement.findByPk(agreementId, {
      include: [Match, MatchAgreementType, MatchAgreementStatus],
      transaction: tx,
    });
    if (!agr) throw new ServiceError('agreement_not_found', 404);
    const match =
      agr.Match || (await Match.findByPk(agr.match_id, { transaction: tx }));
    if (!match) throw new ServiceError('match_not_found', 404);
    if (isPast(match.date_start) || isPast(agr.date_start))
      throw new ServiceError('match_already_past', 409);

    if (agr.MatchAgreementStatus?.alias !== 'PENDING')
      throw new ServiceError('agreement_not_pending', 409);

    const { isHome, isAway } = await ensureUserSide(actorId, match);
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
}

export default { list, create, approve, decline, withdraw };

// List available grounds for proposals/counters.
// As per business rule, grounds must belong to HOME team for both initial and counter proposals.
async function listAvailableGrounds(matchId, actorId) {
  const match = await Match.findByPk(matchId);
  if (!match) throw new ServiceError('match_not_found', 404);
  await ensureUserSide(actorId, match); // ensure participant

  const homeTeamId = match.team1_id;
  if (!homeTeamId) throw new ServiceError('team_not_set_for_match', 400);

  // Fetch home team with its club for label
  const team = await Team.findByPk(homeTeamId, { include: [Club] });

  const grounds = isPast(match.date_start)
    ? []
    : await Ground.findAll({
        include: [
          {
            model: Team,
            where: { id: homeTeamId },
            attributes: [],
            through: { attributes: [] },
            required: true,
          },
        ],
        includeIgnoreAttributes: false,
        order: [['name', 'ASC']],
      });

  return {
    club: team?.Club ? { id: team.Club.id, name: team.Club.name } : null,
    grounds: grounds.map((g) => ({ id: g.id, name: g.name })),
  };
}

export { listAvailableGrounds };

// Withdraw a pending proposal by its author side (home can withdraw HOME_PROPOSAL; away can withdraw AWAY_COUNTER)
async function withdraw(agreementId, actorId) {
  return sequelize.transaction(async (tx) => {
    const agr = await MatchAgreement.findByPk(agreementId, {
      include: [Match, MatchAgreementType, MatchAgreementStatus],
      transaction: tx,
    });
    if (!agr) throw new ServiceError('agreement_not_found', 404);
    if (agr.MatchAgreementStatus?.alias !== 'PENDING')
      throw new ServiceError('agreement_not_pending', 409);

    const match =
      agr.Match || (await Match.findByPk(agr.match_id, { transaction: tx }));
    const { isHome, isAway } = await ensureUserSide(actorId, match);

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
}

export { withdraw };
