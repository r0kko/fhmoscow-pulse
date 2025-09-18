import { afterAll, expect, jest, test } from '@jest/globals';

const originalEnv = {
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM,
};

const loggerMock = {
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
};
const sendMailMock = jest.fn();
const createTransportMock = jest.fn(() => ({ sendMail: sendMailMock }));
const incEmailSentMock = jest.fn();

const templateDefinitions = [
  ['../src/templates/verificationEmail.js', 'renderVerificationEmail'],
  [
    '../src/templates/signTypeSelectionEmail.js',
    'renderSignTypeSelectionEmail',
  ],
  ['../src/templates/passwordResetEmail.js', 'renderPasswordResetEmail'],
  [
    '../src/templates/userCreatedByAdminEmail.js',
    'renderUserCreatedByAdminEmail',
  ],
  [
    '../src/templates/medicalCertificateAddedEmail.js',
    'renderMedicalCertificateAddedEmail',
  ],
  ['../src/templates/accountActivatedEmail.js', 'renderAccountActivatedEmail'],
  [
    '../src/templates/trainingRegistrationEmail.js',
    'renderTrainingRegistrationEmail',
  ],
  [
    '../src/templates/trainingRegistrationCancelledEmail.js',
    'renderTrainingRegistrationCancelledEmail',
  ],
  [
    '../src/templates/trainingRegistrationSelfCancelledEmail.js',
    'renderTrainingRegistrationSelfCancelledEmail',
  ],
  [
    '../src/templates/trainingRoleChangedEmail.js',
    'renderTrainingRoleChangedEmail',
  ],
  [
    '../src/templates/trainingInvitationEmail.js',
    'renderTrainingInvitationEmail',
  ],
  [
    '../src/templates/medicalExamRegistrationCreatedEmail.js',
    'renderMedicalExamRegistrationCreatedEmail',
  ],
  [
    '../src/templates/medicalExamRegistrationApprovedEmail.js',
    'renderMedicalExamRegistrationApprovedEmail',
  ],
  [
    '../src/templates/medicalExamRegistrationCancelledEmail.js',
    'renderMedicalExamRegistrationCancelledEmail',
  ],
  [
    '../src/templates/medicalExamRegistrationSelfCancelledEmail.js',
    'renderMedicalExamRegistrationSelfCancelledEmail',
  ],
  [
    '../src/templates/medicalExamRegistrationCompletedEmail.js',
    'renderMedicalExamRegistrationCompletedEmail',
  ],
  ['../src/templates/ticketCreatedEmail.js', 'renderTicketCreatedEmail'],
  [
    '../src/templates/ticketStatusChangedEmail.js',
    'renderTicketStatusChangedEmail',
  ],
  [
    '../src/templates/normativeResultAddedEmail.js',
    'renderNormativeResultAddedEmail',
  ],
  [
    '../src/templates/normativeResultUpdatedEmail.js',
    'renderNormativeResultUpdatedEmail',
  ],
  [
    '../src/templates/normativeResultRemovedEmail.js',
    'renderNormativeResultRemovedEmail',
  ],
  [
    '../src/templates/documentAwaitingSignatureEmail.js',
    'renderDocumentAwaitingSignatureEmail',
  ],
  ['../src/templates/documentSignCodeEmail.js', 'renderDocumentSignCodeEmail'],
  ['../src/templates/documentCreatedEmail.js', 'renderDocumentCreatedEmail'],
  ['../src/templates/documentSignedEmail.js', 'renderDocumentSignedEmail'],
  ['../src/templates/documentRejectedEmail.js', 'renderDocumentRejectedEmail'],
  [
    '../src/templates/matchAgreementProposedEmail.js',
    'renderMatchAgreementProposedEmail',
  ],
  [
    '../src/templates/matchAgreementCounterProposedEmail.js',
    'renderMatchAgreementCounterProposedEmail',
  ],
  [
    '../src/templates/matchAgreementApprovedEmail.js',
    'renderMatchAgreementApprovedEmail',
  ],
  [
    '../src/templates/matchAgreementDeclinedEmail.js',
    'renderMatchAgreementDeclinedEmail',
  ],
  [
    '../src/templates/matchAgreementWithdrawnEmail.js',
    'renderMatchAgreementWithdrawnEmail',
  ],
  [
    '../src/templates/matchAgreementReminderEmail.js',
    'renderMatchAgreementReminderEmail',
  ],
  [
    '../src/templates/matchAgreementDailyDigestEmail.js',
    'renderMatchAgreementDailyDigestEmail',
  ],
];

