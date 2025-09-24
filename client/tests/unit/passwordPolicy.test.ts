import { describe, expect, it } from 'vitest';
import { evaluatePassword } from '@/utils/passwordPolicy';

describe('passwordPolicy.evaluatePassword', () => {
  it('flags weak common passwords', () => {
    const r = evaluatePassword('password');
    expect(r.ok).toBe(false);
    expect(r.checks.notCommon).toBe(false);
  });

  it('accepts a strong password', () => {
    const r = evaluatePassword('Sup3r$trongPassw0rd');
    expect(r.ok).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(4);
  });

  it('rejects short password and whitespace', () => {
    const r1 = evaluatePassword('a1 b');
    expect(r1.checks.meetsMin).toBe(false);
    expect(r1.checks.hasNoWhitespace).toBe(false);
    expect(r1.ok).toBe(false);
  });

  it('rewards long passwords even without extra symbols', () => {
    const r = evaluatePassword('Abcdefghijk1');
    expect(r.checks.meetsMax).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(4);
  });

  it('handles nullish input gracefully', () => {
    const r = evaluatePassword(null);
    expect(r.ok).toBe(false);
    expect(r.score).toBe(0);
  });
});
