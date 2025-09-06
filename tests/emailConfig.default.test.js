/* eslint-env node */
/* global process */
import { expect, test, jest } from '@jest/globals';

test('SMTP_PORT defaults to 587 when not provided', async () => {
  jest.resetModules();
  delete process.env.SMTP_PORT;
  const mod = await import('../src/config/email.js');
  expect(mod.SMTP_PORT).toBe(587);
});
