import service from '../services/matchService.js';
import { isExternalDbAvailable } from '../config/externalMariaDb.js';

async function listUpcoming(req, res, next) {
  try {
    const all = String(req.query.all || '').toLowerCase() === 'true';
    const limit = all ? null : Math.max(1, parseInt(req.query.limit, 10) || 20);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const type = ['home', 'away'].includes(String(req.query.type))
      ? String(req.query.type)
      : 'all';
    const q = (req.query.q || '').toString();

    if (!isExternalDbAvailable()) {
      return res.json({
        matches: [],
        page,
        total_pages: 1,
        external_available: false,
      });
    }

    const { rows, count } = await service.listUpcoming(req.user.id, {
      limit: limit ?? undefined,
      offset: limit ? (page - 1) * limit : undefined,
      type,
      q,
    });
    const totalPages = all ? 1 : Math.max(1, Math.ceil(count / (limit || 1)));
    res.json({
      matches: rows,
      page,
      total_pages: totalPages,
      external_available: true,
    });
  } catch (e) {
    next(e);
  }
}

export default { listUpcoming };
