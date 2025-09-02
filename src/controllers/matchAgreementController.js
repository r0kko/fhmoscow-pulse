import service, {
  listAvailableGrounds,
} from '../services/matchAgreementService.js';
import { Match, Team, User } from '../models/index.js';
import { listTeamUsers } from '../services/teamService.js';
import userMapper from '../mappers/userMapper.js';

async function list(req, res, next) {
  try {
    const rows = await service.list(req.params.id);
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
    const match = await Match.findByPk(req.params.id, {
      attributes: ['id', 'team1_id', 'team2_id'],
    });
    if (!match) return res.status(404).json({ error: 'match_not_found' });
    const user = await User.findByPk(req.user.id, { include: [Team] });
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    const teamIds = new Set((user.Teams || []).map((t) => t.id));
    const isHome = match.team1_id && teamIds.has(match.team1_id);
    const isAway = match.team2_id && teamIds.has(match.team2_id);
    if (!match.team1_id && !match.team2_id)
      return res.status(409).json({ error: 'match_teams_not_set' });
    if (!isHome && !isAway)
      return res.status(403).json({ error: 'forbidden_not_match_member' });
    const opponentTeamId = isHome ? match.team2_id : match.team1_id;
    if (!opponentTeamId)
      return res.status(400).json({ error: 'opponent_team_not_set' });
    const users = await listTeamUsers(opponentTeamId);
    return res.json({ users: userMapper.toPublicArray(users) });
  } catch (e) {
    next(e);
  }
}
