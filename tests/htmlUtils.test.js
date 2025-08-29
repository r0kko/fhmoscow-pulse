import { describe, expect, test } from '@jest/globals';

import { escapeHtml } from '../src/utils/html.js';

describe('html.escapeHtml', () => {
  test('escapes special characters', () => {
    const s = "<&>\"'";
    expect(escapeHtml(s)).toBe('&lt;&amp;&gt;&quot;&#039;');
  });

  test('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  test('coerces non-strings', () => {
    expect(escapeHtml(123)).toBe('123');
  });
});

