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

export async function sendCode(user, type = 'verify') {
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
  } else {
    await emailService.sendVerificationEmail(user, code);
  }
}

export async function verifyCode(user, code, statusAlias = 'ACTIVE') {
  const rec = await EmailCode.findOne({
    where: {
      user_id: user.id,
      code,
      expires_at: { [Op.gt]: new Date() },
    },
  });
  if (!rec) {
    const count = attempts.markFailed(user.id);
    if (count >= 5) {
      throw new ServiceError('too_many_attempts');
    }
    throw new ServiceError('invalid_code');
  }
  attempts.clear(user.id);
  const status = await UserStatus.findOne({ where: { alias: statusAlias } });
  if (!status) throw new ServiceError('status_not_found', 404);
  await Promise.all([
    user.update({ email_confirmed: true, status_id: status.id }),
    EmailCode.destroy({ where: { user_id: user.id } }),
  ]);
}

export default { sendCode, verifyCode };
