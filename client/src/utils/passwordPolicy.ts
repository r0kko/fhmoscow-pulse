// Lightweight client-side evaluator mirroring server rules
const COMMON_PASSWORDS = new Set(
  [
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
  ].map((password) => password.toLowerCase())
);

const SEQUENCES = [
  'abcdefghijklmnopqrstuvwxyz',
  'qwertyuiopasdfghjklzxcvbnm',
  '0123456789',
];

interface PasswordChecks {
  meetsMin: boolean;
  hasLetter: boolean;
  hasDigit: boolean;
  hasNoWhitespace: boolean;
  notCommon: boolean;
  notRepeating: boolean;
  notSequential: boolean;
  meetsMax: boolean;
}

export interface PasswordEvaluation {
  score: number;
  checks: PasswordChecks;
  ok: boolean;
}

function isSimpleSequence(value: string): boolean {
  if (value.length < 6) return false;
  const lower = value.toLowerCase();
  return SEQUENCES.some((sequence) => {
    const reversed = sequence.split('').reverse().join('');
    return sequence.includes(lower) || reversed.includes(lower);
  });
}

export function evaluatePassword(password: string | null | undefined): PasswordEvaluation {
  const value = String(password ?? '');
  const lower = value.toLowerCase();
  const hasLetter = /[A-Za-z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasSpecial = /[^A-Za-z0-9]/.test(value);
  const hasWhitespace = /\s/.test(value);
  const meetsMin = value.length >= 8;
  const meetsMax = value.length <= 128;
  const allSame = /^(.)(\1)+$/.test(value);
  const sequential = isSimpleSequence(value);
  const common = COMMON_PASSWORDS.has(lower);

  let score = 0;
  if (meetsMin) score++;
  if (hasLetter) score++;
  if (hasDigit) score++;
  if (hasUpper) score++;
  if (hasSpecial || value.length >= 12) score++;
  if (hasWhitespace || allSame || sequential || common) {
    score = Math.max(0, score - 2);
  }
  score = Math.min(5, Math.max(0, score));

  const checks: PasswordChecks = {
    meetsMin,
    hasLetter,
    hasDigit,
    hasNoWhitespace: !hasWhitespace,
    notCommon: !common,
    notRepeating: !allSame,
    notSequential: !sequential,
    meetsMax,
  };

  const ok = Object.values(checks).every(Boolean);

  return { score, checks, ok };
}

export default { evaluatePassword };
