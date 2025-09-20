import {
  afterAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

const originalEnv = {
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM,
};

const enqueueMock = jest.fn();
const startWorkerMock = jest.fn();
const stopWorkerMock = jest.fn();
const getStatsMock = jest.fn();

const loggerMock = {
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
};
const sendMailMock = jest.fn();
const createTransportMock = jest.fn(() => ({ sendMail: sendMailMock }));
const incEmailSentMock = jest.fn();
const observeEmailDeliveryMock = jest.fn();

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
  verifyUser: { id: 'u1', email: 'verify@test' },
  signTypeUser: { id: 'u2', email: 'sign@test' },
  resetUser: { id: 'u3', email: 'reset@test' },
  createdUser: { id: 'u4', email: 'created@test' },
  medCertUser: { id: 'u5', email: 'medcert@test' },
  activatedUser: { id: 'u6', email: 'activated@test' },
  trainingRegUser: { id: 'u7', email: 'trainreg@test' },
  trainingCancelUser: { id: 'u8', email: 'traincancel@test' },
  trainingSelfCancelUser: { id: 'u9', email: 'trainselfcancel@test' },
  trainingRoleUser: { id: 'u10', email: 'trainrole@test' },
  trainingInviteUser: { id: 'u11', email: 'traininv@test' },
  examCreateUser: { id: 'u12', email: 'examcreate@test' },
  examApprovedUser: { id: 'u13', email: 'examok@test' },
  examCancelUser: { id: 'u14', email: 'examcancel@test' },
  examSelfUser: { id: 'u15', email: 'examself@test' },
  examDoneUser: { id: 'u16', email: 'examdone@test' },
  ticketCreateUser: { id: 'u17', email: 'ticketcreate@test' },
  ticketStatusUser: { id: 'u18', email: 'ticketstatus@test' },
  normativeAddedUser: { id: 'u19', email: 'normadd@test' },
  normativeUpdatedUser: { id: 'u20', email: 'normupd@test' },
  normativeRemovedUser: { id: 'u21', email: 'normrem@test' },
  docCreatedUser: { id: 'u22', email: 'doccreate@test' },
  docSignedUser: { id: 'u23', email: 'docsign@test' },
  docRejectedUser: { id: 'u24', email: 'docreject@test' },
  docAwaitUser: { id: 'u25', email: 'docawait@test' },
  docCodeUser: { id: 'u26', email: 'doccode@test' },
  matchProposedUser: { id: 'u27', email: 'matchprop@test' },
  matchCounterUser: { id: 'u28', email: 'matchcounter@test' },
  matchApprovedUser: { id: 'u29', email: 'matchok@test' },
  matchDeclineUser: { id: 'u30', email: 'matchdecline@test' },
  matchWithdrawUser: { id: 'u31', email: 'matchwithdraw@test' },
  matchReminderUser: { id: 'u32', email: 'matchrem@test' },
  matchDigestUser: { id: 'u33', email: 'matchdigest@test' },
  training: { id: 'tr1' },
  role: { id: 'role1' },
  exam: { id: 'exam1', status: 'created' },
  ticket: { id: 'ticket1', status: 'open' },
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
    meta: { code: '123456' },
  },
  {
    fn: 'sendSignTypeSelectionEmail',
    template: 'renderSignTypeSelectionEmail',
    args: [fixtures.signTypeUser, '654321'],
    templateArgs: ['654321'],
    purpose: 'sign_type',
    meta: { code: '654321' },
  },
  {
    fn: 'sendPasswordResetEmail',
    template: 'renderPasswordResetEmail',
    args: [fixtures.resetUser, 'abcdef'],
    templateArgs: ['abcdef'],
    purpose: 'password_reset',
    meta: { code: 'abcdef' },
  },
  {
    fn: 'sendUserCreatedByAdminEmail',
    template: 'renderUserCreatedByAdminEmail',
    args: [fixtures.createdUser, 'tmpPass!'],
    templateArgs: [fixtures.createdUser, 'tmpPass!'],
    purpose: 'user_created',
    meta: { tempPasswordIssued: true },
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
    meta: { trainingId: 'tr1', roleId: 'role1', byAdmin: true },
  },
  {
    fn: 'sendTrainingRegistrationCancelledEmail',
    template: 'renderTrainingRegistrationCancelledEmail',
    args: [fixtures.trainingCancelUser, fixtures.training],
    templateArgs: [fixtures.training],
    purpose: 'training_registration_cancelled',
    meta: { trainingId: 'tr1' },
  },
  {
    fn: 'sendTrainingRegistrationSelfCancelledEmail',
    template: 'renderTrainingRegistrationSelfCancelledEmail',
    args: [fixtures.trainingSelfCancelUser, fixtures.training],
    templateArgs: [fixtures.training],
    purpose: 'training_registration_self_cancelled',
    meta: { trainingId: 'tr1' },
  },
  {
    fn: 'sendTrainingRoleChangedEmail',
    template: 'renderTrainingRoleChangedEmail',
    args: [fixtures.trainingRoleUser, fixtures.training, fixtures.role, false],
    templateArgs: [fixtures.training, fixtures.role, false],
    purpose: 'training_role_changed',
    meta: { trainingId: 'tr1', roleId: 'role1', byAdmin: false },
  },
  {
    fn: 'sendTrainingInvitationEmail',
    template: 'renderTrainingInvitationEmail',
    args: [fixtures.trainingInviteUser, fixtures.training],
    templateArgs: [fixtures.training],
    purpose: 'training_invitation',
    meta: { trainingId: 'tr1' },
  },
  {
    fn: 'sendMedicalExamRegistrationCreatedEmail',
    template: 'renderMedicalExamRegistrationCreatedEmail',
    args: [fixtures.examCreateUser, fixtures.exam, true],
    templateArgs: [fixtures.exam, true],
    purpose: 'exam_created',
    meta: { examId: 'exam1', byAdmin: true },
  },
  {
    fn: 'sendMedicalExamRegistrationApprovedEmail',
    template: 'renderMedicalExamRegistrationApprovedEmail',
    args: [fixtures.examApprovedUser, fixtures.exam],
    templateArgs: [fixtures.exam],
    purpose: 'exam_approved',
    meta: { examId: 'exam1' },
  },
  {
    fn: 'sendMedicalExamRegistrationCancelledEmail',
    template: 'renderMedicalExamRegistrationCancelledEmail',
    args: [fixtures.examCancelUser, fixtures.exam],
    templateArgs: [fixtures.exam],
    purpose: 'exam_cancelled',
    meta: { examId: 'exam1' },
  },
  {
    fn: 'sendMedicalExamRegistrationSelfCancelledEmail',
    template: 'renderMedicalExamRegistrationSelfCancelledEmail',
    args: [fixtures.examSelfUser, fixtures.exam],
    templateArgs: [fixtures.exam],
    purpose: 'exam_self_cancelled',
    meta: { examId: 'exam1' },
  },
  {
    fn: 'sendMedicalExamRegistrationCompletedEmail',
    template: 'renderMedicalExamRegistrationCompletedEmail',
    args: [fixtures.examDoneUser, fixtures.exam],
    templateArgs: [fixtures.exam],
    purpose: 'exam_completed',
    meta: { examId: 'exam1' },
  },
  {
    fn: 'sendTicketCreatedEmail',
    template: 'renderTicketCreatedEmail',
    args: [fixtures.ticketCreateUser, fixtures.ticket],
    templateArgs: [fixtures.ticket],
    purpose: 'ticket_created',
    meta: { ticketId: 'ticket1' },
  },
  {
    fn: 'sendTicketStatusChangedEmail',
    template: 'renderTicketStatusChangedEmail',
    args: [fixtures.ticketStatusUser, fixtures.ticket],
    templateArgs: [fixtures.ticket],
    purpose: 'ticket_status_changed',
    meta: { ticketId: 'ticket1', status: 'open' },
  },
  {
    fn: 'sendNormativeResultAddedEmail',
    template: 'renderNormativeResultAddedEmail',
    args: [fixtures.normativeAddedUser, fixtures.result],
    templateArgs: [fixtures.result],
    purpose: 'normative_added',
    meta: { resultId: 'result1' },
  },
  {
    fn: 'sendNormativeResultUpdatedEmail',
    template: 'renderNormativeResultUpdatedEmail',
    args: [fixtures.normativeUpdatedUser, fixtures.result],
    templateArgs: [fixtures.result],
    purpose: 'normative_updated',
    meta: { resultId: 'result1' },
  },
  {
    fn: 'sendNormativeResultRemovedEmail',
    template: 'renderNormativeResultRemovedEmail',
    args: [fixtures.normativeRemovedUser, fixtures.result],
    templateArgs: [fixtures.result],
    purpose: 'normative_removed',
    meta: { resultId: 'result1' },
  },
  {
    fn: 'sendDocumentCreatedEmail',
    template: 'renderDocumentCreatedEmail',
    args: [fixtures.docCreatedUser, fixtures.document],
    templateArgs: [fixtures.document],
    purpose: 'doc_created',
    meta: { documentId: 'doc1' },
  },
  {
    fn: 'sendDocumentSignedEmail',
    template: 'renderDocumentSignedEmail',
    args: [fixtures.docSignedUser, fixtures.document],
    templateArgs: [fixtures.document],
    purpose: 'doc_signed',
    meta: { documentId: 'doc1' },
  },
  {
    fn: 'sendDocumentRejectedEmail',
    template: 'renderDocumentRejectedEmail',
    args: [fixtures.docRejectedUser, fixtures.document],
    templateArgs: [fixtures.document],
    purpose: 'doc_rejected',
    meta: { documentId: 'doc1' },
  },
  {
    fn: 'sendDocumentAwaitingSignatureEmail',
    template: 'renderDocumentAwaitingSignatureEmail',
    args: [fixtures.docAwaitUser, fixtures.document],
    templateArgs: [fixtures.document],
    purpose: 'doc_awaiting_signature',
    meta: { documentId: 'doc1' },
  },
  {
    fn: 'sendDocumentSignCodeEmail',
    template: 'renderDocumentSignCodeEmail',
    args: [fixtures.docCodeUser, fixtures.document, '1111'],
    templateArgs: [fixtures.document, '1111'],
    purpose: 'doc_sign_code',
    meta: { documentId: 'doc1', code: '1111' },
  },
  {
    fn: 'sendMatchAgreementProposedEmail',
    template: 'renderMatchAgreementProposedEmail',
    args: [fixtures.matchProposedUser, fixtures.event],
    templateArgs: [fixtures.event],
    purpose: 'match_proposed',
    meta: { agreementId: 'event1' },
  },
  {
    fn: 'sendMatchAgreementCounterProposedEmail',
    template: 'renderMatchAgreementCounterProposedEmail',
    args: [fixtures.matchCounterUser, fixtures.event],
    templateArgs: [fixtures.event],
    purpose: 'match_counter_proposed',
    meta: { agreementId: 'event1' },
  },
  {
    fn: 'sendMatchAgreementApprovedEmail',
    template: 'renderMatchAgreementApprovedEmail',
    args: [fixtures.matchApprovedUser, fixtures.event],
    templateArgs: [fixtures.event],
    purpose: 'match_approved',
    meta: { agreementId: 'event1' },
  },
  {
    fn: 'sendMatchAgreementDeclinedEmail',
    template: 'renderMatchAgreementDeclinedEmail',
    args: [fixtures.matchDeclineUser, fixtures.event],
    templateArgs: [fixtures.event],
    purpose: 'match_declined',
    meta: { agreementId: 'event1' },
  },
  {
    fn: 'sendMatchAgreementWithdrawnEmail',
    template: 'renderMatchAgreementWithdrawnEmail',
    args: [fixtures.matchWithdrawUser, fixtures.event],
    templateArgs: [fixtures.event],
    purpose: 'match_withdrawn',
    meta: { agreementId: 'event1' },
  },
  {
    fn: 'sendMatchAgreementReminderEmail',
    template: 'renderMatchAgreementReminderEmail',
    args: [fixtures.matchReminderUser, fixtures.event],
    templateArgs: [fixtures.event],
    purpose: 'match_reminder',
    meta: { agreementId: 'event1' },
  },
  {
    fn: 'sendMatchAgreementDailyDigestEmail',
    template: 'renderMatchAgreementDailyDigestEmail',
    args: [fixtures.matchDigestUser, fixtures.digest],
    templateArgs: [fixtures.digest],
    purpose: 'match_digest',
    meta: { items: fixtures.digest.length },
  },
];

