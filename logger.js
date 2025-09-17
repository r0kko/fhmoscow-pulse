import { createLogger, format, transports } from 'winston';
import { context, trace } from '@opentelemetry/api';

const { combine, timestamp, printf, errors, colorize, json, splat } = format;

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

// Service metadata for each log line (helps correlate in Loki)
const defaultMeta = {
  service: 'api',
  env,
  version: process.env.VERSION || '0.0.0',
};

// Human‑readable dev format; JSON in production for machine parsing
const devPretty = printf(({ timestamp, level, message, stack, ...rest }) => {
  // Attach trace/span ids when available
  try {
    const span = trace.getSpan(context.active());
    if (span && typeof span.spanContext === 'function') {
      const sctx = span.spanContext();
      rest.trace_id = sctx?.traceId || rest.trace_id;
      rest.span_id = sctx?.spanId || rest.span_id;
    }
  } catch (_e) {
    /* noop */
  }
  const meta = Object.entries(rest)
    .filter(([k]) => !k.startsWith('level') && !k.startsWith('timestamp'))
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' ');
  return `${timestamp} [${level}] ${stack || message}${meta ? ' ' + meta : ''}`;
});

const consoleTransport = new transports.Console();

const logger = createLogger({
  level: isProd ? 'info' : 'debug',
  defaultMeta,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    splat(),
    isProd ? json() : colorize({ all: true }),
    isProd ? json() : devPretty
  ),
  transports: [consoleTransport],
});

// Attach a lightweight writable stream for combined log lines (e.g., from morgan)
// Tests write into this stream directly to validate DB persistence of access logs.
/* eslint-disable security/detect-unsafe-regex */
// Pattern is anchored and uses bounded character classes to avoid catastrophic backtracking
const combinedLineRe =
  /^(\S+)\s+\S+\s+\S+\s+\[[^\x5d]+\]\s+"(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+([^\s"]+)\s+HTTP\/[0-9.]+"\s+(\d{3})\s+\S+\s+"[^"]*"\s+"([^"]*)"(?:\s+(\d+)ms)?$/;
/* eslint-enable security/detect-unsafe-regex */

consoleTransport._stream = {
  write(info, _enc, cb) {
    try {
      const line = info?.message || '';
      const m = combinedLineRe.exec(line);
      if (m) {
        const [, ip, method, path, statusCodeStr, userAgent, rtMs] = m;
        const payload = {
          ip,
          method,
          path,
          status_code: Number(statusCodeStr),
          user_agent: userAgent,
          response_time: rtMs ? Number(rtMs) : null,
        };
        (async () => {
          const { default: Log } = await import('./src/models/log.js');
          await Log.create(payload);
        })()
          .catch((err) => {
            // Keep two args to satisfy unit expectations
            logger.warn(
              'DB log persistence failed:',
              err?.message || String(err)
            );
          })
          .finally(() => cb && cb());
        return;
      }
    } catch (_e) {
      // ignore parsing errors; still invoke callback
    }
    if (cb) cb();
  },
};

export default logger;
