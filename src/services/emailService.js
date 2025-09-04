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
import { renderUserCreatedByAdminEmail } from '../templates/userCreatedByAdminEmail.js';
import { renderMedicalCertificateAddedEmail } from '../templates/medicalCertificateAddedEmail.js';
import { renderAccountActivatedEmail } from '../templates/accountActivatedEmail.js';
import { renderTrainingRegistrationEmail } from '../templates/trainingRegistrationEmail.js';
import { renderTrainingRegistrationCancelledEmail } from '../templates/trainingRegistrationCancelledEmail.js';
import { renderTrainingRegistrationSelfCancelledEmail } from '../templates/trainingRegistrationSelfCancelledEmail.js';
import { renderTrainingRoleChangedEmail } from '../templates/trainingRoleChangedEmail.js';
import { renderTrainingInvitationEmail } from '../templates/trainingInvitationEmail.js';
import { renderMedicalExamRegistrationCreatedEmail } from '../templates/medicalExamRegistrationCreatedEmail.js';
import { renderMedicalExamRegistrationApprovedEmail } from '../templates/medicalExamRegistrationApprovedEmail.js';
import { renderMedicalExamRegistrationCancelledEmail } from '../templates/medicalExamRegistrationCancelledEmail.js';
import { renderMedicalExamRegistrationSelfCancelledEmail } from '../templates/medicalExamRegistrationSelfCancelledEmail.js';
import { renderMedicalExamRegistrationCompletedEmail } from '../templates/medicalExamRegistrationCompletedEmail.js';
import { renderTicketCreatedEmail } from '../templates/ticketCreatedEmail.js';
import { renderTicketStatusChangedEmail } from '../templates/ticketStatusChangedEmail.js';
import { renderNormativeResultAddedEmail } from '../templates/normativeResultAddedEmail.js';
import { renderNormativeResultUpdatedEmail } from '../templates/normativeResultUpdatedEmail.js';
import { renderNormativeResultRemovedEmail } from '../templates/normativeResultRemovedEmail.js';
import { renderSignTypeSelectionEmail } from '../templates/signTypeSelectionEmail.js';
import { renderDocumentAwaitingSignatureEmail } from '../templates/documentAwaitingSignatureEmail.js';
import { renderDocumentCreatedEmail } from '../templates/documentCreatedEmail.js';
import { renderDocumentSignedEmail } from '../templates/documentSignedEmail.js';
import { renderDocumentRejectedEmail } from '../templates/documentRejectedEmail.js';
import { renderMatchAgreementProposedEmail } from '../templates/matchAgreementProposedEmail.js';
import { renderMatchAgreementCounterProposedEmail } from '../templates/matchAgreementCounterProposedEmail.js';
import { renderMatchAgreementApprovedEmail } from '../templates/matchAgreementApprovedEmail.js';
import { renderMatchAgreementDeclinedEmail } from '../templates/matchAgreementDeclinedEmail.js';
import { renderMatchAgreementWithdrawnEmail } from '../templates/matchAgreementWithdrawnEmail.js';
import { renderMatchAgreementReminderEmail } from '../templates/matchAgreementReminderEmail.js';
import { renderMatchAgreementDailyDigestEmail } from '../templates/matchAgreementDailyDigestEmail.js';

export const isEmailConfigured = Boolean(SMTP_HOST);

const transporter = isEmailConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    })
  : null;

export async function sendMail(to, subject, text, html, purpose = 'generic') {
  if (!isEmailConfigured) {
    logger.warn('Email not configured');
    return false;
  }
  const footerText =
    '\n\nС уважением,\nкоманда АСОУ ПД Пульс.\nЕсли вы считаете это ошибкой, обратитесь к сотруднику отдела организации судейства.';
  const footerHtml =
    '\n      <br/>\n      <p style="font-size:16px;margin:0 0 16px;">С уважением,<br/>команда АСОУ ПД Пульс</p>\n      <p style="font-size:12px;color:#777;margin:0;">Если вы считаете это ошибкой, обратитесь к сотруднику отдела организации судейства.</p>';
  const finalText = `${text}${footerText}`;
  const finalHtml = /<\/div>\s*$/.test(html)
    ? html.replace(/<\/div>\s*$/, `${footerHtml}</div>`)
    : `${html}${footerHtml}`;
  try {
    await transporter.sendMail({
      from: EMAIL_FROM || SMTP_USER,
      to,
      subject,
      text: finalText,
      html: finalHtml,
    });
    logger.info('Email sent to %s', to);
    try {
      (await import('../config/metrics.js')).incEmailSent?.('ok', purpose);
    } catch (_e) {
      /* noop */
    }
    return true;
  } catch (err) {
    logger.error('Failed to send email to %s: %s', to, err.message);
    try {
      (await import('../config/metrics.js')).incEmailSent?.('error', purpose);
    } catch (_e) {
      /* noop */
    }
    return false;
  }
}

