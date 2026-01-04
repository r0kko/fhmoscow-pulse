import { createLogger, format, transports } from 'winston';
import { context, trace } from '@opentelemetry/api';

const { combine, timestamp, printf, errors, colorize, json, splat } = format;

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';
const isTest = env === 'test';
const logLevel = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');
const isSilent = process.env.LOG_SILENT === 'true' || isTest;

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

const consoleTransport = new transports.Console({ silent: isSilent });

const logger = createLogger({
  level: logLevel,
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

export default logger;