const fixtures = {
  verifyUser: { email: 'verify@test' },
  signTypeUser: { email: 'sign@test' },
  resetUser: { email: 'reset@test' },
  createdUser: { email: 'created@test' },
  medCertUser: { email: 'medcert@test' },
  activatedUser: { email: 'activated@test' },
  trainingRegUser: { email: 'trainreg@test' },
  trainingCancelUser: { email: 'traincancel@test' },
  trainingSelfCancelUser: { email: 'trainselfcancel@test' },
  trainingRoleUser: { email: 'trainrole@test' },
  trainingInviteUser: { email: 'traininv@test' },
  examCreateUser: { email: 'examcreate@test' },
  examApprovedUser: { email: 'examok@test' },
  examCancelUser: { email: 'examcancel@test' },
  examSelfUser: { email: 'examself@test' },
  examDoneUser: { email: 'examdone@test' },
  ticketCreateUser: { email: 'ticketcreate@test' },
  ticketStatusUser: { email: 'ticketstatus@test' },
  normativeAddedUser: { email: 'normadd@test' },
  normativeUpdatedUser: { email: 'normupd@test' },
  normativeRemovedUser: { email: 'normrem@test' },
  docCreatedUser: { email: 'doccreate@test' },
  docSignedUser: { email: 'docsign@test' },
  docRejectedUser: { email: 'docreject@test' },
  docAwaitUser: { email: 'docawait@test' },
  docCodeUser: { email: 'doccode@test' },
  matchProposedUser: { email: 'matchprop@test' },
  matchCounterUser: { email: 'matchcounter@test' },
  matchApprovedUser: { email: 'matchok@test' },
  matchDeclineUser: { email: 'matchdecline@test' },
  matchWithdrawUser: { email: 'matchwithdraw@test' },
  matchReminderUser: { email: 'matchrem@test' },
  matchDigestUser: { email: 'matchdigest@test' },
  training: { id: 'tr1' },
  role: { id: 'role1' },
  exam: { id: 'exam1' },
  ticket: { id: 'ticket1' },
  result: { id: 'result1' },
  document: { id: 'doc1' },
  event: { id: 'event1' },
  digest: [{ id: 'event1' }, { id: 'event2' }],
};

