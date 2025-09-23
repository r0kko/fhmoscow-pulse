import { performance } from 'node:perf_hooks';

import nodemailer from 'nodemailer';

import logger from '../../../logger.js';
import {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
  SMTP_SECURE,
  SMTP_REQUIRE_TLS,
  SMTP_ALLOW_INSECURE_TLS,
  SMTP_TLS_MIN_VERSION,
  SMTP_TLS_REJECT_UNAUTHORIZED,
  SMTP_TLS_SERVERNAME,
  SMTP_TLS_CIPHERS,
  SMTP_LOCAL_ADDRESS,
  SMTP_ADDRESS_FAMILY,
  SMTP_DEBUG,
  SMTP_POOL_ENABLED,
  EMAIL_TRANSPORT_MAX_CONNECTIONS,
  EMAIL_TRANSPORT_MAX_MESSAGES,
  EMAIL_TRANSPORT_CONN_TIMEOUT_MS,
  EMAIL_TRANSPORT_GREETING_TIMEOUT_MS,
  EMAIL_TRANSPORT_SOCKET_TIMEOUT_MS,
  EMAIL_TRANSPORT_VERIFY_ON_BOOT,
} from '../../config/email.js';

export const isEmailConfigured = Boolean(SMTP_HOST);

let transporterPromise = null;
let activeTransporter = null;
let lastTransportOptions = null;

function resolveMailFrom() {
  return EMAIL_FROM || SMTP_USER;
}

function buildTlsOptions() {
  const tls = {
    minVersion: SMTP_TLS_MIN_VERSION,
    rejectUnauthorized: SMTP_TLS_REJECT_UNAUTHORIZED,
  };
  if (SMTP_TLS_SERVERNAME) {
    tls.servername = SMTP_TLS_SERVERNAME;
  }
  if (SMTP_TLS_CIPHERS) {
    tls.ciphers = SMTP_TLS_CIPHERS;
  }
  if (SMTP_ALLOW_INSECURE_TLS) {
    tls.rejectUnauthorized = false;
  }
  return tls;
}

function buildTransportOptions() {
  const options = {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    requireTLS: SMTP_REQUIRE_TLS,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    pool: SMTP_POOL_ENABLED,
    maxConnections: EMAIL_TRANSPORT_MAX_CONNECTIONS,
    maxMessages: EMAIL_TRANSPORT_MAX_MESSAGES,
    connectionTimeout: EMAIL_TRANSPORT_CONN_TIMEOUT_MS,
    greetingTimeout: EMAIL_TRANSPORT_GREETING_TIMEOUT_MS,
    socketTimeout: EMAIL_TRANSPORT_SOCKET_TIMEOUT_MS,
    tls: buildTlsOptions(),
  };
  if (SMTP_LOCAL_ADDRESS) {
    options.localAddress = SMTP_LOCAL_ADDRESS;
  }
  if (
    typeof SMTP_ADDRESS_FAMILY === 'number' &&
    !Number.isNaN(SMTP_ADDRESS_FAMILY)
  ) {
    options.family = SMTP_ADDRESS_FAMILY;
  }
  if (SMTP_DEBUG) {
    options.logger = true;
    options.debug = true;
  }
  return options;
}

function summarizeTransportOptions(options = {}) {
  const { tls = {} } = options;
  return {
    host: options.host,
    port: options.port,
    secure: options.secure,
    requireTLS: options.requireTLS,
    pool: options.pool,
    maxConnections: options.maxConnections,
    maxMessages: options.maxMessages,
    connectionTimeout: options.connectionTimeout,
    greetingTimeout: options.greetingTimeout,
    socketTimeout: options.socketTimeout,
    localAddress: options.localAddress,
    family: options.family,
    tls: {
      servername: tls.servername,
      minVersion: tls.minVersion,
      rejectUnauthorized: tls.rejectUnauthorized,
      ciphers: tls.ciphers,
    },
  };
}

async function initializeTransporter() {
  const options = buildTransportOptions();
  lastTransportOptions = options;
  if (SMTP_ALLOW_INSECURE_TLS) {
    logger.warn('SMTP transport configured with relaxed TLS requirements', {
      host: options.host,
      port: options.port,
    });
  }
  logger.debug(
    'Initializing SMTP transport',
    summarizeTransportOptions(options)
  );
  const transporter = nodemailer.createTransport(options);
  if (EMAIL_TRANSPORT_VERIFY_ON_BOOT) {
    try {
      await transporter.verify();
      logger.info(
        'SMTP transport verified',
        summarizeTransportOptions(options)
      );
    } catch (verifyError) {
      logger.error('SMTP transport verification failed', {
        ...summarizeTransportOptions(options),
        error: verifyError?.message || String(verifyError),
        code: verifyError?.code,
        command: verifyError?.command,
      });
      try {
        transporter.close?.();
      } catch (_closeErr) {
        /* ignore */
      }
      throw verifyError;
    }
  }
  activeTransporter = transporter;
  return transporter;
}

