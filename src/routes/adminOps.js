import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import { getJobStats } from '../config/metrics.js';
import { getSyncStates } from '../services/syncStateService.js';
// Lazy-load job modules inside handlers to avoid heavy imports during test bootstrap
import JobLog from '../models/jobLog.js';
import { buildJobLockKey, forceDeleteLock } from '../utils/redisLock.js';
import penaltyService from '../services/gamePenaltySyncService.js';
import deletionService from '../services/gameEventDeletionSyncService.js';

const router = express.Router();

// GET /admin-ops/sync/status — summary of sync-related jobs
router.get('/sync/status', auth, authorize('ADMIN'), async (_req, res) => {
  try {
    const jobs = [
      'syncAll',
      'clubSync',
      'groundSync',
      'teamSync',
      'staffSync',
      'playerSync',
      'tournamentSync',
      'gameEventTypeSync',
      'penaltyMinutesSync',
      'gameSituationSync',
      'gameViolationSync',
      'broadcastLinkSync',
      'gamePenaltySync',
      'gameEventDeletionSync',
    ];
    const stats = await getJobStats(jobs);
    const states = await getSyncStates(jobs);
    // Return latest job logs (per job) for context
    let logs = [];
    try {
      logs = await JobLog.findAll({
        attributes: [
          'id',
          'job',
          'status',
          'started_at',
          'finished_at',
          'duration_ms',
          'message',
          'error_message',
        ],
        order: [['started_at', 'DESC']],
        limit: 50,
      });
    } catch {
      /* ignore */
    }
    let running = false;
    try {
      const mod = await import('../jobs/syncAllCron.js');
      running = mod.isSyncAllRunning?.() || false;
    } catch {
      /* empty */
    }
    return res.json({
      jobs: stats,
      states,
      running: { syncAll: running },
      logs,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: 'metrics_error', detail: err?.message });
  }
});

// POST /admin-ops/sync/run — trigger orchestrator; fire-and-forget
router.post('/sync/run', auth, authorize('ADMIN'), async (_req, res) => {
  try {
    const mod = await import('../jobs/syncAllCron.js');
    try {
      mod.default?.();
    } catch {
      /* empty */
    }
    const already = mod.isSyncAllRunning?.() || false;
    mod.runSyncAll?.().catch(() => {});
    return res.status(202).json({ queued: true, already_running: already });
  } catch (err) {
    return res
      .status(500)
      .json({ error: 'sync_trigger_failed', detail: err?.message });
  }
});

// Taxation ops
router.get('/taxation/status', auth, authorize('ADMIN'), async (_req, res) => {
  try {
    const stats = await getJobStats(['taxation']);
    const states = await getSyncStates(['taxation']);
    let running = false;
    try {
      const mod = await import('../jobs/taxationCron.js');
      running = mod.isTaxationRunning?.() || false;
    } catch {
      /* empty */
    }
    return res.json({ jobs: stats, states, running: { taxation: running } });
  } catch (err) {
    return res
      .status(500)
      .json({ error: 'metrics_error', detail: err?.message });
  }
});

export default router;

router.post('/taxation/run', auth, authorize('ADMIN'), async (req, res) => {
  try {
    const mod = await import('../jobs/taxationCron.js');
    const already = mod.isTaxationRunning?.() || false;
    const batch = Number(req.body?.batch) || undefined;
    mod.runTaxationCheck?.({ batch }).catch(() => {});
    return res.status(202).json({ queued: true, already_running: already });
  } catch (err) {
    return res
      .status(500)
      .json({ error: 'taxation_trigger_failed', detail: err?.message });
  }
});

// Manual: reconcile penalties for a custom rolling window (admin backfill)
router.post(
  '/penalties/sync-window',
  auth,
  authorize('ADMIN'),
  async (req, res) => {
    try {
      const daysBack = Number(req.body?.daysBack);
      const daysAhead = Number(req.body?.daysAhead);
      const limit = Number(req.body?.limit);
      const actorId = req.user?.id || null;
      const stats = await penaltyService.reconcileWindow({
        daysBack: Number.isFinite(daysBack) ? daysBack : undefined,
        daysAhead: Number.isFinite(daysAhead) ? daysAhead : undefined,
        limit: Number.isFinite(limit) ? limit : undefined,
        actorId,
      });
      return res.json({ ok: true, stats });
    } catch (err) {
      return res
        .status(500)
        .json({ error: 'external_sync_failed', detail: err?.message });
    }
  }
);

// Manual: run deletions-only reconcile for penalties
router.post(
  '/penalties/reap-orphans',
  auth,
  authorize('ADMIN'),
  async (req, res) => {
    try {
      const batchSize = Number(req.body?.batchSize);
      const maxBatches = Number(req.body?.maxBatches);
      const actorId = req.user?.id || null;
      const stats = await deletionService.reapOrphans({
        batchSize: Number.isFinite(batchSize) ? batchSize : undefined,
        maxBatches: Number.isFinite(maxBatches) ? maxBatches : undefined,
        actorId,
      });
      return res.json({ ok: true, stats });
    } catch (err) {
      return res
        .status(500)
        .json({ error: 'external_sync_failed', detail: err?.message });
    }
  }
);

// POST /admin-ops/jobs/reset — force-release lock and reset running state (admin recovery)
router.post('/jobs/reset', auth, authorize('ADMIN'), async (req, res) => {
  const job = String(req.body?.job || '').trim();
  const allowed = new Set([
    'syncAll',
    'taxation',
    'clubSync',
    'groundSync',
    'teamSync',
    'staffSync',
    'playerSync',
    'tournamentSync',
    'gameEventTypeSync',
    'penaltyMinutesSync',
    'gameSituationSync',
    'gameViolationSync',
    'broadcastLinkSync',
    'gamePenaltySync',
    'gameEventDeletionSync',
  ]);
  if (!allowed.has(job)) return res.status(400).json({ error: 'invalid_job' });
  try {
    // Reset internal flags if applicable (dynamic import to tolerate test mocks)
    if (job === 'syncAll') {
      try {
        const mod = await import('../jobs/syncAllCron.js');
        mod.resetSyncAllState?.();
      } catch {
        /* empty */
      }
    }
    if (job === 'taxation') {
      try {
        const mod = await import('../jobs/taxationCron.js');
        mod.resetTaxationState?.();
      } catch {
        /* empty */
      }
    }
    // Force delete Redis lock key
    const key = buildJobLockKey(job);
    const ok = await forceDeleteLock(key);
    return res.json({ ok, job });
  } catch (err) {
    return res
      .status(500)
      .json({ error: 'reset_failed', detail: err?.message });
  }
});

// POST /admin-ops/jobs/restart — restart cron task (only for schedulers)
router.post('/jobs/restart', auth, authorize('ADMIN'), async (req, res) => {
  const job = String(req.body?.job || '').trim();
  try {
    if (job === 'syncAll') {
      try {
        const mod = await import('../jobs/syncAllCron.js');
        mod.restartSyncAllCron?.();
        return res.json({ ok: true, job });
      } catch {
        /* empty */
      }
    }
    if (job === 'taxation') {
      try {
        const mod = await import('../jobs/taxationCron.js');
        mod.restartTaxationCron?.();
        return res.json({ ok: true, job });
      } catch {
        /* empty */
      }
    }
    return res.status(400).json({ error: 'job_not_restartable' });
  } catch (err) {
    return res
      .status(500)
      .json({ error: 'restart_failed', detail: err?.message });
  }
});
