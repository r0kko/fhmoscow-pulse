import { jest, expect, test, beforeEach } from '@jest/globals';
import { setImmediate as setImmediateAsync } from 'node:timers';

const createMock = jest.fn();

jest.unstable_mockModule('../src/models/log.js', () => ({
  __esModule: true,
  default: { create: createMock },
}));

const { default: logger } = await import('../logger.js');
const stream = logger.transports[0]._stream;

beforeEach(() => {
  jest.clearAllMocks();
});

test('persists valid combined log line with response time', async () => {
  const line =
    '123.123.123.123 - - [10/Oct/2000:13:55:36 +0000] "GET /test HTTP/1.1" 200 123 "-" "Agent" 10ms';

  await new Promise((resolve) => stream.write({ message: line }, null, resolve));

  expect(createMock).toHaveBeenCalledWith(
    expect.objectContaining({
      ip: '123.123.123.123',
      method: 'GET',
      path: '/test',
      status_code: 200,
      user_agent: 'Agent',
      response_time: 10,
    })
  );
});

test('persists log line without response time', async () => {
  const line =
    '123.123.123.123 - - [10/Oct/2000:13:55:36 +0000] "POST /foo HTTP/1.1" 201 123 "-" "Agent"';

  await new Promise((resolve) => stream.write({ message: line }, null, resolve));

  expect(createMock).toHaveBeenCalledWith(
    expect.objectContaining({
      method: 'POST',
      path: '/foo',
      status_code: 201,
      response_time: null,
    })
  );
});

test('ignores unparsable log lines', async () => {
  await new Promise((resolve) => stream.write({ message: 'not a combined line' }, null, resolve));
  expect(createMock).not.toHaveBeenCalled();
});

test('warns when persistence fails', async () => {
  const line =
    '123.123.123.123 - - [10/Oct/2000:13:55:36 +0000] "GET /err HTTP/1.1" 500 123 "-" "Agent" 1ms';
  createMock.mockRejectedValueOnce(new Error('fail'));
  const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

  await new Promise((resolve) => stream.write({ message: line }, null, resolve));

  expect(warnSpy).toHaveBeenCalledWith('DB log persistence failed:', 'fail');
});

test('pretty format handles simple messages', async () => {
  logger.info('hello');
  await new Promise((resolve) => setImmediateAsync(resolve));
  expect(createMock).not.toHaveBeenCalled();
});