async function getTransporter() {
  if (!isEmailConfigured) {
    throw new Error('SMTP transport is not configured');
  }
  if (!transporterPromise) {
    transporterPromise = initializeTransporter().catch((err) => {
      activeTransporter = null;
      lastTransportOptions = null;
      transporterPromise = null;
      throw err;
    });
  }
  return transporterPromise;
}

function appendFooters(text = '', html = '') {
  return { finalText: text, finalHtml: html };
}

async function recordDeliveryMetrics(status, purpose, latencyMs) {
  try {
    const metrics = await import('../../config/metrics.js');
    metrics.incEmailSent?.(status, purpose);
    metrics.observeEmailDelivery?.(status, purpose, latencyMs / 1000);
  } catch (_err) {
    /* ignore metrics errors */
  }
}

const RESET_ERROR_CODES = new Set([
  'ECONNECTION',
  'ECONNRESET',
  'ETIMEDOUT',
  'ESOCKET',
  'ETLS',
]);

function isHandshakeError(error) {
  if (!error) return false;
  const root = error.cause || error;
  const message = String(root?.message || '').toLowerCase();
  if (!message && !root?.code) return false;
  if (RESET_ERROR_CODES.has(root?.code)) return true;
  if (
    typeof root?.command === 'string' &&
    root.command.toUpperCase() === 'CONN'
  ) {
    return true;
  }
  return (
    message.includes('tls') ||
    message.includes('secure tls connection') ||
    message.includes('handshake')
  );
}

function shouldResetTransport(error) {
  if (!error) return false;
  const root = error.cause || error;
  if (RESET_ERROR_CODES.has(root?.code)) return true;
  if (
    typeof root?.command === 'string' &&
    root.command.toUpperCase() === 'CONN'
  ) {
    return true;
  }
  const message = String(root?.message || '').toLowerCase();
  return message.includes('disconnected before secure tls connection');
}

function resetTransport(transporter) {
  if (transporter) {
    try {
      transporter.close?.();
    } catch (closeErr) {
      logger.debug('SMTP transport close failed', {
        error: closeErr?.message || String(closeErr),
      });
    }
  }
  activeTransporter = null;
  transporterPromise = null;
  lastTransportOptions = null;
}

export async function deliverEmail(message) {
  if (!isEmailConfigured) {
    throw new Error('SMTP transport is not configured');
  }
  const {
    to,
    subject,
    text,
    html,
    purpose = 'generic',
    headers,
    cc,
    bcc,
    id,
  } = message;
  if (!to) {
    throw new Error('Recipient address is required');
  }

  const { finalText, finalHtml } = appendFooters(text, html);
  const mail = {
    from: resolveMailFrom(),
    to,
    subject,
    text: finalText,
    html: finalHtml,
    headers: {
      'X-Email-Purpose': purpose,
      ...(id ? { 'X-Email-Job-Id': id } : {}),
      ...headers,
    },
    cc,
    bcc,
  };

  const started = performance.now();
  let transport;
  try {
    transport = await getTransporter();
    const info = await transport.sendMail(mail);
    const latencyMs = Math.round(performance.now() - started);
    await recordDeliveryMetrics('ok', purpose, latencyMs);
    logger.info('Email delivered', {
      to,
      purpose,
      jobId: id,
      messageId: info?.messageId,
      latency_ms: latencyMs,
    });
    return info;
  } catch (err) {
    const latencyMs = Math.round(performance.now() - started);
    await recordDeliveryMetrics('error', purpose, latencyMs);
    const rootError = err?.cause || err;
    const transportMeta = summarizeTransportOptions(
      lastTransportOptions || transport?.options
    );
    logger.error('Email delivery failed', {
      to,
      purpose,
      jobId: id,
      error: rootError?.message || String(rootError),
      code: rootError?.code,
      command: rootError?.command,
      response: rootError?.response,
      responseCode: rootError?.responseCode,
      latency_ms: latencyMs,
      transport: transportMeta,
    });
    if (shouldResetTransport(rootError)) {
      resetTransport(transport);
    }
    const error = new Error('Email delivery failed');
    const handshakeFailure = isHandshakeError(rootError);
    if (handshakeFailure) {
      error.hint =
        'SMTP TLS handshake failed. Ensure the server supports TLSv1.2 or adjust SMTP_TLS_MIN_VERSION / SMTP_ALLOW_INSECURE_TLS.';
    }
    error.cause = err;
    error.details = {
      to,
      purpose,
      jobId: id,
      reason: handshakeFailure ? 'tls_handshake_failed' : 'smtp_error',
    };
    throw error;
  }
}

export function resetTransportForTests() {
  resetTransport(activeTransporter);
}
