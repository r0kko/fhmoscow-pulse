import express from 'express';
import { Op } from 'sequelize';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
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

// GET /reports/http-errors.csv — endpoint retired in favour of Grafana dashboards
router.get('/http-errors.csv', auth, authorize('ADMIN'), (req, res) => {
  const grafanaUrl =
    process.env.GRAFANA_HTTP_ERRORS_DASHBOARD ||
    (process.env.GRAFANA_URL
      ? `${process.env.GRAFANA_URL.replace(/\/+$/, '')}/d/pulse-app-http-drill/app-http-drill`
      : null);
  if (grafanaUrl) res.setHeader('Location', grafanaUrl);
  return res.status(410).json({
    error: 'report_deprecated',
    detail:
      'Экспорт HTTP-ошибок перенесён в Grafana. Используйте соответствующий дашборд.',
    grafana_url: grafanaUrl,
  });
});

export default router;
