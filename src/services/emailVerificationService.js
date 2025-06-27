import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';

import { EmailCode, UserStatus } from '../models/index.js';

import emailService from './emailService.js';
import * as attempts from './emailCodeAttempts.js';

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendCode(user) {
  const code = generateCode();
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  await EmailCode.destroy({ where: { user_id: user.id } });
  const hash = await bcrypt.hash(code, 10);
  await EmailCode.create({
    id: uuidv4(),
    user_id: user.id,
    code: hash,
    expires_at: expires,
  });
  attempts.clear(user.id);
  await emailService.sendVerificationEmail(user, code);
}

export async function verifyCode(user, code, statusAlias = 'ACTIVE') {
  const rec = await EmailCode.findOne({
    where: {
      user_id: user.id,
      expires_at: { [Op.gt]: new Date() },
    },
  });
  if (!rec) throw new Error('invalid_code');
  const ok = await bcrypt.compare(code, rec.code);
  if (!ok) {
    const count = attempts.markFailed(user.id);
    if (count >= 5) {
      throw new Error('too_many_attempts');
    }
    throw new Error('invalid_code');
  }
  attempts.clear(user.id);
  const status = await UserStatus.findOne({ where: { alias: statusAlias } });
  if (!status) throw new Error('status_not_found');
  await Promise.all([
    user.update({ email_confirmed: true, status_id: status.id }),
    EmailCode.destroy({ where: { user_id: user.id } }),
  ]);
}

export default { sendCode, verifyCode };
