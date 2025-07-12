import { beforeEach, expect, test } from '@jest/globals';
import { markFailed, get, clear, _reset, WINDOW_MS } from '../src/services/emailCodeAttempts.js';

beforeEach(() => {
  _reset();
});

test('markFailed increments and resets after window', () => {
  const now = Date.now();
  expect(markFailed('u', now)).toBe(1);
  expect(markFailed('u', now + 1000)).toBe(2);
  expect(get('u', now + 1000)).toBe(2);
  expect(markFailed('u', now + WINDOW_MS + 1)).toBe(1);
});

test('clear removes entry', () => {
  const now = Date.now();
  markFailed('u', now);
  clear('u');
  expect(get('u', now)).toBe(0);
});

test('get returns 0 after window', () => {
  const now = Date.now();
  markFailed('u', now);
  expect(get('u', now + WINDOW_MS + 1)).toBe(0);
  expect(get('u', now + WINDOW_MS + 2)).toBe(0);
});
