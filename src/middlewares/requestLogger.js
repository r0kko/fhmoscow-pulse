import onFinished from 'on-finished';
import { context, trace } from '@opentelemetry/api';

import logger from '../../logger.js';

const SENSITIVE_KEYS = [
  'password',
  'new_password',
  'old_password',
  'password_confirmation',
  'password_b64',
  'pwd',
  'p',
  'refresh_token',
  'refreshToken',
  'access_token',
  'token',
  'code',
  // Personal identifiers
  'snils',
  'inn',
  'passport',
  'passport_series',
  'passport_number',
  'issuing_authority',
  'issuing_authority_code',
  // Banking
  'bank_account',
  'bank_card',
  'card_number',
  'account',
  'iban',
  'bic',
  'swift',
];

const DEFAULT_MAX_BODY_BYTES = parseInt(
  process.env.LOG_REQUEST_BODY_MAX_BYTES || '16384',
  10
);
const DEFAULT_MAX_RESPONSE_BYTES = parseInt(
  process.env.LOG_RESPONSE_BODY_MAX_BYTES || '16384',
  10
);

function redact(value) {
  if (Array.isArray(value)) return value.map((v) => redact(v));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEYS.includes(key)) continue;
      out[key] = redact(val);
    }
    return out;
  }
  return value;
}

function maskUrl(originalUrl) {
  try {
    const u = new URL(originalUrl, 'http://local');
    const params = u.searchParams;
    let changed = false;
    for (const key of Array.from(params.keys())) {
      if (SENSITIVE_KEYS.includes(key)) {
        params.set(key, 'redacted');
        changed = true;
      }
    }
    return changed ? `${u.pathname}?${params.toString()}` : originalUrl;
  } catch (_e) {
    return originalUrl;
  }
}

function attachTrace(payload) {
  try {
    const span = trace.getSpan(context.active());
    if (span && typeof span.spanContext === 'function') {
      const ctx = span.spanContext();
      if (ctx?.traceId) payload.trace_id = ctx.traceId;
      if (ctx?.spanId) payload.span_id = ctx.spanId;
    }
  } catch (_e) {
    /* noop */
  }
}

function clampJsonBytes(value, limit) {
  if (!value) return value;
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length <= limit) return value;
    return { truncated: true, approx_size_bytes: serialized.length };
  } catch (_e) {
    return { truncated: true };
  }
}

function normalizeObjectOrNull(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.keys(value).length ? value : null;
}

/**
 * Structured HTTP audit logging (stdout → Loki/Grafana).
 */
export default function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  onFinished(res, () => {
    const duration = Number((process.hrtime.bigint() - start) / 1_000_000n);

    let requestBody = null;
    if (req.body && typeof req.body === 'object') {
      requestBody = clampJsonBytes(redact(req.body), DEFAULT_MAX_BODY_BYTES);
      requestBody = normalizeObjectOrNull(requestBody);
    }

    let responseBody = null;
    if (res.locals?.body && typeof res.locals.body === 'object') {
      responseBody = clampJsonBytes(
        redact(res.locals.body),
        DEFAULT_MAX_RESPONSE_BYTES
      );
      responseBody = normalizeObjectOrNull(responseBody);
    } else if (typeof res.locals?.body === 'string') {
      const val = res.locals.body;
      responseBody =
        val.length > DEFAULT_MAX_RESPONSE_BYTES
          ? { truncated: true, approx_size_bytes: val.length }
          : val;
    }

    const payload = {
      event: 'http.audit',
      req_id: req.id || null,
      user_id: req.user?.id || null,
      method: req.method,
      path: maskUrl(req.originalUrl || req.url || ''),
      route: req.route?.path || null,
      status_code: res.statusCode,
      ip: req.ip,
      user_agent: req.get?.('user-agent') || '',
      response_time_ms: duration,
      request_body: requestBody,
      response_body: responseBody,
    };

    attachTrace(payload);

    if (
      res.locals?.observability &&
      typeof res.locals.observability === 'object'
    ) {
      try {
        payload.tags = redact(res.locals.observability);
      } catch (_e) {
        payload.tags = { invalid: true };
      }
    }

    try {
      logger.info('http.audit', payload);
    } catch (err) {
      logger.warn('Failed to emit http audit log: %s', err?.message || err);
    }
  });

  next();
}
