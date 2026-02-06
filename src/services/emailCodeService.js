import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

import { EmailCode } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';
import {
  EMAIL_CODE_COOLDOWN_MS,
  EMAIL_CODE_MAX_ATTEMPTS,
  EMAIL_CODE_TTL_MS,
  generateSixDigitCode,
  hashEmailCode,
  normalizeEmailCodeInput,
  normalizeEmailCodePurpose,
  verifyEmailCodeHash,
} from '../utils/emailCode.js';

function retryAfterSeconds(lockUntil) {
  const ms = Number(new Date(lockUntil).getTime()) - Date.now();
  return ms > 0 ? Math.ceil(ms / 1000) : 0;
}

function buildTooManyAttempts(lockUntil) {
  const err = new ServiceError('too_many_attempts', 429);
  const retryAfter = retryAfterSeconds(lockUntil);
  if (retryAfter > 0) err.retryAfter = retryAfter;
  return err;
}

async function ensureNoActiveCooldown(userId, purpose, now = new Date()) {
  const record = await EmailCode.findOne({
    where: {
      user_id: userId,
      purpose,
      locked_until: { [Op.gt]: now },
    },
    order: [['locked_until', 'DESC']],
  });
  if (record?.locked_until) {
    throw buildTooManyAttempts(record.locked_until);
  }
}

export async function issueCodeForUser(
  user,
  rawPurpose,
  deliver,
  { ttlMs = EMAIL_CODE_TTL_MS } = {}
) {
  const purpose = normalizeEmailCodePurpose(rawPurpose);
  const now = new Date();
  await ensureNoActiveCooldown(user.id, purpose, now);

  await EmailCode.destroy({ where: { user_id: user.id, purpose } });

  const id = uuidv4();
  const code = generateSixDigitCode();
  const expiresAt = new Date(now.getTime() + Math.max(60_000, Number(ttlMs)));
  const codeHash = hashEmailCode({
    code,
    recordId: id,
    userId: user.id,
    purpose,
  });
  await EmailCode.create({
    id,
    user_id: user.id,
    purpose,
    code_hash: codeHash,
    attempt_count: 0,
    locked_until: null,
    consumed_at: null,
    expires_at: expiresAt,
    code: null,
  });

  try {
    await deliver(code);
  } catch (err) {
    await EmailCode.destroy({ where: { id } });
    throw new ServiceError('email_send_failed', 500, err?.message || String(err));
  }

  return { code, expiresAt };
}

function matchesCode(record, rawCode, purpose, userId) {
  const normalized = normalizeEmailCodeInput(rawCode);
  if (!/^\d{6}$/.test(normalized)) return false;
  if (record?.code_hash) {
    return verifyEmailCodeHash(record.code_hash, {
      code: normalized,
      recordId: record.id,
      userId,
      purpose,
    });
  }
  // Temporary fallback for pre-migration rows.
  return normalized === String(record?.code || '');
}

export async function verifyCodeForUser(
  user,
  rawCode,
  rawPurpose,
  {
    maxAttempts = EMAIL_CODE_MAX_ATTEMPTS,
    cooldownMs = EMAIL_CODE_COOLDOWN_MS,
  } = {}
) {
  const purpose = normalizeEmailCodePurpose(rawPurpose);
  const now = new Date();
  const record = await EmailCode.findOne({
    where: {
      user_id: user.id,
      purpose,
      consumed_at: null,
      expires_at: { [Op.gt]: now },
    },
    order: [['created_at', 'DESC']],
  });

  if (!record) {
    throw new ServiceError('invalid_code', 400);
  }
  if (record.locked_until && new Date(record.locked_until) > now) {
    throw buildTooManyAttempts(record.locked_until);
  }

  if (!matchesCode(record, rawCode, purpose, user.id)) {
    const nextAttempts = Number(record.attempt_count || 0) + 1;
    if (nextAttempts >= Math.max(1, Number(maxAttempts || EMAIL_CODE_MAX_ATTEMPTS))) {
      const lockUntil = new Date(now.getTime() + Math.max(60_000, Number(cooldownMs)));
      await record.update({
        attempt_count: nextAttempts,
        consumed_at: now,
        locked_until: lockUntil,
      });
      throw buildTooManyAttempts(lockUntil);
    }
    await record.update({ attempt_count: nextAttempts });
    throw new ServiceError('invalid_code', 400);
  }

  await record.update({ consumed_at: now, locked_until: null });
  await EmailCode.destroy({
    where: {
      user_id: user.id,
      purpose,
      id: { [Op.ne]: record.id },
    },
  });
  return record;
}

export default { issueCodeForUser, verifyCodeForUser };