export async function sendVerificationEmail(user, code) {
  const { subject, text, html } = renderVerificationEmail(code);
  await sendMail(user.email, subject, text, html, 'verification');
}

export async function sendSignTypeSelectionEmail(user, code) {
  const { subject, text, html } = renderSignTypeSelectionEmail(code);
  await sendMail(user.email, subject, text, html, 'sign_type');
}

export async function sendPasswordResetEmail(user, code) {
  const { subject, text, html } = renderPasswordResetEmail(code);
  await sendMail(user.email, subject, text, html, 'password_reset');
}

export async function sendUserCreatedByAdminEmail(user, tempPassword) {
  const { subject, text, html } = renderUserCreatedByAdminEmail(
    user,
    tempPassword
  );
  await sendMail(user.email, subject, text, html, 'user_created');
}

export async function sendMedicalCertificateAddedEmail(user) {
  const { subject, text, html } = renderMedicalCertificateAddedEmail();
  await sendMail(user.email, subject, text, html, 'medical_certificate_added');
}

export async function sendAccountActivatedEmail(user) {
  const { subject, text, html } = renderAccountActivatedEmail();
  await sendMail(user.email, subject, text, html, 'account_activated');
}

export async function sendTrainingRegistrationEmail(
  user,
  training,
  role,
  byAdmin = false
) {
  const { subject, text, html } = renderTrainingRegistrationEmail(
    training,
    role,
    byAdmin
  );
  await sendMail(user.email, subject, text, html, 'training_registration');
}

export async function sendTrainingRegistrationCancelledEmail(user, training) {
  const { subject, text, html } =
    renderTrainingRegistrationCancelledEmail(training);
  await sendMail(
    user.email,
    subject,
    text,
    html,
    'training_registration_cancelled'
  );
}

export async function sendTrainingRegistrationSelfCancelledEmail(
  user,
  training
) {
  const { subject, text, html } =
    renderTrainingRegistrationSelfCancelledEmail(training);
  await sendMail(
    user.email,
    subject,
    text,
    html,
    'training_registration_self_cancelled'
  );
}

export async function sendTrainingRoleChangedEmail(
  user,
  training,
  role,
  byAdmin = true
) {
  const { subject, text, html } = renderTrainingRoleChangedEmail(
    training,
    role,
    byAdmin
  );
  await sendMail(user.email, subject, text, html, 'training_role_changed');
}

export async function sendTrainingInvitationEmail(user, training) {
  const { subject, text, html } = renderTrainingInvitationEmail(training);
  await sendMail(user.email, subject, text, html, 'training_invitation');
}

export async function sendMedicalExamRegistrationCreatedEmail(
  user,
  exam,
  byAdmin = false
) {
  const { subject, text, html } = renderMedicalExamRegistrationCreatedEmail(
    exam,
    byAdmin
  );
  await sendMail(user.email, subject, text, html, 'exam_created');
}

export async function sendMedicalExamRegistrationApprovedEmail(user, exam) {
  const { subject, text, html } =
    renderMedicalExamRegistrationApprovedEmail(exam);
  await sendMail(user.email, subject, text, html, 'exam_approved');
}

export async function sendMedicalExamRegistrationCancelledEmail(user, exam) {
  const { subject, text, html } =
    renderMedicalExamRegistrationCancelledEmail(exam);
  await sendMail(user.email, subject, text, html, 'exam_cancelled');
}

export async function sendMedicalExamRegistrationSelfCancelledEmail(
  user,
  exam
) {
  const { subject, text, html } =
    renderMedicalExamRegistrationSelfCancelledEmail(exam);
  await sendMail(user.email, subject, text, html, 'exam_self_cancelled');
}

export async function sendMedicalExamRegistrationCompletedEmail(user, exam) {
  const { subject, text, html } =
    renderMedicalExamRegistrationCompletedEmail(exam);
  await sendMail(user.email, subject, text, html, 'exam_completed');
}

export async function sendTicketCreatedEmail(user, ticket) {
  const { subject, text, html } = renderTicketCreatedEmail(ticket);
  await sendMail(user.email, subject, text, html, 'ticket_created');
}

export async function sendTicketStatusChangedEmail(user, ticket) {
  const { subject, text, html } = renderTicketStatusChangedEmail(ticket);
  await sendMail(user.email, subject, text, html, 'ticket_status_changed');
}