const wrapperMatrix = [
  {
    fn: 'sendVerificationEmail',
    template: 'renderVerificationEmail',
    args: [fixtures.verifyUser, '123456'],
    templateArgs: ['123456'],
    purpose: 'verification',
  },
  {
    fn: 'sendSignTypeSelectionEmail',
    template: 'renderSignTypeSelectionEmail',
    args: [fixtures.signTypeUser, '654321'],
    templateArgs: ['654321'],
    purpose: 'sign_type',
  },
  {
    fn: 'sendPasswordResetEmail',
    template: 'renderPasswordResetEmail',
    args: [fixtures.resetUser, 'abcdef'],
    templateArgs: ['abcdef'],
    purpose: 'password_reset',
  },
  {
    fn: 'sendUserCreatedByAdminEmail',
    template: 'renderUserCreatedByAdminEmail',
    args: [fixtures.createdUser, 'tmpPass!'],
    templateArgs: [fixtures.createdUser, 'tmpPass!'],
    purpose: 'user_created',
  },
  {
    fn: 'sendMedicalCertificateAddedEmail',
    template: 'renderMedicalCertificateAddedEmail',
    args: [fixtures.medCertUser],
    templateArgs: [],
    purpose: 'medical_certificate_added',
  },
  {
    fn: 'sendAccountActivatedEmail',
    template: 'renderAccountActivatedEmail',
    args: [fixtures.activatedUser],
    templateArgs: [],
    purpose: 'account_activated',
  },
  {
    fn: 'sendTrainingRegistrationEmail',
    template: 'renderTrainingRegistrationEmail',
    args: [fixtures.trainingRegUser, fixtures.training, fixtures.role, true],
    templateArgs: [fixtures.training, fixtures.role, true],
    purpose: 'training_registration',
  },
  {
    fn: 'sendTrainingRegistrationCancelledEmail',
    template: 'renderTrainingRegistrationCancelledEmail',
    args: [fixtures.trainingCancelUser, fixtures.training],
    templateArgs: [fixtures.training],
    purpose: 'training_registration_cancelled',
  },
  {
    fn: 'sendTrainingRegistrationSelfCancelledEmail',
    template: 'renderTrainingRegistrationSelfCancelledEmail',
    args: [fixtures.trainingSelfCancelUser, fixtures.training],
    templateArgs: [fixtures.training],
    purpose: 'training_registration_self_cancelled',
  },
  {
    fn: 'sendTrainingRoleChangedEmail',
    template: 'renderTrainingRoleChangedEmail',
    args: [fixtures.trainingRoleUser, fixtures.training, fixtures.role, false],
    templateArgs: [fixtures.training, fixtures.role, false],
    purpose: 'training_role_changed',
  },
  {
    fn: 'sendTrainingInvitationEmail',
    template: 'renderTrainingInvitationEmail',
    args: [fixtures.trainingInviteUser, fixtures.training],
    templateArgs: [fixtures.training],
    purpose: 'training_invitation',
  },
  {
    fn: 'sendMedicalExamRegistrationCreatedEmail',
    template: 'renderMedicalExamRegistrationCreatedEmail',
    args: [fixtures.examCreateUser, fixtures.exam, true],
    templateArgs: [fixtures.exam, true],
    purpose: 'exam_created',
  },
  {
    fn: 'sendMedicalExamRegistrationApprovedEmail',
    template: 'renderMedicalExamRegistrationApprovedEmail',
    args: [fixtures.examApprovedUser, fixtures.exam],
    templateArgs: [fixtures.exam],
    purpose: 'exam_approved',
  },
  {
    fn: 'sendMedicalExamRegistrationCancelledEmail',
    template: 'renderMedicalExamRegistrationCancelledEmail',
    args: [fixtures.examCancelUser, fixtures.exam],
    templateArgs: [fixtures.exam],
    purpose: 'exam_cancelled',
  },
  {
    fn: 'sendMedicalExamRegistrationSelfCancelledEmail',
    template: 'renderMedicalExamRegistrationSelfCancelledEmail',
    args: [fixtures.examSelfUser, fixtures.exam],
    templateArgs: [fixtures.exam],
    purpose: 'exam_self_cancelled',
  },
  {
    fn: 'sendMedicalExamRegistrationCompletedEmail',
    template: 'renderMedicalExamRegistrationCompletedEmail',
    args: [fixtures.examDoneUser, fixtures.exam],
    templateArgs: [fixtures.exam],
    purpose: 'exam_completed',
  },
  {
    fn: 'sendTicketCreatedEmail',
    template: 'renderTicketCreatedEmail',
    args: [fixtures.ticketCreateUser, fixtures.ticket],
    templateArgs: [fixtures.ticket],
    purpose: 'ticket_created',
  },
  {
    fn: 'sendTicketStatusChangedEmail',
    template: 'renderTicketStatusChangedEmail',
    args: [fixtures.ticketStatusUser, fixtures.ticket],
    templateArgs: [fixtures.ticket],
    purpose: 'ticket_status_changed',
  },
  {
    fn: 'sendNormativeResultAddedEmail',
    template: 'renderNormativeResultAddedEmail',
    args: [fixtures.normativeAddedUser, fixtures.result],
    templateArgs: [fixtures.result],
    purpose: 'normative_added',
  },
  {
    fn: 'sendNormativeResultUpdatedEmail',
    template: 'renderNormativeResultUpdatedEmail',
    args: [fixtures.normativeUpdatedUser, fixtures.result],
    templateArgs: [fixtures.result],
    purpose: 'normative_updated',
  },
  {
    fn: 'sendNormativeResultRemovedEmail',
    template: 'renderNormativeResultRemovedEmail',
    args: [fixtures.normativeRemovedUser, fixtures.result],
    templateArgs: [fixtures.result],
    purpose: 'normative_removed',
  },
  {
    fn: 'sendDocumentCreatedEmail',
    template: 'renderDocumentCreatedEmail',
    args: [fixtures.docCreatedUser, fixtures.document],
    templateArgs: [fixtures.document],
    purpose: 'doc_created',
  },
  {
    fn: 'sendDocumentSignedEmail',
    template: 'renderDocumentSignedEmail',
    args: [fixtures.docSignedUser, fixtures.document],
    templateArgs: [fixtures.document],
    purpose: 'doc_signed',
  },
  {
    fn: 'sendDocumentRejectedEmail',
    template: 'renderDocumentRejectedEmail',
    args: [fixtures.docRejectedUser, fixtures.document],
    templateArgs: [fixtures.document],
    purpose: 'doc_rejected',
  },
  {
    fn: 'sendDocumentAwaitingSignatureEmail',
    template: 'renderDocumentAwaitingSignatureEmail',
    args: [fixtures.docAwaitUser, fixtures.document],
    templateArgs: [fixtures.document],
    purpose: 'doc_awaiting_signature',
  },
  {
    fn: 'sendDocumentSignCodeEmail',
    template: 'renderDocumentSignCodeEmail',
    args: [fixtures.docCodeUser, fixtures.document, '1111'],
    templateArgs: [fixtures.document, '1111'],
    purpose: 'doc_sign_code',
  },
  {
    fn: 'sendMatchAgreementProposedEmail',
    template: 'renderMatchAgreementProposedEmail',
    args: [fixtures.matchProposedUser, fixtures.event],
    templateArgs: [fixtures.event],
    purpose: 'match_proposed',
  },
  {
    fn: 'sendMatchAgreementCounterProposedEmail',
    template: 'renderMatchAgreementCounterProposedEmail',
    args: [fixtures.matchCounterUser, fixtures.event],
    templateArgs: [fixtures.event],
    purpose: 'match_counter_proposed',
  },
  {
    fn: 'sendMatchAgreementApprovedEmail',
    template: 'renderMatchAgreementApprovedEmail',
    args: [fixtures.matchApprovedUser, fixtures.event],
    templateArgs: [fixtures.event],
    purpose: 'match_approved',
  },
  {
    fn: 'sendMatchAgreementDeclinedEmail',
    template: 'renderMatchAgreementDeclinedEmail',
    args: [fixtures.matchDeclineUser, fixtures.event],
    templateArgs: [fixtures.event],
    purpose: 'match_declined',
  },
  {
    fn: 'sendMatchAgreementWithdrawnEmail',
    template: 'renderMatchAgreementWithdrawnEmail',
    args: [fixtures.matchWithdrawUser, fixtures.event],
    templateArgs: [fixtures.event],
    purpose: 'match_withdrawn',
  },
  {
    fn: 'sendMatchAgreementReminderEmail',
    template: 'renderMatchAgreementReminderEmail',
    args: [fixtures.matchReminderUser, fixtures.event],
    templateArgs: [fixtures.event],
    purpose: 'match_reminder',
  },
  {
    fn: 'sendMatchAgreementDailyDigestEmail',
    template: 'renderMatchAgreementDailyDigestEmail',
    args: [fixtures.matchDigestUser, fixtures.digest],
    templateArgs: [fixtures.digest],
    purpose: 'match_digest',
  },
];

