import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';

import { EmailCode, UserStatus } from '../models/index.js';

import emailService from './emailService.js';

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendCode(user) {
  const code = generateCode();
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  await EmailCode.destroy({ where: { user_id: user.id } });
  await EmailCode.create({
    id: uuidv4(),
    user_id: user.id,
    code,
    expires_at: expires,
  });
  await emailService.sendVerificationEmail(user, code);
}

export async function verifyCode(user, code) {
  const rec = await EmailCode.findOne({
    where: {
      user_id: user.id,
      code,
      expires_at: { [Op.gt]: new Date() },
    },
  });
  if (!rec) throw new Error('invalid_code');
  const active = await UserStatus.findOne({ where: { alias: 'ACTIVE' } });
  await Promise.all([
    user.update({ email_confirmed: true, status_id: active.id }),
    EmailCode.destroy({ where: { user_id: user.id } }),
  ]);
}

export default { sendCode, verifyCode };
