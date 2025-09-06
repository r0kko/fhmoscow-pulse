import { reconcileForMatch } from '../services/broadcastSyncService.js';

export async function reconcile(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const { ok, reason } = await reconcileForMatch(req.params.id, actorId);
    if (!ok)
      return res.status(400).json({ error: reason || 'reconcile_failed' });
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export default { reconcile };