function registerTemplateMocks() {
  const mocks = {};
  for (const [path, exportName] of templateDefinitions) {
    const fn = jest.fn(() => ({
      subject: `${exportName} subject`,
      text: `${exportName} text`,
      html: '<div>body</div>',
    }));
    fn.displayName = exportName;
    mocks[exportName] = fn;
    jest.unstable_mockModule(path, () => ({
      __esModule: true,
      [exportName]: fn,
    }));
  }
  return mocks;
}

async function loadEmailService() {
  jest.resetModules();
  enqueueMock.mockReset();
  startWorkerMock.mockReset();
  stopWorkerMock.mockReset();
  getStatsMock.mockReset();

  let mod;
  let templateMocks;

  await jest.isolateModulesAsync(async () => {
    templateMocks = registerTemplateMocks();

    jest.unstable_mockModule('../src/services/email/emailQueue.js', () => ({
      __esModule: true,
      enqueueEmail: enqueueMock,
      startEmailWorker: startWorkerMock,
      stopEmailWorker: stopWorkerMock,
      getEmailQueueStats: getStatsMock,
    }));

    mod = await import('../src/services/emailService.js');
  });

  return { mod, templateMocks };
}

async function loadEmailTransport({ configured = true } = {}) {
  jest.resetModules();
  sendMailMock.mockReset();
  createTransportMock.mockReset().mockReturnValue({ sendMail: sendMailMock });
  incEmailSentMock.mockReset();
  observeEmailDeliveryMock.mockReset();
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

  await jest.isolateModulesAsync(async () => {
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
      observeEmailDelivery: observeEmailDeliveryMock,
    }));

    mod = await import('../src/services/email/emailTransport.js');
  });
  return {
    deliverEmail: mod.deliverEmail,
    resetTransportForTests: mod.resetTransportForTests,
  };
}

