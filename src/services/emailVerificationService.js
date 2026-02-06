import { UserStatus } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

import emailService from './emailService.js';
import {
  issueCodeForUser,
  verifyCodeForUser,
} from './emailCodeService.js';

function purposeForType(type = 'verify') {
  const normalized = String(type || 'verify').trim().toLowerCase();
  if (normalized === 'sign-type') return 'sign_type';
  if (normalized === 'doc-sign') return 'doc_sign';
  return 'verify';
}

export async function sendCode(user, type = 'verify', context = {}) {
  const purpose = purposeForType(type);
  await issueCodeForUser(user, purpose, async (code) => {
    if (type === 'sign-type') {
      await emailService.sendSignTypeSelectionEmail(user, code);
    } else if (type === 'doc-sign') {
      // Expect context.document with minimal info { id, number, name }
      await emailService.sendDocumentSignCodeEmail(user, context.document, code);
    } else {
      await emailService.sendVerificationEmail(user, code);
    }
  });
}

async function validateCodeOrThrow(user, code, type = 'verify') {
  const purpose = purposeForType(type);
  await verifyCodeForUser(user, code, purpose);
}

export async function verifyCode(
  user,
  code,
  statusAlias = 'ACTIVE',
  type = 'verify'
) {
  await validateCodeOrThrow(user, code, type);
  const status = await UserStatus.findOne({ where: { alias: statusAlias } });
  if (!status) throw new ServiceError('status_not_found', 404);
  await user.update({ email_confirmed: true, status_id: status.id });
}

export async function verifyCodeOnly(user, code, type = 'verify') {
  await validateCodeOrThrow(user, code, type);
}

export default { sendCode, verifyCode, verifyCodeOnly };
