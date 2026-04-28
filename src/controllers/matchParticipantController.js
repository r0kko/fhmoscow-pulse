import service from '../services/matchParticipantService.js';

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

export default { list };
