import { beforeEach, describe, expect, test } from '@jest/globals';
import { markFailed, clear, get, _reset, WINDOW_MS } from '../src/services/loginAttempts.js';

describe('loginAttempts service', () => {
  beforeEach(() => {
    _reset();
  });

  test('markFailed increments attempts within window', () => {
    expect(markFailed('u1', 0)).toBe(1);
    expect(markFailed('u1', 1000)).toBe(2);
  });

  test('markFailed resets after window passes', () => {
    markFailed('u1', 0);
    expect(markFailed('u1', WINDOW_MS + 1)).toBe(1);
  });

  test('clear removes stored attempts', () => {
    markFailed('u1', 0);
    clear('u1');
    expect(get('u1', 0)).toBe(0);
  });

  test('get returns zero after window expires', () => {
    markFailed('u1', 0);
    expect(get('u1', WINDOW_MS + 1)).toBe(0);
  });
});
