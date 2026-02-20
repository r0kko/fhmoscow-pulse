import morgan from 'morgan';
import { context, trace } from '@opentelemetry/api';

import { getClientIp } from '../utils/clientIp.js';

const SENSITIVE_QUERY_KEYS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'code',
  't',
]);

function sanitizeUrl(url) {
  try {
    const raw = String(url || '');
    const parsed = new URL(raw, 'http://local');
    let changed = false;
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (SENSITIVE_QUERY_KEYS.has(String(key).toLowerCase())) {
        parsed.searchParams.set(key, 'redacted');
        changed = true;
      }
    }
    if (!changed) return raw;
    const query = parsed.searchParams.toString();
    return query ? `${parsed.pathname}?${query}` : parsed.pathname;
  } catch {
    return String(url || '');
  }
}

// JSON access logs with low cardinality fields and correlation ID
// Only enabled outside of test environment

// Custom token for request id provided by requestId middleware
morgan.token('reqid', (req) => req.id || '-');
morgan.token('route', (req) => req.route?.path || 'unmatched');
morgan.token('errorcode', (_req, res) => res.getHeader('X-Error-Code') || '');

// Build a JSON line to stdout; promtail/Loki will parse it easily
const jsonFormat = (tokens, req, res) => {
  const clientIp = getClientIp(req);
  const line = {
    type: 'access',
    ts: tokens.date(req, res, 'iso'),
    level: 'info',
    req_id: tokens.reqid(req, res),
    method: tokens.method(req, res),
    path: sanitizeUrl(tokens.url(req, res)),
    route: tokens.route(req, res),
    status: Number(tokens.status(req, res) || 0),
    status_class: `${String(tokens.status(req, res) || 0)[0]}xx`,
    length: Number(tokens.res(req, res, 'content-length') || 0),
    rt_ms: Number(tokens['response-time'](req, res) || 0),
    ip: tokens['remote-addr'](req, res),
    client_ip: String(clientIp),
    ua: tokens['user-agent'](req, res),
    ref: tokens.referrer(req, res),
    error_code: tokens.errorcode(req, res) || undefined,
  };
  try {
    const cfRay = req.headers['cf-ray'];
    if (cfRay) line.cf_ray = String(cfRay);
    const cfCountry = req.headers['cf-ipcountry'] || req.headers['cf-country'];
    if (cfCountry) line.cf_country = String(cfCountry);
  } catch (_e) {
    /* noop */
  }
  try {
    const span = trace.getSpan(context.active());
    if (span && typeof span.spanContext === 'function') {
      const sctx = span.spanContext();
      line.trace_id = sctx?.traceId;
      line.span_id = sctx?.spanId;
    }
  } catch (_e) {
    /* noop */
  }
  try {
    return JSON.stringify(line);
  } catch {
    return '';
  }
};

export default function accessLog() {
  if (process.env.NODE_ENV === 'test') return (_req, _res, next) => next();
  return morgan(jsonFormat);
}
