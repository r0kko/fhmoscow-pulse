import service from '../services/matchLineupService.js';

async function list(req, res, next) {
  try {
    const data = await service.list(req.params.id, req.user.id);
    res.json(data);
  } catch (e) {
    if (e.code && Number.isFinite(e.code)) {
      return res.status(e.code).json({ error: e.message });
    }
    next(e);
  }
}

async function set(req, res, next) {
  try {
    const { team_id, player_ids, players, if_match_rev } = req.body || {};
    const payload = Array.isArray(players) ? players : player_ids;
    const data = await service.set(
      req.params.id,
      team_id,
      payload,
      req.user.id,
      if_match_rev || null
    );
    res.json(data);
  } catch (e) {
    if (e.code && Number.isFinite(e.code)) {
      return res.status(e.code).json({ error: e.message });
    }
    next(e);
  }
}

export default { list, set };
