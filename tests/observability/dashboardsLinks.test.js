import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'infra/observability/grafana/dashboards';

function walkCollectUrls(node, urls = []) {
  if (Array.isArray(node)) {
    for (const v of node) walkCollectUrls(v, urls);
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'url' && typeof v === 'string') urls.push(v);
      walkCollectUrls(v, urls);
    }
  }
  return urls;
}

describe('Grafana dashboards Explore links', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

  it('all dashboards parse as valid JSON', () => {
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8');
      expect(() => JSON.parse(src)).not.toThrow();
    }
  });

  it('Explore URLs use percent-encoded quotes and contain no backslashes', () => {
    for (const f of files) {
      const json = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      const urls = walkCollectUrls(json).filter(
        (u) => typeof u === 'string' && u.startsWith('/explore?left=')
      );
      for (const url of urls) {
        // No raw quotes or backslashes in the URL string
        expect(url).not.toContain('"');
        expect(url).not.toContain('\\');
        // Avoid encoded backslash as well
        expect(/%5c/i.test(url)).toBe(false);

        // Sanity check: left param exists and decodes to array-like content with Loki/expr
        const parsed = new URL(url, 'http://localhost');
        const left = parsed.searchParams.get('left');
        expect(left).toBeTruthy();
        const decoded = decodeURIComponent(left);
        expect(decoded.startsWith('[')).toBe(true);
        expect(decoded.includes('Loki')).toBe(true);
        expect(decoded.includes('expr')).toBe(true);
      }
    }
  });
});
import { describe, it, expect } from '@jest/globals';
import { URL } from 'node:url';
