const INN_COEFF_11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8] as const;
const INN_COEFF_12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8] as const;

function calculateInnChecksum(
  digits: number[],
  coefficients: readonly number[]
): number {
  const sum = coefficients.reduce((acc, coef, index) => {
    const digit = digits[index] ?? 0;
    return acc + coef * digit;
  }, 0);
  return (sum % 11) % 10;
}

export function isValidInn(inn: string): boolean {
  if (!/^\d{12}$/.test(inn)) return false;
  const digits = inn.split('').map((char) => Number(char));
  return (
    calculateInnChecksum(digits, INN_COEFF_11) === digits[10]! &&
    calculateInnChecksum(digits, INN_COEFF_12) === digits[11]!
  );
}

export function isValidSnils(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (!/^\d{11}$/.test(digits)) return false;
  const numberPart = digits.slice(0, 9);
  const control = Number.parseInt(digits.slice(9), 10);
  if (Number.parseInt(numberPart, 10) <= 1001998) return true;
  const numbers = numberPart.split('').map((char) => Number(char));
  const sum = numbers.reduce(
    (acc, digit, index) => acc + digit * (9 - index),
    0
  );
  let check: number;
  if (sum < 100) check = sum;
  else if (sum === 100 || sum === 101) check = 0;
  else {
    check = sum % 101;
    if (check === 100) check = 0;
  }
  return check === control;
}

export function formatSnils(digits: string): string {
  let output = '';
  if (digits.length > 0) output += digits.slice(0, 3);
  if (digits.length >= 3) output += `-${digits.slice(3, 6)}`;
  if (digits.length >= 6) output += `-${digits.slice(6, 9)}`;
  if (digits.length >= 9) output += ` ${digits.slice(9, 11)}`;
  return output;
}

const RUSSIAN_COUNTRY_CODE = '7';

export function normalizeRussianPhone(
  input: string | null | undefined
): string {
  let digits = (input ?? '').replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('8') && digits.length >= 11) {
    digits = digits.slice(1);
  }

  if (digits.startsWith(RUSSIAN_COUNTRY_CODE)) {
    return digits.slice(0, 11);
  }

  const local = digits.slice(-10);
  return `${RUSSIAN_COUNTRY_CODE}${local}`.slice(0, 11);
}

export function formatRussianPhone(input: string | null | undefined): string {
  const digits = normalizeRussianPhone(input);
  if (!digits) return '';
  let output = '+7';
  if (digits.length > 1) output += ` (${digits.slice(1, 4)}`;
  if (digits.length >= 4) output += ') ';
  if (digits.length >= 4) output += digits.slice(4, 7);
  if (digits.length >= 7) output += `-${digits.slice(7, 9)}`;
  if (digits.length >= 9) output += `-${digits.slice(9, 11)}`;
  return output;
}
