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

async function loadService({ configured = true } = {}) {
  jest.resetModules();
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

  return import('../src/services/emailService.js');
}

afterAll(() => {
  Object.assign(process.env, originalEnv);
});

test('sendMail returns false and warns when SMTP is not configured', async () => {
  const mod = await loadService({ configured: false });
  const sent = await mod.sendMail('to@test', 'Hi', 'text', '<div>html</div>');
  expect(sent).toBe(false);
  expect(loggerMock.warn).toHaveBeenCalledWith('Email not configured');
  expect(sendMailMock).not.toHaveBeenCalled();
});

test('sendMail appends footer, records metrics, and logs success', async () => {
  const mod = await loadService();
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
  const mod = await loadService();
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

test('wrapper functions delegate to sendMail with semantics', async () => {
  const mod = await loadService();
  sendMailMock.mockResolvedValue(true);
  incEmailSentMock.mockClear();

  await mod.sendVerificationEmail({ email: 'v@test' }, '123456');
  await mod.sendPasswordResetEmail({ email: 'p@test' }, '654321');
  await mod.sendAccountActivatedEmail({ email: 'a@test' });
  await mod.sendDocumentSignCodeEmail(
    { email: 'd@test' },
    { id: 'doc1' },
    '1111'
  );

  expect(sendMailMock.mock.calls.map((call) => call[0].to)).toEqual([
    'v@test',
    'p@test',
    'a@test',
    'd@test',
  ]);
  expect(incEmailSentMock.mock.calls.map((call) => call[1])).toEqual([
    'verification',
    'password_reset',
    'account_activated',
    'doc_sign_code',
  ]);
});
