import { jest, describe, expect, test, afterEach } from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };

async function loadDocsModule(env = {}) {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, ...env };
  return import('../src/config/docs.js');
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('config/docs access policy', () => {
  test('collectCandidateIps normalizes and deduplicates addresses', async () => {
    const { collectCandidateIps } = await loadDocsModule();
    const req = {
      ip: '127.0.0.1',
      ips: ['::1', '10.0.0.5'],
      headers: {
        'x-forwarded-for': '203.0.113.5, [2001:db8::1]:443, 192.0.2.10:8080',
      },
      socket: { remoteAddress: '::ffff:192.168.0.1' },
    };

    const ips = collectCandidateIps(req);

    expect(ips).toEqual(
      expect.arrayContaining([
        '127.0.0.1',
        '::1',
        '10.0.0.5',
        '203.0.113.5',
        '2001:db8::1',
        '192.0.2.10',
        '192.168.0.1',
      ])
    );
  });

  test('mode toggles docs visibility', async () => {
    let docs = await loadDocsModule({ API_DOCS_ACCESS: 'disabled' });
    expect(docs.isDocsEnabled()).toBe(false);

    docs = await loadDocsModule({ API_DOCS_ACCESS: 'public' });
    expect(docs.isDocsEnabled()).toBe(true);
    expect(docs.isDocsPublic()).toBe(true);

    docs = await loadDocsModule({ API_DOCS_ACCESS: 'local' });
    expect(docs.isDocsEnabled()).toBe(true);
    expect(docs.isDocsPublic()).toBe(false);

    const req = { ip: '203.0.113.5', headers: {} };
    expect(docs.isApiDocsRequestAllowed(req)).toBe(false);
    expect(docs.isApiDocsRequestAllowed({ ip: '10.1.2.3', headers: {} })).toBe(
      true
    );
  });

  test('allow list entries support loopback, cidr, and explicit addresses', async () => {
    const docs = await loadDocsModule({
      API_DOCS_ACCESS: 'local',
      API_DOCS_ALLOWLIST:
        'loopback, 198.51.100.10, 10.10.0.0/16, 2001:db8::/48',
    });

    const { apiDocsAllowList, isApiDocsRequestAllowed } = docs;
    expect(apiDocsAllowList).toHaveLength(4);

    const loopbackReq = { ip: '127.0.0.1', headers: {} };
    expect(isApiDocsRequestAllowed(loopbackReq)).toBe(true);

    const explicitReq = { ip: '198.51.100.10', headers: {} };
    expect(isApiDocsRequestAllowed(explicitReq)).toBe(true);

    const cidrReq = { ip: '10.10.5.12', headers: {} };
    expect(isApiDocsRequestAllowed(cidrReq)).toBe(true);

    const ipv6Req = { ip: '2001:db8::1234', headers: {} };
    expect(isApiDocsRequestAllowed(ipv6Req)).toBe(true);

    const outsideReq = { ip: '203.0.113.20', headers: {} };
    expect(isApiDocsRequestAllowed(outsideReq)).toBe(false);
  });

  test('cidr with zero prefix matches any IPv4 address', async () => {
    const docs = await loadDocsModule({
      API_DOCS_ACCESS: 'local',
      API_DOCS_ALLOWLIST: '0.0.0.0/0',
    });
    expect(
      docs.isApiDocsRequestAllowed({ ip: '203.0.113.5', headers: {} })
    ).toBe(true);
  });

  test('collectCandidateIps handles invalid and zoned IPv6 addresses gracefully', async () => {
    const { collectCandidateIps } = await loadDocsModule();
    const req = {
      headers: { 'x-forwarded-for': 'fe80::1%eth0, not_an_ip' },
      socket: { remoteAddress: '[2001:db8::2]:8080' },
    };
    expect(collectCandidateIps(req)).toEqual(['fe80::1', '2001:db8::2']);
  });
});
