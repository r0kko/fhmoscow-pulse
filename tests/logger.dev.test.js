import { afterEach, expect, jest, test } from '@jest/globals';

const spanContextMock = { traceId: 'trace-123', spanId: 'span-456' };

afterEach(() => {
  jest.restoreAllMocks();
});

jest.unstable_mockModule('@opentelemetry/api', () => ({
  __esModule: true,
  context: { active: () => 'ctx' },
  trace: {
    getSpan: () => ({
      spanContext: () => spanContextMock,
    }),
  },
}));

test('dev logger output includes trace metadata and default meta', async () => {
  jest.resetModules();
  process.env.NODE_ENV = 'development';
  process.env.VERSION = '1.2.3';
  const logger = (await import('../logger.js')).default;
  const messages = [];
  const { transports } = await import('winston');
  const { Writable } = await import('node:stream');
  const capture = new transports.Stream({
    stream: new Writable({
      write(chunk, _enc, cb) {
        messages.push(String(chunk));
        cb();
      },
    }),
  });
  logger.add(capture);
  logger.info('hello world', { request_id: 'req-1' });
  const formatted = messages.join('\n');
  expect(formatted).toEqual(expect.stringContaining('trace_id=trace-123'));
  expect(formatted).toEqual(expect.stringContaining('span_id=span-456'));
  expect(formatted).toEqual(expect.stringContaining('service=api'));
  expect(formatted).toEqual(expect.stringContaining('env=development'));
  logger.remove(capture);
});