export async function sendNormativeResultAddedEmail(user, result) {
  const { subject, text, html } = renderNormativeResultAddedEmail(result);
  await sendMail(user.email, subject, text, html, 'normative_added');
}

export async function sendNormativeResultUpdatedEmail(user, result) {
  const { subject, text, html } = renderNormativeResultUpdatedEmail(result);
  await sendMail(user.email, subject, text, html, 'normative_updated');
}

export async function sendNormativeResultRemovedEmail(user, result) {
  const { subject, text, html } = renderNormativeResultRemovedEmail(result);
  await sendMail(user.email, subject, text, html, 'normative_removed');
}

export async function sendDocumentCreatedEmail(user, document) {
  const { subject, text, html } = renderDocumentCreatedEmail(document);
  await sendMail(user.email, subject, text, html, 'doc_created');
}

export async function sendDocumentSignedEmail(user, document) {
  const { subject, text, html } = renderDocumentSignedEmail(document);
  await sendMail(user.email, subject, text, html, 'doc_signed');
}

export async function sendDocumentRejectedEmail(user, document) {
  const { subject, text, html } = renderDocumentRejectedEmail(document);
  await sendMail(user.email, subject, text, html, 'doc_rejected');
}

export async function sendDocumentAwaitingSignatureEmail(user, document) {
  const { subject, text, html } =
    renderDocumentAwaitingSignatureEmail(document);
  await sendMail(user.email, subject, text, html, 'doc_awaiting_signature');
}

export async function sendMatchAgreementProposedEmail(user, event) {
  const { subject, text, html } = renderMatchAgreementProposedEmail(event);
  await sendMail(user.email, subject, text, html, 'match_proposed');
}

export async function sendMatchAgreementCounterProposedEmail(user, event) {
  const { subject, text, html } =
    renderMatchAgreementCounterProposedEmail(event);
  await sendMail(user.email, subject, text, html, 'match_counter_proposed');
}

export async function sendMatchAgreementApprovedEmail(user, event) {
  const { subject, text, html } = renderMatchAgreementApprovedEmail(event);
  await sendMail(user.email, subject, text, html, 'match_approved');
}

export async function sendMatchAgreementDeclinedEmail(user, event) {
  const { subject, text, html } = renderMatchAgreementDeclinedEmail(event);
  await sendMail(user.email, subject, text, html, 'match_declined');
}

export async function sendMatchAgreementWithdrawnEmail(user, event) {
  const { subject, text, html } = renderMatchAgreementWithdrawnEmail(event);
  await sendMail(user.email, subject, text, html, 'match_withdrawn');
}

export async function sendMatchAgreementReminderEmail(user, event) {
  const { subject, text, html } = renderMatchAgreementReminderEmail(event);
  await sendMail(user.email, subject, text, html, 'match_reminder');
}

export async function sendMatchAgreementDailyDigestEmail(user, digest) {
  const { subject, text, html } = renderMatchAgreementDailyDigestEmail(digest);
  await sendMail(user.email, subject, text, html, 'match_digest');
}
export default {
  isEmailConfigured,
  sendMail,
  sendVerificationEmail,
  sendSignTypeSelectionEmail,
  sendPasswordResetEmail,
  sendUserCreatedByAdminEmail,
  sendMedicalCertificateAddedEmail,
  sendAccountActivatedEmail,
  sendTrainingRegistrationEmail,
  sendTrainingRegistrationCancelledEmail,
  sendTrainingRegistrationSelfCancelledEmail,
  sendTrainingRoleChangedEmail,
  sendTrainingInvitationEmail,
  sendMedicalExamRegistrationCreatedEmail,
  sendMedicalExamRegistrationApprovedEmail,
  sendMedicalExamRegistrationCancelledEmail,
  sendMedicalExamRegistrationSelfCancelledEmail,
  sendMedicalExamRegistrationCompletedEmail,
  sendTicketCreatedEmail,
  sendTicketStatusChangedEmail,
  sendNormativeResultAddedEmail,
  sendNormativeResultUpdatedEmail,
  sendNormativeResultRemovedEmail,
  sendDocumentCreatedEmail,
  sendDocumentSignedEmail,
  sendDocumentRejectedEmail,
  sendDocumentAwaitingSignatureEmail,
  sendMatchAgreementProposedEmail,
  sendMatchAgreementCounterProposedEmail,
  sendMatchAgreementApprovedEmail,
  sendMatchAgreementDeclinedEmail,
  sendMatchAgreementWithdrawnEmail,
  sendMatchAgreementReminderEmail,
  sendMatchAgreementDailyDigestEmail,
};
