import service, { listUpcomingLocal } from '../services/matchService.js';
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
    const forceLocal = String(req.query.source || '').toLowerCase() === 'local';

    const external = isExternalDbAvailable();
    if (external && !forceLocal) {
      const { rows, count } = await service.listUpcoming(req.user.id, {
        limit: limit ?? undefined,
        offset: limit ? (page - 1) * limit : undefined,
        type,
        q,
      });
      const totalPages = all ? 1 : Math.max(1, Math.ceil(count / (limit || 1)));
      return res.json({
        matches: rows,
        page,
        total_pages: totalPages,
        external_available: true,
      });
    }

    // Fallback to local imported matches
    const { rows, count } = await listUpcomingLocal(req.user.id, {
      limit: limit ?? undefined,
      offset: limit ? (page - 1) * limit : undefined,
      type,
      q,
    });
    const totalPages = all ? 1 : Math.max(1, Math.ceil(count / (limit || 1)));
    return res.json({
      matches: rows,
      page,
      total_pages: totalPages,
      external_available: false,
    });
  } catch (e) {
    next(e);
  }
}

async function listPast(req, res, next) {
  try {
    const all = String(req.query.all || '').toLowerCase() === 'true';
    const limit = all ? null : Math.max(1, parseInt(req.query.limit, 10) || 20);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const type = ['home', 'away'].includes(String(req.query.type))
      ? String(req.query.type)
      : 'all';
    const q = (req.query.q || '').toString();
    const forceLocal = String(req.query.source || '').toLowerCase() === 'local';
    const seasonId = req.query.season_id || null;

    const external = isExternalDbAvailable();
    if (external && !forceLocal) {
      const { rows, count } = await service.listPast(req.user.id, {
        limit: limit ?? undefined,
        offset: limit ? (page - 1) * limit : undefined,
        type,
        q,
      });
      const totalPages = all ? 1 : Math.max(1, Math.ceil(count / (limit || 1)));
      return res.json({
        matches: rows,
        page,
        total_pages: totalPages,
        external_available: true,
      });
    }

    const { rows, count } = await service.listPastLocal(req.user.id, {
      limit: limit ?? undefined,
      offset: limit ? (page - 1) * limit : undefined,
      type,
      q,
      seasonId,
    });
    const totalPages = all ? 1 : Math.max(1, Math.ceil(count / (limit || 1)));
    return res.json({
      matches: rows,
      page,
      total_pages: totalPages,
      external_available: false,
    });
  } catch (e) {
    next(e);
  }
}

export default { listUpcoming, listPast };
export { listPast };