afterAll(() => {
  Object.assign(process.env, originalEnv);
});

describe('emailService', () => {
  test('sendMail returns false when queue rejects job', async () => {
    const { mod } = await loadEmailService();
    enqueueMock.mockResolvedValueOnce({ accepted: false });
    const ok = await mod.sendMail(
      'person@test',
      'Subject',
      'Body',
      '<div>Body</div>',
      'verification'
    );
    expect(ok).toBe(false);
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'person@test',
        subject: 'Subject',
        text: 'Body',
        html: '<div>Body</div>',
        purpose: 'verification',
      }),
      {}
    );
  });

  test('sendMail returns true when job accepted', async () => {
    const { mod } = await loadEmailService();
    enqueueMock.mockResolvedValueOnce({ accepted: true, jobId: 'job-1' });
    const ok = await mod.sendMail(
      'user@test',
      'Subj',
      'Txt',
      '<div>html</div>',
      'generic'
    );
    expect(ok).toBe(true);
  });

  test('sendMail forwards options metadata to queue', async () => {
    const { mod } = await loadEmailService();
    enqueueMock.mockResolvedValueOnce({ accepted: true });
    await mod.sendMail(
      'user@test',
      'Subj',
      'Txt',
      '<div>html</div>',
      'custom',
      { delayMs: 5000, metadata: { correlationId: 'abc' } }
    );
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'custom',
        metadata: { correlationId: 'abc' },
      }),
      { delayMs: 5000, metadata: { correlationId: 'abc' } }
    );
  });

  test('enqueueMail proxies payload to queue module', async () => {
    const envelope = {
      to: 'person@test',
      subject: 'Subject',
      text: 'Body',
      html: '<div>Body</div>',
      purpose: 'generic',
    };
    const options = { delayMs: 2000 };
    const { mod } = await loadEmailService();
    enqueueMock.mockResolvedValueOnce({ accepted: true, jobId: 'job-2' });
    const result = await mod.enqueueMail(envelope, options);
    expect(result).toEqual({ accepted: true, jobId: 'job-2' });
    expect(enqueueMock).toHaveBeenCalledWith(envelope, options);
  });

  test('each wrapper delegates to enqueueEmail with metadata and purpose', async () => {
    const { mod, templateMocks } = await loadEmailService();
    enqueueMock.mockResolvedValue({ accepted: true });

    for (const { fn, template, args, purpose, meta } of wrapperMatrix) {
      const templateMock = templateMocks[template];
      expect(typeof templateMock).toBe('function');
      templateMock.mockClear();
      enqueueMock.mockClear();

      await mod[fn](...args);

      expect(templateMock).toHaveBeenCalledTimes(1);
      expect(enqueueMock).toHaveBeenCalledTimes(1);

      const [envelope] = enqueueMock.mock.calls[0];
      expect(envelope.to).toBe(args[0].email);
      expect(envelope.purpose).toBe(purpose);
      expect(envelope.subject).toBe(`${template} subject`);
      expect(envelope.text).toBe(`${template} text`);
      expect(envelope.html).toBe('<div>body</div>');
      expect(envelope.metadata.template).toBe(template);
      expect(envelope.metadata.email).toBe(args[0].email);
      if (args[0].id) {
        expect(envelope.metadata.userId).toBe(args[0].id);
      }
      if (meta) {
        for (const [key, value] of Object.entries(meta)) {
          expect(envelope.metadata[key]).toEqual(value);
        }
      }
    }
  });
});

