import { v4 as uuidv4 } from 'uuid';
import onFinished from 'on-finished';

import Log from '../models/log.js';
import logger from '../../logger.js';

const SENSITIVE_KEYS = [
  'password',
  'new_password',
  'old_password',
  'password_confirmation',
  'refresh_token',
  'refreshToken',
  'access_token',
  'token',
  'code',
];

function isReadonlyDbError(err) {
  return (
    err?.parent?.code === '25006' || /read[- ]only/i.test(err?.message || '')
  );
}

/**
 * Middleware сохраняет каждый запрос+ответ в таблицу `logs`.
 * — фиксирует время запроса,
 * — после отправки ответа создаёт запись в БД.
 */
export default function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  function redact(value) {
    if (Array.isArray(value)) return value.map((v) => redact(v));
    if (value && typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        if (SENSITIVE_KEYS.includes(k)) continue; // drop sensitive key
        out[k] = redact(v);
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
    } catch {
      return originalUrl;
    }
  }

  // Дождаться завершения ответа
  onFinished(res, async () => {
    const duration = Number((process.hrtime.bigint() - start) / 1_000_000n); // ms
    try {
      let bodyClone = null;
      if (req.body && typeof req.body === 'object') {
        bodyClone = redact(req.body);
        try {
          if (
            bodyClone &&
            typeof bodyClone === 'object' &&
            !Array.isArray(bodyClone) &&
            Object.keys(bodyClone).length === 0
          ) {
            bodyClone = null;
          }
        } catch (_) {
          /* noop */
        }
      }

      await Log.create(
        {
          id: uuidv4(),
          user_id: req.user?.id || null, // появится после внедрения auth
          method: req.method,
          path: maskUrl(req.originalUrl || req.url || ''),
          status_code: res.statusCode,
          ip: req.ip,
          user_agent: req.get('user-agent') || '',
          response_time: duration,
          request_body: bodyClone,
          response_body: res.locals.body ?? null, // заполни, если нужен body
        },
        { logging: false }
      );
    } catch (err) {
      if (!isReadonlyDbError(err)) {
        logger.warn('DB log persistence failed: %s', err.message);
      }
    }
  });

  next();
}
