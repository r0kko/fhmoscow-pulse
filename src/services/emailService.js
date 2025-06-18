import nodemailer from 'nodemailer';

import {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
} from '../config/email.js';

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: Number(SMTP_PORT) === 465,
  auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

export async function sendMail(to, subject, text) {
  if (!SMTP_HOST) {
    console.warn('Email not configured');
    return;
  }
  await transporter.sendMail({ from: EMAIL_FROM || SMTP_USER, to, subject, text });
}

export async function sendVerificationEmail(user, code) {
  const text = `Your verification code: ${code}`;
  await sendMail(user.email, 'Email verification', text);
}

export default { sendMail, sendVerificationEmail };
