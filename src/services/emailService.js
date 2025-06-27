import nodemailer from 'nodemailer';

import logger from '../../logger.js';
import {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
} from '../config/email.js';
import { renderVerificationEmail } from '../templates/verificationEmail.js';

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: Number(SMTP_PORT) === 465,
  auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

export async function sendMail(to, subject, text, html) {
  if (!SMTP_HOST) {
    logger.warn('Email not configured');
    return;
  }
  await transporter.sendMail({
    from: EMAIL_FROM || SMTP_USER,
    to,
    subject,
    text,
    html,
  });
  logger.info('Email sent to %s', to);
}

export async function sendVerificationEmail(user, code) {
  const { subject, text, html } = renderVerificationEmail(code);
  await sendMail(user.email, subject, text, html);
}

export async function sendPasswordResetEmail(user, code) {
  const text = `Your password reset code: ${code}`;
  await sendMail(user.email, 'Password reset', text);
}

export default { sendMail, sendVerificationEmail, sendPasswordResetEmail };
