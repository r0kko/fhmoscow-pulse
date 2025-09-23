import service, {
  listAvailableGrounds,
} from '../services/matchAgreementService.js';
import { listTeamUsers } from '../services/teamService.js';
import userMapper from '../mappers/userMapper.js';
import {
  resolveMatchAccessContext,
  evaluateStaffMatchRestrictions,
  ensureParticipantOrThrow,
} from '../utils/matchAccess.js';

async function list(req, res, next) {
  try {
    const rows = await service.list(req.params.id, req.user.id);
    res.json({ agreements: rows });
  } catch (e) {
    next(e);
  }
}

async function create(req, res, next) {
  try {
    const created = await service.create(req.params.id, req.body, req.user.id);
    res.status(201).json({ agreement: created });
  } catch (e) {
    next(e);
  }
}

async function approve(req, res, next) {
  try {
    await service.approve(req.params.agreementId, req.user.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

async function decline(req, res, next) {
  try {
    await service.decline(req.params.agreementId, req.user.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export default { list, create, approve, decline, withdraw };

export async function availableGrounds(req, res, next) {
  try {
    const data = await listAvailableGrounds(req.params.id, req.user.id);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function withdraw(req, res, next) {
  try {
    await service.withdraw(req.params.agreementId, req.user.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

// Contacts of the opponent team for a given match, accessible to match participants (staff/admin)
export async function opponentContacts(req, res, next) {
  try {
    const context = await resolveMatchAccessContext({
      matchOrId: req.params.id,
      userId: req.user.id,
    });
    const { match } = context;
    if (!match) return res.status(404).json({ error: 'match_not_found' });
    if (!match.team1_id && !match.team2_id)
      return res.status(409).json({ error: 'match_teams_not_set' });
    ensureParticipantOrThrow(context);
    const restrictions = evaluateStaffMatchRestrictions(context);
    if (restrictions.agreementsBlocked)
      return res.status(403).json({ error: 'staff_position_restricted' });
    const opponentTeamId = context.isHome ? match.team2_id : match.team1_id;
    if (!opponentTeamId)
      return res.status(400).json({ error: 'opponent_team_not_set' });
    const users = await listTeamUsers(opponentTeamId);
    return res.json({ users: userMapper.toPublicArray(users) });
  } catch (e) {
    next(e);
  }
}
