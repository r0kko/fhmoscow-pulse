import { v4 as uuidv4 } from 'uuid';
import onFinished from 'on-finished';

import Log from '../models/log.js';
import logger from '../../logger.js';

/**
 * Middleware сохраняет каждый запрос+ответ в таблицу `logs`.
 * — фиксирует время запроса,
 * — после отправки ответа создаёт запись в БД.
 */
export default function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  // Дождаться завершения ответа
  onFinished(res, async () => {
    const duration = Number((process.hrtime.bigint() - start) / 1_000_000n); // ms
    try {
      await Log.create({
        id: uuidv4(),
        user_id: req.user?.id || null, // появится после внедрения auth
        method: req.method,
        path: req.originalUrl,
        status_code: res.statusCode,
        ip: req.ip,
        user_agent: req.get('user-agent') || '',
        response_time: duration,
        request_body:
          req.body && Object.keys(req.body).length ? req.body : null,
        response_body: res.locals.body ?? null, // заполни, если нужен body
      });
    } catch (err) {
      logger.warn('DB log persistence failed: %s', err.message);
    }
  });

  next();
}
