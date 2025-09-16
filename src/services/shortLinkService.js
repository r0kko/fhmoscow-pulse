import crypto from 'crypto';
import '../config/env.js';

import ShortLink from '../models/shortLink.js';
import logger from '../../logger.js';
import { buildVerifyToken } from '../utils/verifyDocHmac.js';

const memoryStore = new Map();

function secureCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function base62(n) {
  const alphabet =
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let x = BigInt('0x' + n.toString('hex'));
  const base = BigInt(62);
  let out = '';
  while (x > 0n) {
    const r = x % base;
    out = alphabet[Number(r)] + out;
    x = x / base;
  }
  return out || '0';
}

function randomCode(len) {
  // ~62^10 ≈ 8.4e17 — 10 chars are plenty even for very high volumes
  const bytes = crypto.randomBytes(Math.ceil((len * Math.log2(62)) / 8));
  const b62 = base62(bytes);
  return b62.slice(0, len);
}

function ttlDate(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function getOrCreateForToken(token) {
  const ttlDays = Number(process.env.SHORTLINK_TTL_DAYS || 365);
  const length = Math.max(
    6,
    Math.min(24, Number(process.env.SHORTLINK_CODE_LENGTH || 10))
  );
  const backend = (process.env.SHORTLINK_BACKEND || 'db').toLowerCase();

  if (backend === 'memory') {
    // prune expired
    const now = Date.now();
    for (const [code, rec] of memoryStore) {
      if (rec.expiresAt <= now) memoryStore.delete(code);
    }
    for (const [code, rec] of memoryStore) {
      if (secureCompare(rec.token, token)) {
        return code;
      }
    }
    let code;
    do {
      code = randomCode(length);
    } while (memoryStore.has(code));
    memoryStore.set(code, {
      token,
      expiresAt: ttlDate(ttlDays).getTime(),
      hits: 0,
    });
    return code;
  }

  // DB backend
  try {
    const existing = await ShortLink.findOne({ where: { token } });
    if (existing && existing.expires_at > new Date()) {
      return existing.code;
    }
  } catch (e) {
    if (/relation\s+"short_links"\s+does not exist/i.test(String(e?.message))) {
      logger.warn('ShortLink table missing; falling back to memory backend');
      process.env.SHORTLINK_BACKEND = 'memory';
      return getOrCreateForToken(token);
    }
    throw e;
  }
  // Generate unique code with a few attempts
  for (let i = 0; i < 5; i += 1) {
    const code = randomCode(length);
    try {
      await ShortLink.create({
        code,
        token,
        expires_at: ttlDate(ttlDays),
        hits: 0,
      });
      return code;
    } catch (e) {
      if (/duplicate|unique/i.test(String(e?.message))) continue;
      throw e;
    }
  }
  // If reattempts failed, reuse an expired record by updating it
  const expired = await ShortLink.findOne({
    where: { expires_at: { [ShortLink.sequelize.Op.lt]: new Date() } },
  });
  if (expired) {
    expired.token = token;
    expired.expires_at = ttlDate(ttlDays);
    expired.hits = 0;
    await expired.save();
    return expired.code;
  }
  // Last resort: memory store
  logger.warn('ShortLink DB exhausted; using memory fallback');
  process.env.SHORTLINK_BACKEND = 'memory';
  return getOrCreateForToken(token);
}

export async function resolveCode(code) {
  const backend = (process.env.SHORTLINK_BACKEND || 'db').toLowerCase();
  if (backend === 'memory') {
    const rec = memoryStore.get(code);
    if (!rec) return null;
    if (rec.expiresAt <= Date.now()) {
      memoryStore.delete(code);
      return null;
    }
    rec.hits += 1;
    return rec.token;
  }
  try {
    const row = await ShortLink.findByPk(code);
    if (!row) return null;
    if (row.expires_at <= new Date()) return null;
    row.hits += 1;
    await row.save();
    return row.token;
  } catch (e) {
    if (/relation\s+"short_links"\s+does not exist/i.test(String(e?.message))) {
      logger.warn('ShortLink table missing; falling back to memory backend');
      process.env.SHORTLINK_BACKEND = 'memory';
      return resolveCode(code);
    }
    throw e;
  }
}

export async function buildShortVerifyUrl({ d, s, u }) {
  const token = buildVerifyToken({ d, s, u });
  const enabled =
    String(process.env.SHORTLINK_ENABLED || 'false').toLowerCase() === 'true';
  if (!enabled) throw new Error('shortlink_disabled');
  const code = await getOrCreateForToken(token);
  const base = (process.env.BASE_URL || '').replace(/\/+$/, '');
  const prefix = (process.env.SHORTLINK_PUBLIC_PREFIX || '/api/v').replace(
    /^\/*/,
    '/'
  );
  return `${base}${prefix}/${code}`;
}

export default { getOrCreateForToken, resolveCode, buildShortVerifyUrl };
