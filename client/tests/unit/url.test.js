import { withHttp } from '../../src/utils/url.js';

describe('withHttp', () => {
  it('returns as-is for http/https', () => {
    expect(withHttp('http://a.com')).toBe('http://a.com');
    expect(withHttp('https://a.com')).toBe('https://a.com');
  });
  it('prefixes missing scheme', () => {
    expect(withHttp('example.com')).toBe('http://example.com');
  });
  it('handles falsy values', () => {
    expect(withHttp('')).toBe('');
    expect(withHttp(null)).toBe(null);
    expect(withHttp(undefined)).toBe(undefined);
  });
});