function registerTemplateMocks() {
  const templateMocks = {};
  for (const [path, exportName] of templateDefinitions) {
    const fn = jest.fn(() => ({
      subject: `${exportName} subject`,
      text: `${exportName} text`,
      html: '<div>body</div>',
    }));
    templateMocks[exportName] = fn;
    jest.unstable_mockModule(path, () => ({
      __esModule: true,
      [exportName]: fn,
    }));
  }
  return templateMocks;
}

async function loadService({ configured = true } = {}) {
  sendMailMock.mockReset();
  createTransportMock.mockReset().mockReturnValue({ sendMail: sendMailMock });
  incEmailSentMock.mockReset();
  loggerMock.warn.mockReset();
  loggerMock.info.mockReset();
  loggerMock.error.mockReset();

  if (configured) {
    process.env.SMTP_HOST = 'smtp.test';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'user@test';
    process.env.SMTP_PASS = 'secret';
    process.env.EMAIL_FROM = 'noreply@test';
  } else {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.EMAIL_FROM;
  }

  let mod;
  let templateMocks;

  await jest.isolateModulesAsync(async () => {
    templateMocks = registerTemplateMocks();

    jest.unstable_mockModule('nodemailer', () => ({
      __esModule: true,
      createTransport: createTransportMock,
      default: { createTransport: createTransportMock },
    }));

    jest.unstable_mockModule('../logger.js', () => ({
      __esModule: true,
      default: loggerMock,
    }));

    jest.unstable_mockModule('../src/config/metrics.js', () => ({
      __esModule: true,
      incEmailSent: incEmailSentMock,
    }));

    mod = await import('../src/services/emailService.js');
  });

  return { mod, templateMocks };
}

