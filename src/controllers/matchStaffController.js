import service from '../services/matchStaffService.js';

async function list(req, res, next) {
  try {
    const data = await service.list(req.params.id, req.user.id);
    res.json(data);
  } catch (e) {
    if (e.code && Number.isFinite(e.code))
      return res.status(e.code).json({ error: e.message });
    next(e);
  }
}

async function set(req, res, next) {
  try {
    const { team_id, staff_ids, staff, if_staff_rev } = req.body || {};
    const data = await service.set(
      req.params.id,
      team_id,
      staff_ids,
      staff,
      req.user.id,
      if_staff_rev || null
    );
    res.json(data);
  } catch (e) {
    if (e.code && Number.isFinite(e.code))
      return res.status(e.code).json({ error: e.message });
    next(e);
  }
}

export default { list, set };
