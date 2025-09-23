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
import { renderDocumentSignCodeEmail } from '../templates/documentSignCodeEmail.js';
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

import { isEmailConfigured } from './email/emailTransport.js';
import {
  enqueueEmail as enqueueEmailJob,
  startEmailWorker,
  stopEmailWorker,
  getEmailQueueStats,
} from './email/emailQueue.js';

function sanitizeMetadata(meta = {}) {
  return Object.entries(meta)
    .filter(([, value]) => value !== undefined && value !== null)
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
}

function userMetadata(user) {
  if (!user || typeof user !== 'object') return {};
  return sanitizeMetadata({
    userId: user.id,
    email: user.email,
    legacyId: user.legacy_id,
  });
}

function buildTemplateDedupeKey({
  templateName,
  purpose,
  user,
  metadata,
}) {
  const payload = {
    template: templateName,
    purpose,
    userId: user?.id,
    email: user?.email,
    metadata,
  };
  return JSON.stringify(payload);
}

async function queueMailFromTemplate(
  user,
  templateFn,
  templateArgs,
  purpose,
  extraMeta = {}
) {
  if (!user?.email) return;
  const { subject, text, html } = templateFn(...templateArgs);
  const templateName = templateFn?.displayName || templateFn?.name || purpose;
  const metadata = sanitizeMetadata({
    template: templateName,
    ...userMetadata(user),
    ...extraMeta,
  });
  const dedupeKey = buildTemplateDedupeKey({
    templateName,
    purpose,
    user,
    metadata,
  });
  await enqueueEmailJob({
    to: user.email,
    subject,
    text,
    html,
    purpose,
    metadata,
    dedupeKey,
  });
}

export async function enqueueMail(envelope, options = {}) {
  return enqueueEmailJob(envelope, options);
}

export async function sendMail(
  to,
  subject,
  text,
  html,
  purpose = 'generic',
  options = {}
) {
  const result = await enqueueMail(
    { to, subject, text, html, purpose, metadata: options.metadata },
    options
  );
  return Boolean(
    result.accepted ||
      result.delivered ||
      result.reason === 'duplicate'
  );
}

export async function sendVerificationEmail(user, code) {
  await queueMailFromTemplate(
    user,
    renderVerificationEmail,
    [code],
    'verification',
    { code }
  );
}

export async function sendSignTypeSelectionEmail(user, code) {
  await queueMailFromTemplate(
    user,
    renderSignTypeSelectionEmail,
    [code],
    'sign_type',
    { code }
  );
}

export async function sendPasswordResetEmail(user, code) {
  await queueMailFromTemplate(
    user,
    renderPasswordResetEmail,
    [code],
    'password_reset',
    { code }
  );
}

export async function sendUserCreatedByAdminEmail(user, tempPassword) {
  await queueMailFromTemplate(
    user,
    renderUserCreatedByAdminEmail,
    [user, tempPassword],
    'user_created',
    { tempPasswordIssued: Boolean(tempPassword) }
  );
}

export async function sendMedicalCertificateAddedEmail(user) {
  await queueMailFromTemplate(
    user,
    renderMedicalCertificateAddedEmail,
    [],
    'medical_certificate_added'
  );
}

export async function sendAccountActivatedEmail(user) {
  await queueMailFromTemplate(
    user,
    renderAccountActivatedEmail,
    [],
    'account_activated'
  );
}

export async function sendTrainingRegistrationEmail(
  user,
  training,
  role,
  byAdmin = false
) {
  await queueMailFromTemplate(
    user,
    renderTrainingRegistrationEmail,
    [training, role, byAdmin],
    'training_registration',
    sanitizeMetadata({
      trainingId: training?.id,
      roleId: role?.id,
      byAdmin,
    })
  );
}

export async function sendTrainingRegistrationCancelledEmail(user, training) {
  await queueMailFromTemplate(
    user,
    renderTrainingRegistrationCancelledEmail,
    [training],
    'training_registration_cancelled',
    { trainingId: training?.id }
  );
}

export async function sendTrainingRegistrationSelfCancelledEmail(
  user,
  training
) {
  await queueMailFromTemplate(
    user,
    renderTrainingRegistrationSelfCancelledEmail,
    [training],
    'training_registration_self_cancelled',
    { trainingId: training?.id }
  );
}

export async function sendTrainingRoleChangedEmail(
  user,
  training,
  role,
  byAdmin = true
) {
  await queueMailFromTemplate(
    user,
    renderTrainingRoleChangedEmail,
    [training, role, byAdmin],
    'training_role_changed',
    sanitizeMetadata({
      trainingId: training?.id,
      roleId: role?.id,
      byAdmin,
    })
  );
}

export async function sendTrainingInvitationEmail(user, training) {
  await queueMailFromTemplate(
    user,
    renderTrainingInvitationEmail,
    [training],
    'training_invitation',
    { trainingId: training?.id }
  );
}

export async function sendMedicalExamRegistrationCreatedEmail(
  user,
  exam,
  byAdmin = false
) {
  await queueMailFromTemplate(
    user,
    renderMedicalExamRegistrationCreatedEmail,
    [exam, byAdmin],
    'exam_created',
    sanitizeMetadata({ examId: exam?.id, byAdmin })
  );
}

export async function sendMedicalExamRegistrationApprovedEmail(user, exam) {
  await queueMailFromTemplate(
    user,
    renderMedicalExamRegistrationApprovedEmail,
    [exam],
    'exam_approved',
    { examId: exam?.id }
  );
}

