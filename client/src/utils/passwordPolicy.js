// Lightweight client-side evaluator mirroring server rules
export function evaluatePassword(password) {
  const val = String(password || '');
  const lower = val.toLowerCase();
  const hasLetter = /[A-Za-z]/.test(val);
  const hasDigit = /\d/.test(val);
  const hasUpper = /[A-Z]/.test(val);
  const hasSpecial = /[^A-Za-z0-9]/.test(val);
  const hasWhitespace = /\s/.test(val);
  const meetsMin = val.length >= 8;
  const meetsMax = val.length <= 128;
  const common = new Set([
    'password',
    'passw0rd',
    '123456',
    '12345678',
    '123456789',
    '111111',
    '000000',
    'qwerty',
    'qwerty123',
    'qwertyuiop',
    '1q2w3e4r',
    'abc123',
    'letmein',
    'welcome',
    'monkey',
    'dragon',
    'iloveyou',
    'admin',
  ]);
  const allSame = /^(.)(\1)+$/.test(val);
  const isSimpleSequence = (() => {
    if (val.length < 6) return false;
    const seqs = [
      'abcdefghijklmnopqrstuvwxyz',
      'qwertyuiopasdfghjklzxcvbnm',
      '0123456789',
    ];
    for (const base of seqs) {
      if (
        base.includes(lower) ||
        base.split('').reverse().join('').includes(lower)
      )
        return true;
    }
    return false;
  })();

  // Score out of 5 similar to existing meter, with penalties
  let score = 0;
  if (meetsMin) score++;
  if (hasLetter) score++;
  if (hasDigit) score++;
  if (hasUpper) score++;
  if (hasSpecial || val.length >= 12) score++;
  if (hasWhitespace || allSame || isSimpleSequence || common.has(lower))
    score = Math.max(0, score - 2);
  score = Math.min(5, Math.max(0, score));

  const checks = {
    meetsMin,
    hasLetter,
    hasDigit,
    hasNoWhitespace: !hasWhitespace,
    notCommon: !common.has(lower),
    notRepeating: !allSame,
    notSequential: !isSimpleSequence,
    meetsMax,
  };
  const ok =
    checks.meetsMin &&
    checks.hasLetter &&
    checks.hasDigit &&
    checks.hasNoWhitespace &&
    checks.notCommon &&
    checks.notRepeating &&
    checks.notSequential &&
    checks.meetsMax;

  return { score, checks, ok };
}

export default { evaluatePassword };
