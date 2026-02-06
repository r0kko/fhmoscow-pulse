import { afterEach, beforeEach, expect, test } from '@jest/globals';

const saved = {
  RATE_LIMIT_IP_SOURCE: process.env.RATE_LIMIT_IP_SOURCE,
};

beforeEach(() => {
  delete process.env.RATE_LIMIT_IP_SOURCE;
});

afterEach(() => {
  if (saved.RATE_LIMIT_IP_SOURCE === undefined) {
    delete process.env.RATE_LIMIT_IP_SOURCE;
  } else {
    process.env.RATE_LIMIT_IP_SOURCE = saved.RATE_LIMIT_IP_SOURCE;
  }
});

test('defaults to req.ip', async () => {
  const { getClientIp } = await import('../src/utils/clientIp.js');
  expect(getClientIp({ ip: '198.51.100.10' })).toBe('198.51.100.10');
});

test('auto mode prioritizes CDN headers', async () => {
  process.env.RATE_LIMIT_IP_SOURCE = 'auto';
  const { getClientIp } = await import('../src/utils/clientIp.js');
  expect(
    getClientIp({
      ip: '10.0.0.5',
      headers: {
        'cf-connecting-ip': '203.0.113.55',
        'x-forwarded-for': '198.51.100.10, 10.0.0.5',
      },
    })
  ).toBe('203.0.113.55');
});

test('x_forwarded_for mode parses first hop and strips ports', async () => {
  process.env.RATE_LIMIT_IP_SOURCE = 'x_forwarded_for';
  const { getClientIp } = await import('../src/utils/clientIp.js');
  expect(
    getClientIp({
      headers: {
        'x-forwarded-for': '198.51.100.10:443, 10.0.0.5',
      },
    })
  ).toBe('198.51.100.10');
});
