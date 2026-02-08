import { afterEach, beforeEach, expect, test } from '@jest/globals';

const saved = {
  RATE_LIMIT_IP_SOURCE: process.env.RATE_LIMIT_IP_SOURCE,
  NODE_ENV: process.env.NODE_ENV,
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
  if (saved.NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = saved.NODE_ENV;
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

test('production defaults to auto mode', async () => {
  process.env.NODE_ENV = 'production';
  const { getClientIp } = await import('../src/utils/clientIp.js');
  expect(
    getClientIp({
      ip: '10.0.0.5',
      headers: {
        'x-real-ip': '203.0.113.77',
      },
    })
  ).toBe('203.0.113.77');
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
