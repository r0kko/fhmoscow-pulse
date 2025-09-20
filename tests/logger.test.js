import { expect, test } from '@jest/globals';

const { default: logger } = await import('../logger.js');

test('logger exposes console transport', () => {
  const consoleTransport = logger.transports.find((transport) =>
    typeof transport?.log === 'function'
  );
  expect(consoleTransport).toBeDefined();
});

test('logger handles error logging without throwing', () => {
  expect(() => logger.error('Sample error log')).not.toThrow();
});
