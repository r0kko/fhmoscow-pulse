import { reconcileForMatch } from '../services/gamePenaltySyncService.js';
import {
  GamePenalty,
  Player,
  GameViolation,
  PenaltyMinutes,
} from '../models/index.js';
import playerMapper from '../mappers/playerMapper.js';

export async function reconcile(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const { ok, reason, upserts, softDeleted } = await reconcileForMatch(
      req.params.id,
      actorId
    );
    if (!ok)
      return res.status(400).json({ error: reason || 'reconcile_failed' });
    return res.json({ ok: true, upserts, softDeleted });
  } catch (e) {
    next(e);
  }
}

export default { reconcile };

export async function list(req, res, next) {
  try {
    const matchId = req.params.id;
    const rows = await GamePenalty.findAll({
      where: { game_id: matchId },
      include: [
        {
          model: Player,
          attributes: ['id', 'external_id', 'surname', 'name', 'patronymic'],
        },
        {
          model: GameViolation,
          attributes: ['id', 'external_id', 'name', 'full_name'],
        },
        { model: PenaltyMinutes, attributes: ['id', 'external_id', 'name'] },
      ],
      order: [
        ['period', 'ASC'],
        ['minute', 'ASC'],
        ['second', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });

    const formatClock = (m, s) =>
      `${String(m ?? 0).padStart(2, '0')}:${String(s ?? 0).padStart(2, '0')}`;

    const items = rows.map((r) => ({
      id: r.id,
      external_id: r.external_id,
      period: r.period,
      minute: r.minute,
      second: r.second,
      clock: formatClock(r.minute, r.second),
      team_penalty: !!r.team_penalty,
      player: playerMapper.toPublic(r.Player) || null,
      violation: r.GameViolation
        ? {
            id: r.GameViolation.id,
            external_id: r.GameViolation.external_id,
            name: r.GameViolation.name,
            full_name: r.GameViolation.full_name,
          }
        : null,
      minutes: r.PenaltyMinutes
        ? {
            id: r.PenaltyMinutes.id,
            external_id: r.PenaltyMinutes.external_id,
            name: r.PenaltyMinutes.name,
          }
        : null,
    }));

    return res.json({ items });
  } catch (e) {
    next(e);
  }
}

export { list as listPenalties };
