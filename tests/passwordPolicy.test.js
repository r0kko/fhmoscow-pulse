import { describe, expect, test } from '@jest/globals';

// eslint-disable-next-line no-undef
process.env.PASSWORD_MIN_LENGTH = '8';
// eslint-disable-next-line no-undef
process.env.PASSWORD_MAX_LENGTH = '64';
// require at least one letter and one digit
// eslint-disable-next-line no-undef
process.env.PASSWORD_PATTERN = '(?=.*[A-Za-z])(?=.*\\d)';

const { validatePassword, assertPassword } = await import('../src/utils/passwordPolicy.js');

describe('passwordPolicy', () => {
  test('rejects common/weak passwords', () => {
    expect(validatePassword('password')).toBe(false);
    expect(validatePassword('123456')).toBe(false);
    expect(() => assertPassword('qwerty')).toThrow('weak_password');
  });

    test('rejects too short or missing digit/letter', () => {
      expect(validatePassword('a1b2c')).toBe(false);
      expect(validatePassword('abcdefgh')).toBe(false);
      expect(validatePassword('12345678')).toBe(false);
    });

    test('rejects overly long password', () => {
      const longPwd = 'Ab1' + 'a'.repeat(100);
      expect(validatePassword(longPwd)).toBe(false);
    });

  test('accepts strong password', () => {
    expect(validatePassword('Abcdef12')).toBe(true);
    expect(() => assertPassword('Abcdef12')).not.toThrow();
  });
});

