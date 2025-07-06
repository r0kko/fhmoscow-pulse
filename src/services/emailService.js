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
import { renderPasswordResetEmail } from '../templates/passwordResetEmail.js';
import { renderMedicalCertificateAddedEmail } from '../templates/medicalCertificateAddedEmail.js';
import { renderAccountActivatedEmail } from '../templates/accountActivatedEmail.js';
import { renderTrainingRegistrationEmail } from '../templates/trainingRegistrationEmail.js';
import { renderTrainingRegistrationCancelledEmail } from '../templates/trainingRegistrationCancelledEmail.js';
import { renderTrainingRegistrationSelfCancelledEmail } from '../templates/trainingRegistrationSelfCancelledEmail.js';
import { renderTrainingRoleChangedEmail } from '../templates/trainingRoleChangedEmail.js';

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
  const { subject, text, html } = renderPasswordResetEmail(code);
  await sendMail(user.email, subject, text, html);
}

export async function sendMedicalCertificateAddedEmail(user) {
  const { subject, text, html } = renderMedicalCertificateAddedEmail();
  await sendMail(user.email, subject, text, html);
}

export async function sendAccountActivatedEmail(user) {
  const { subject, text, html } = renderAccountActivatedEmail();
  await sendMail(user.email, subject, text, html);
}

export async function sendTrainingRegistrationEmail(user, training, role) {
  const { subject, text, html } = renderTrainingRegistrationEmail(
    training,
    role
  );
  await sendMail(user.email, subject, text, html);
}

export async function sendTrainingRegistrationCancelledEmail(user, training) {
  const { subject, text, html } =
    renderTrainingRegistrationCancelledEmail(training);
  await sendMail(user.email, subject, text, html);
}

export async function sendTrainingRegistrationSelfCancelledEmail(user, training) {
  const { subject, text, html } =
    renderTrainingRegistrationSelfCancelledEmail(training);
  await sendMail(user.email, subject, text, html);
}

export async function sendTrainingRoleChangedEmail(user, training, role) {
  const { subject, text, html } = renderTrainingRoleChangedEmail(
    training,
    role
  );
  await sendMail(user.email, subject, text, html);
}
export default {
  sendMail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendMedicalCertificateAddedEmail,
  sendAccountActivatedEmail,
  sendTrainingRegistrationEmail,
  sendTrainingRegistrationCancelledEmail,
  sendTrainingRegistrationSelfCancelledEmail,
  sendTrainingRoleChangedEmail,
};
