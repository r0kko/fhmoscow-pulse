import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import './env.js';

const DEFAULT_SEAL_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../assets/fhm-protocol-seal.jpg'
);

function normalizeBaseUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(/\/+$/, '');
}

function normalizeInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function normalizeFloat(value, fallback) {
  const parsed = Number.parseFloat(String(value || ''));
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function resolveSealPath() {
  const fromEnv = String(process.env.MATCH_PROTOCOL_SEAL_PATH || '').trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_SEAL_PATH;
}

export const MATCH_PROTOCOL_RENDER_VERSION = 20;

export const MATCH_PROTOCOL_CONFIG = {
  apiBase: normalizeBaseUrl(process.env.MATCH_PROTOCOL_API_BASE),
  apiKey: String(process.env.MATCH_PROTOCOL_API_KEY || '').trim(),
  timeoutMs: Math.max(
    1000,
    normalizeInt(process.env.MATCH_PROTOCOL_TIMEOUT_MS, 30000)
  ),
  cacheTtlSeconds: Math.max(
    0,
    normalizeInt(process.env.MATCH_PROTOCOL_CACHE_TTL_SECONDS, 300)
  ),
  sealPath: resolveSealPath(),
  sealWhiteThreshold: Math.min(
    255,
    Math.max(
      180,
      normalizeInt(process.env.MATCH_PROTOCOL_SEAL_WHITE_THRESHOLD, 245)
    )
  ),
  sealOpacity: Math.min(
    1,
    Math.max(
      0.05,
      normalizeFloat(process.env.MATCH_PROTOCOL_SEAL_OPACITY, 0.92)
    )
  ),
  sealScaleRatio: Math.min(
    0.6,
    Math.max(
      0.05,
      normalizeFloat(process.env.MATCH_PROTOCOL_SEAL_SCALE_RATIO, 0.24)
    )
  ),
  sealCenterXRatio: Math.min(
    0.98,
    Math.max(
      0.5,
      normalizeFloat(process.env.MATCH_PROTOCOL_SEAL_CENTER_X_RATIO, 0.885)
    )
  ),
  sealCenterYRatio: Math.min(
    0.5,
    Math.max(
      0.02,
      normalizeFloat(process.env.MATCH_PROTOCOL_SEAL_CENTER_Y_RATIO, 0.17)
    )
  ),
  sealOffsetXPx: normalizeInt(process.env.MATCH_PROTOCOL_SEAL_OFFSET_X_PX, 15),
  sealOffsetYPx: normalizeInt(process.env.MATCH_PROTOCOL_SEAL_OFFSET_Y_PX, -15),
  signatureBottomOffset: Math.max(
    8,
    normalizeInt(process.env.MATCH_PROTOCOL_SIGNATURE_BOTTOM_OFFSET, 18)
  ),
  signatureRightOffset: Math.max(
    8,
    normalizeInt(process.env.MATCH_PROTOCOL_SIGNATURE_RIGHT_OFFSET, 18)
  ),
};

export function hasMatchProtocolSeal() {
  try {
    fs.accessSync(MATCH_PROTOCOL_CONFIG.sealPath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function isMatchProtocolConfigured() {
  return Boolean(
    MATCH_PROTOCOL_CONFIG.apiBase &&
    MATCH_PROTOCOL_CONFIG.apiKey &&
    hasMatchProtocolSeal()
  );
}

export default {
  MATCH_PROTOCOL_CONFIG,
  MATCH_PROTOCOL_RENDER_VERSION,
  isMatchProtocolConfigured,
  hasMatchProtocolSeal,
};
