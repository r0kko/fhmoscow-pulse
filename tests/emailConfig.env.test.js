/* eslint-env node */
/* global process */
import { expect, test, jest } from '@jest/globals';

test('SMTP_PORT uses provided environment variable', async () => {
  jest.resetModules();
  process.env.SMTP_PORT = '2525';
  const mod = await import('../src/config/email.js');
  expect(mod.SMTP_PORT).toBe(2525);
});
