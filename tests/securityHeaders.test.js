import http from 'node:http';
import { PassThrough } from 'node:stream';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

jest.unstable_mockModule('../src/config/session.js', () => ({
  __esModule: true,
  default: (_req, _res, next) => next(),
}));

jest.unstable_mockModule('../src/routes/index.js', () => ({
  __esModule: true,
  default: (_req, _res, next) => next(),
}));

let app;
const originalEnv = {
  SECURITY_ENABLE_CSP: process.env.SECURITY_ENABLE_CSP,
  SECURITY_ENABLE_SWAGGER_CSP: process.env.SECURITY_ENABLE_SWAGGER_CSP,
  SESSION_SECRET: process.env.SESSION_SECRET,
};

beforeAll(async () => {
  process.env.SECURITY_ENABLE_CSP ??= 'true';
  process.env.SECURITY_ENABLE_SWAGGER_CSP ??= 'true';
  process.env.SESSION_SECRET ??= 'security-test-secret';
  ({ default: app } = await import('../app.js'));
});

afterAll(() => {
  if (originalEnv.SECURITY_ENABLE_CSP === undefined) {
    delete process.env.SECURITY_ENABLE_CSP;
  } else {
    process.env.SECURITY_ENABLE_CSP = originalEnv.SECURITY_ENABLE_CSP;
  }
  if (originalEnv.SECURITY_ENABLE_SWAGGER_CSP === undefined) {
    delete process.env.SECURITY_ENABLE_SWAGGER_CSP;
  } else {
    process.env.SECURITY_ENABLE_SWAGGER_CSP =
      originalEnv.SECURITY_ENABLE_SWAGGER_CSP;
  }
  if (originalEnv.SESSION_SECRET === undefined) {
    delete process.env.SESSION_SECRET;
  } else {
    process.env.SESSION_SECRET = originalEnv.SESSION_SECRET;
  }
});

async function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const reqSocket = new PassThrough();
    reqSocket.remoteAddress = '127.0.0.1';
    reqSocket.end();

    const resSocket = new PassThrough();
    const req = new http.IncomingMessage(reqSocket);
    req.method = 'GET';
    req.url = path;
    req.originalUrl = path;
    req.headers = {
      host: 'localhost',
      accept: 'text/html,application/xhtml+xml',
    };
    req.get = function (name) {
      return this.headers?.[String(name).toLowerCase()] || undefined;
    };
    req.query = Object.create(null);

    const res = new http.ServerResponse(req);
    const chunks = [];

    const handleError = (err) => {
      reqSocket.destroy();
      resSocket.destroy();
      reject(err);
    };

    resSocket.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    resSocket.on('error', handleError);
    res.on('error', handleError);
    res.on('finish', () => {
      resSocket.removeListener('error', handleError);
      res.removeListener('error', handleError);
      resSocket.end();
      resSocket.destroy();
      reqSocket.destroy();
      const body = Buffer.concat(chunks).toString('utf8');
      const headersMap = new Map(
        Object.entries(res.getHeaders()).map(([key, value]) => [
          key.toLowerCase(),
          Array.isArray(value) ? value.join(', ') : String(value),
        ])
      );
      const response = {
        status: res.statusCode,
        headers: {
          get(name) {
            if (!name) return null;
            return headersMap.get(String(name).toLowerCase()) ?? null;
          },
        },
        body,
      };
      resolve({ response });
    });

    res.assignSocket(resSocket);
    try {
      app.handle(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

describe('Security headers', () => {
  test('applies strict defaults on API responses', async () => {
    const { response } = await makeRequest('/does-not-exist');
    const csp = response.headers.get('content-security-policy');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe(
      'strict-origin-when-cross-origin'
    );
  });

  test('relaxes CSP for Swagger UI assets only as needed', async () => {
    const { response } = await makeRequest('/api-docs/');
    const csp = response.headers.get('content-security-policy');
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });
});