export async function sendMedicalExamRegistrationCancelledEmail(user, exam) {
  await queueMailFromTemplate(
    user,
    renderMedicalExamRegistrationCancelledEmail,
    [exam],
    'exam_cancelled',
    { examId: exam?.id }
  );
}

export async function sendMedicalExamRegistrationSelfCancelledEmail(
  user,
  exam
) {
  await queueMailFromTemplate(
    user,
    renderMedicalExamRegistrationSelfCancelledEmail,
    [exam],
    'exam_self_cancelled',
    { examId: exam?.id }
  );
}

export async function sendMedicalExamRegistrationCompletedEmail(user, exam) {
  await queueMailFromTemplate(
    user,
    renderMedicalExamRegistrationCompletedEmail,
    [exam],
    'exam_completed',
    { examId: exam?.id }
  );
}

export async function sendTicketCreatedEmail(user, ticket) {
  await queueMailFromTemplate(
    user,
    renderTicketCreatedEmail,
    [ticket],
    'ticket_created',
    { ticketId: ticket?.id }
  );
}

export async function sendTicketStatusChangedEmail(user, ticket) {
  await queueMailFromTemplate(
    user,
    renderTicketStatusChangedEmail,
    [ticket],
    'ticket_status_changed',
    { ticketId: ticket?.id, status: ticket?.status }
  );
}

export async function sendNormativeResultAddedEmail(user, result) {
  await queueMailFromTemplate(
    user,
    renderNormativeResultAddedEmail,
    [result],
    'normative_added',
    { resultId: result?.id }
  );
}

export async function sendNormativeResultUpdatedEmail(user, result) {
  await queueMailFromTemplate(
    user,
    renderNormativeResultUpdatedEmail,
    [result],
    'normative_updated',
    { resultId: result?.id }
  );
}

export async function sendNormativeResultRemovedEmail(user, result) {
  await queueMailFromTemplate(
    user,
    renderNormativeResultRemovedEmail,
    [result],
    'normative_removed',
    { resultId: result?.id }
  );
}

export async function sendDocumentCreatedEmail(user, document) {
  await queueMailFromTemplate(
    user,
    renderDocumentCreatedEmail,
    [document],
    'doc_created',
    { documentId: document?.id }
  );
}

export async function sendDocumentSignedEmail(user, document) {
  await queueMailFromTemplate(
    user,
    renderDocumentSignedEmail,
    [document],
    'doc_signed',
    { documentId: document?.id }
  );
}

export async function sendDocumentRejectedEmail(user, document) {
  await queueMailFromTemplate(
    user,
    renderDocumentRejectedEmail,
    [document],
    'doc_rejected',
    { documentId: document?.id }
  );
}

export async function sendDocumentAwaitingSignatureEmail(user, document) {
  await queueMailFromTemplate(
    user,
    renderDocumentAwaitingSignatureEmail,
    [document],
    'doc_awaiting_signature',
    { documentId: document?.id }
  );
}

export async function sendDocumentSignCodeEmail(user, document, code) {
  await queueMailFromTemplate(
    user,
    renderDocumentSignCodeEmail,
    [document, code],
    'doc_sign_code',
    { documentId: document?.id, code }
  );
}

export async function sendMatchAgreementProposedEmail(user, event) {
  await queueMailFromTemplate(
    user,
    renderMatchAgreementProposedEmail,
    [event],
    'match_proposed',
    { agreementId: event?.id }
  );
}

export async function sendMatchAgreementCounterProposedEmail(user, event) {
  await queueMailFromTemplate(
    user,
    renderMatchAgreementCounterProposedEmail,
    [event],
    'match_counter_proposed',
    { agreementId: event?.id }
  );
}

export async function sendMatchAgreementApprovedEmail(user, event) {
  await queueMailFromTemplate(
    user,
    renderMatchAgreementApprovedEmail,
    [event],
    'match_approved',
    { agreementId: event?.id }
  );
}

export async function sendMatchAgreementDeclinedEmail(user, event) {
  await queueMailFromTemplate(
    user,
    renderMatchAgreementDeclinedEmail,
    [event],
    'match_declined',
    { agreementId: event?.id }
  );
}

export async function sendMatchAgreementWithdrawnEmail(user, event) {
  await queueMailFromTemplate(
    user,
    renderMatchAgreementWithdrawnEmail,
    [event],
    'match_withdrawn',
    { agreementId: event?.id }
  );
}

export async function sendMatchAgreementReminderEmail(user, event) {
  await queueMailFromTemplate(
    user,
    renderMatchAgreementReminderEmail,
    [event],
    'match_reminder',
    { agreementId: event?.id }
  );
}

export async function sendMatchAgreementDailyDigestEmail(user, digest) {
  const itemCount = Array.isArray(digest?.teams)
    ? digest.teams.reduce(
        (acc, team) =>
          acc + (team.assign?.length || 0) + (team.decide?.length || 0),
        0
      )
    : 0;
  await queueMailFromTemplate(
    user,
    renderMatchAgreementDailyDigestEmail,
    [digest],
    'match_digest',
    { items: itemCount }
  );
}

export {
  isEmailConfigured,
  startEmailWorker,
  stopEmailWorker,
  getEmailQueueStats,
};

export default {
  isEmailConfigured,
  enqueueMail,
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
  sendDocumentSignCodeEmail,
  sendMatchAgreementProposedEmail,
  sendMatchAgreementCounterProposedEmail,
  sendMatchAgreementApprovedEmail,
  sendMatchAgreementDeclinedEmail,
  sendMatchAgreementWithdrawnEmail,
  sendMatchAgreementReminderEmail,
  sendMatchAgreementDailyDigestEmail,
  startEmailWorker,
  stopEmailWorker,
  getEmailQueueStats,
};
