import service from '../services/matchService.js';

async function listUpcoming(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const matches = await service.listUpcoming(req.user.id, limit);
    res.json({ matches });
  } catch (e) {
    next(e);
  }
}

export default { listUpcoming };