describe('emailTransport', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  test('throws when SMTP transport is not configured', async () => {
    const { deliverEmail } = await loadEmailTransport({ configured: false });
    await expect(
      deliverEmail({
        to: 'user@test',
        subject: 'Hi',
        text: 'Body',
        html: '<div>Body</div>',
      })
    ).rejects.toThrow('SMTP transport is not configured');
  });

  test('appends footer, records metrics, and logs success', async () => {
    const { deliverEmail, resetTransportForTests } = await loadEmailTransport();
    sendMailMock.mockResolvedValue({ messageId: 'msg-1' });

    await deliverEmail({
      id: 'job-1',
      to: 'person@test',
      subject: 'Subject',
      text: 'Body',
      html: '<div>Body</div>',
      purpose: 'verification',
    });

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
        text: 'Body',
        html: '<div>Body</div>',
        headers: expect.objectContaining({
          'X-Email-Purpose': 'verification',
          'X-Email-Job-Id': 'job-1',
        }),
      })
    );
    expect(incEmailSentMock).toHaveBeenCalledWith('ok', 'verification');
    expect(observeEmailDeliveryMock).toHaveBeenCalledWith(
      'ok',
      'verification',
      expect.any(Number)
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Email delivered',
      expect.objectContaining({
        to: 'person@test',
        purpose: 'verification',
        jobId: 'job-1',
      })
    );
    resetTransportForTests();
  });

  test('logs failure and increments error metrics on delivery failure', async () => {
    const { deliverEmail, resetTransportForTests } = await loadEmailTransport();
    sendMailMock.mockRejectedValue(new Error('SMTP down'));

    await expect(
      deliverEmail({
        id: 'job-err',
        to: 'user@test',
        subject: 'Subj',
        text: 'Txt',
        html: '<div>html</div>',
        purpose: 'generic',
      })
    ).rejects.toThrow('Email delivery failed');

    expect(incEmailSentMock).toHaveBeenCalledWith('error', 'generic');
    expect(observeEmailDeliveryMock).toHaveBeenCalledWith(
      'error',
      'generic',
      expect.any(Number)
    );
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Email delivery failed',
      expect.objectContaining({
        to: 'user@test',
        purpose: 'generic',
        jobId: 'job-err',
        error: 'SMTP down',
      })
    );
    resetTransportForTests();
  });
});
