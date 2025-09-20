import { performance } from 'node:perf_hooks';

import nodemailer from 'nodemailer';

import logger from '../../../logger.js';
import {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
} from '../../config/email.js';

export const isEmailConfigured = Boolean(SMTP_HOST);

let transporterPromise = null;

function resolveMailFrom() {
  return EMAIL_FROM || SMTP_USER;
}

async function getTransporter() {
  if (!isEmailConfigured) {
    throw new Error('SMTP transport is not configured');
  }
  if (!transporterPromise) {
    const maxConnections = Number(
      process.env.EMAIL_TRANSPORT_MAX_CONNECTIONS || 3
    );
    const maxMessages = Number(process.env.EMAIL_TRANSPORT_MAX_MESSAGES || 100);
    const connectionTimeout = Number(
      process.env.EMAIL_TRANSPORT_CONN_TIMEOUT_MS || 10_000
    );
    const greetingTimeout = Number(
      process.env.EMAIL_TRANSPORT_GREETING_TIMEOUT_MS || 8_000
    );
    const socketTimeout = Number(
      process.env.EMAIL_TRANSPORT_SOCKET_TIMEOUT_MS || 15_000
    );
    const secure = Number(SMTP_PORT) === 465;
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure,
        requireTLS: !secure,
        auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
        pool: true,
        maxConnections,
        maxMessages,
        connectionTimeout,
        greetingTimeout,
        socketTimeout,
        tls: {
          servername: SMTP_HOST,
          minVersion: 'TLSv1.2',
          rejectUnauthorized: process.env.NODE_ENV !== 'development',
        },
      })
    );
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
  try {
    const transport = await getTransporter();
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
    logger.error('Email delivery failed', {
      to,
      purpose,
      jobId: id,
      error: err?.message || String(err),
      latency_ms: latencyMs,
    });
    const error = new Error('Email delivery failed');
    error.cause = err;
    error.details = { to, purpose, jobId: id };
    throw error;
  }
}

export function resetTransportForTests() {
  transporterPromise = null;
}
