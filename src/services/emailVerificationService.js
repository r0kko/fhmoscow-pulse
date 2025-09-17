import crypto from 'crypto';

import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';

import { EmailCode, UserStatus } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

import emailService from './emailService.js';
import * as attempts from './emailCodeAttempts.js';

function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

async function validateCodeOrThrow(user, code) {
  const rec = await EmailCode.findOne({
    where: {
      user_id: user.id,
      code,
      expires_at: { [Op.gt]: new Date() },
    },
  });
  if (rec) {
    attempts.clear(user.id);
    return;
  }
  const count = attempts.markFailed(user.id);
  if (count >= 5) {
    throw new ServiceError('too_many_attempts');
  }
  throw new ServiceError('invalid_code');
}

export async function sendCode(user, type = 'verify', context = {}) {
  const code = generateCode();
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  await EmailCode.destroy({ where: { user_id: user.id } });
  await EmailCode.create({
    id: uuidv4(),
    user_id: user.id,
    code,
    expires_at: expires,
  });
  attempts.clear(user.id);
  if (type === 'sign-type') {
    await emailService.sendSignTypeSelectionEmail(user, code);
  } else if (type === 'doc-sign') {
    // Expect context.document with minimal info { id, number, name }
    await emailService.sendDocumentSignCodeEmail(user, context.document, code);
  } else {
    await emailService.sendVerificationEmail(user, code);
  }
}

export async function verifyCode(user, code, statusAlias = 'ACTIVE') {
  await validateCodeOrThrow(user, code);
  const status = await UserStatus.findOne({ where: { alias: statusAlias } });
  if (!status) throw new ServiceError('status_not_found', 404);
  await Promise.all([
    user.update({ email_confirmed: true, status_id: status.id }),
    EmailCode.destroy({ where: { user_id: user.id } }),
  ]);
}

export async function verifyCodeOnly(user, code) {
  await validateCodeOrThrow(user, code);
  await EmailCode.destroy({ where: { user_id: user.id } });
}

export default { sendCode, verifyCode, verifyCodeOnly };
