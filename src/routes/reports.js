import express from 'express';
import { Op, Sequelize } from 'sequelize';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import Log from '../models/log.js';
import JobLog from '../models/jobLog.js';

const router = express.Router();

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function sendCsv(res, filename, headers, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const out = [];
  out.push(headers.map(csvEscape).join(','));
  for (const r of rows) {
    out.push(r.map(csvEscape).join(','));
  }
  res.send(out.join('\n'));
}

// GET /reports/job-runs.csv?days=30
router.get('/job-runs.csv', auth, authorize('ADMIN'), async (req, res) => {
  const days = Math.min(
    Math.max(parseInt(req.query?.days || '30', 10), 1),
    365
  );
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await JobLog.findAll({
    where: { started_at: { [Op.gte]: since } },
    order: [['started_at', 'DESC']],
    limit: 5000,
  });
  const headers = [
    'id',
    'job',
    'status',
    'started_at',
    'finished_at',
    'duration_ms',
    'message',
    'error_message',
  ];
  const data = rows.map((r) => [
    r.id,
    r.job,
    r.status,
    r.started_at?.toISOString?.() || '',
    r.finished_at?.toISOString?.() || '',
    r.duration_ms ?? '',
    r.message ?? '',
    r.error_message ?? '',
  ]);
  return sendCsv(res, `job-runs-last-${days}-days.csv`, headers, data);
});

// GET /reports/http-errors.csv?days=7 — aggregated by path+status
router.get('/http-errors.csv', auth, authorize('ADMIN'), async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query?.days || '7', 10), 1), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  // Use raw query for percentile if available; otherwise fallback to avg/max
  const sequelize = Log.sequelize;
  const supportsPercentile = true; // Postgres
  let rows;
  if (supportsPercentile) {
    rows = await sequelize.query(
      `
        SELECT path,
               status_code,
               COUNT(*) as count,
               ROUND(PERCENTILE_DISC(0.95) WITHIN GROUP (ORDER BY response_time) ::numeric, 0) as p95_ms,
               ROUND(AVG(response_time)::numeric, 0) as avg_ms,
               MAX(response_time) as max_ms
          FROM logs
         WHERE created_at >= :since AND status_code >= 400
         GROUP BY path, status_code
         ORDER BY count DESC
         LIMIT 5000
      `,
      { replacements: { since }, type: Sequelize.QueryTypes.SELECT }
    );
  } else {
    rows = await Log.findAll({
      attributes: [
        'path',
        'status_code',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
        [Sequelize.fn('AVG', Sequelize.col('response_time')), 'avg_ms'],
        [Sequelize.fn('MAX', Sequelize.col('response_time')), 'max_ms'],
      ],
      where: {
        created_at: { [Op.gte]: since },
        status_code: { [Op.gte]: 400 },
      },
      group: ['path', 'status_code'],
      order: [[Sequelize.literal('count'), 'DESC']],
      limit: 5000,
      raw: true,
    });
    rows = rows.map((r) => ({ ...r, p95_ms: null }));
  }
  const headers = [
    'path',
    'status_code',
    'count',
    'p95_ms',
    'avg_ms',
    'max_ms',
  ];
  const data = rows.map((r) => [
    r.path,
    r.status_code,
    r.count,
    r.p95_ms ?? '',
    r.avg_ms ?? '',
    r.max_ms ?? '',
  ]);
  return sendCsv(res, `http-errors-last-${days}-days.csv`, headers, data);
});

export default router;
