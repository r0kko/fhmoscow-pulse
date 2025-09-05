import morgan from 'morgan';
import { context, trace } from '@opentelemetry/api';

// JSON access logs with low cardinality fields and correlation ID
// Only enabled outside of test environment

// Custom token for request id provided by requestId middleware
morgan.token('reqid', (req) => req.id || '-');

// Build a JSON line to stdout; promtail/Loki will parse it easily
const jsonFormat = (tokens, req, res) => {
  const clientIp =
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.ip ||
    req.connection?.remoteAddress ||
    '';
  const line = {
    type: 'access',
    ts: tokens.date(req, res, 'iso'),
    level: 'info',
    req_id: tokens.reqid(req, res),
    method: tokens.method(req, res),
    path: tokens.url(req, res),
    status: Number(tokens.status(req, res) || 0),
    length: Number(tokens.res(req, res, 'content-length') || 0),
    rt_ms: Number(tokens['response-time'](req, res) || 0),
    ip: tokens['remote-addr'](req, res),
    client_ip: String(clientIp),
    ua: tokens['user-agent'](req, res),
    ref: tokens.referrer(req, res),
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