async function loadConfiguredModuleOnce() {
  jest.resetModules();
  sendMailMock.mockReset();
  createTransportMock.mockReset().mockReturnValue({ sendMail: sendMailMock });
  incEmailSentMock.mockReset();
  loggerMock.warn.mockReset();
  loggerMock.info.mockReset();
  loggerMock.error.mockReset();

  process.env.SMTP_HOST = 'smtp.test';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'user@test';
  process.env.SMTP_PASS = 'secret';
  process.env.EMAIL_FROM = 'noreply@test';

  const templateMocks = registerTemplateMocks();

  jest.unstable_mockModule('nodemailer', () => ({
    __esModule: true,
    createTransport: createTransportMock,
    default: { createTransport: createTransportMock },
  }));

  jest.unstable_mockModule('../logger.js', () => ({
    __esModule: true,
    default: loggerMock,
  }));

  jest.unstable_mockModule('../src/config/metrics.js', () => ({
    __esModule: true,
    incEmailSent: incEmailSentMock,
  }));

  const mod = await import('../src/services/emailService.js');
  return { mod, templateMocks };
}

afterAll(() => {
  Object.assign(process.env, originalEnv);
});

test('sendMail returns false and warns when SMTP is not configured', async () => {
  const { mod } = await loadService({ configured: false });
  const sent = await mod.sendMail('to@test', 'Hi', 'text', '<div>html</div>');
  expect(sent).toBe(false);
  expect(loggerMock.warn).toHaveBeenCalledWith('Email not configured');
  expect(sendMailMock).not.toHaveBeenCalled();
});

test('sendMail appends footer, records metrics, and logs success', async () => {
  const { mod } = await loadService();
  sendMailMock.mockResolvedValue();
  const ok = await mod.sendMail(
    'person@test',
    'Subject',
    'Body',
    '<div>Body</div>',
    'verification'
  );
  expect(ok).toBe(true);
  expect(createTransportMock).toHaveBeenCalledWith(
    expect.objectContaining({
      host: 'smtp.test',
      port: 587,
      auth: { user: 'user@test', pass: 'secret' },
      pool: true,
    })
  );
  expect(sendMailMock).toHaveBeenCalledWith(
    expect.objectContaining({
      from: 'noreply@test',
      to: 'person@test',
      subject: 'Subject',
      text: expect.stringContaining('С уважением'),
      html: expect.stringContaining('С уважением'),
    })
  );
  expect(loggerMock.info).toHaveBeenCalledWith(
    'Email sent to %s',
    'person@test'
  );
  expect(incEmailSentMock).toHaveBeenCalledWith('ok', 'verification');
});

test('sendMail logs error and reports metric failure', async () => {
  const { mod } = await loadService();
  sendMailMock.mockRejectedValue(new Error('SMTP down'));
  const ok = await mod.sendMail(
    'user@test',
    'Subj',
    'Txt',
    '<div>html</div>',
    'generic'
  );
  expect(ok).toBe(false);
  expect(loggerMock.error).toHaveBeenCalledWith(
    'Failed to send email to %s: %s',
    'user@test',
    'SMTP down'
  );
  expect(incEmailSentMock).toHaveBeenCalledWith('error', 'generic');
});

test('every mail wrapper delegates to template and sendMail with correct purpose', async () => {
  const { mod, templateMocks } = await loadConfiguredModuleOnce();
  sendMailMock.mockResolvedValue(true);

  for (const { fn, template, args, purpose } of wrapperMatrix) {
    const templateMock = templateMocks[template];
    expect(typeof templateMock).toBe('function');
    templateMock.mockClear();
    sendMailMock.mockClear();
    incEmailSentMock.mockClear();

    await mod[fn](...args);

    expect(templateMock).toHaveBeenCalled();
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: args[0].email })
    );
    expect(incEmailSentMock).toHaveBeenCalledWith('ok', purpose);
  }
});
