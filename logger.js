import { Writable } from 'stream';

import { createLogger, format, transports } from 'winston';
import { v4 as uuidv4 } from 'uuid';

// Lazy import to avoid ESM module being linked too early across tests.
// This helps prevent "module is already linked" errors when tests mock the model.
let _LogModule = null;
async function getLogModel() {
  if (_LogModule) return _LogModule;
  const mod = await import('./src/models/log.js');
  _LogModule = mod.default || mod;
  return _LogModule;
}

const { combine, timestamp, printf, errors, colorize, json, splat } = format;

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

/**
 * Parse a morgan "combined" log line.
 * Returns { ip, method, path, status, ua, respTime } or null if not matched.
 */
function parseCombined(line) {
  // matches classic "combined" morgan format, with optional response‑time at end
  const match = line.match(
    /^(\S+) .*? "\s*([A-Z]+)\s+(\S+)\s+HTTP\/\d\.\d"\s+(\d{3})\s+(?:\d+|-)\s+"[^"]*"\s+"([^"]*)"(?:\s+(\d+)ms)?$/
  );
  if (!match) return null;
  const [, ip, method, path, status, ua, respTime] = match;
  return {
    ip,
    method,
    path,
    status: Number(status),
    ua,
    respTime: respTime ? Number(respTime) : null,
  };
}

/**
 * Human‑readable format for local development.
 * Shows timestamp, level, message OR stack trace and supports printf‑style interpolation.
 */
const prettyFormat = printf(({ timestamp, level, message, stack }) =>
  `${timestamp} [${level}] ${stack || message}`
);

const logger = createLogger({
  level: isProd ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    splat(),
    isProd ? json() : colorize({ all: true }),
    isProd ? json() : prettyFormat
  ),
  transports: [
    // Persist every access log line to DB
    new transports.Stream({
      stream: new Writable({
        objectMode: true,
        write: async (chunk, _enc, cb) => {
          // Winston passes an info object when objectMode: true
          const line = (chunk.message || '').trim();
          const parsed = parseCombined(line);
          if (!parsed) return cb();

          try {
            const Log = await getLogModel();
            await Log.create({
              id: uuidv4(),
              method: parsed.method,
              path: parsed.path,
              status_code: parsed.status,
              ip: parsed.ip,
              user_agent: parsed.ua,
              response_time: parsed.respTime,
            });
          } catch (err) {
            logger.warn('DB log persistence failed:', err.message);
          } finally {
            cb();
          }
        },
      }),
    }),

    // Console output only in non‑production for developer convenience
    ...(!isProd
      ? [
          new transports.Console({
            format: combine(colorize({ all: true }), prettyFormat),
          }),
        ]
      : []),
  ],
});

export default logger;
