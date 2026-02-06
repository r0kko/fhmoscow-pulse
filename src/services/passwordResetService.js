import emailService from './emailService.js';
import { issueCodeForUser, verifyCodeForUser } from './emailCodeService.js';

const PURPOSE = 'password_reset';

export async function sendCode(user) {
  await issueCodeForUser(user, PURPOSE, async (code) => {
    await emailService.sendPasswordResetEmail(user, code);
  });
}

export async function verifyCode(user, code) {
  await verifyCodeForUser(user, code, PURPOSE);
}

export default { sendCode, verifyCode };
