const CHECKSUM_COEFFICIENTS = [
  7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1,
] as const;

export function isValidAccountNumber(account: string, bic: string): boolean {
  if (!/^\d{20}$/.test(account) || !/^\d{9}$/.test(bic)) return false;
  const digits = (bic.slice(-3) + account)
    .split('')
    .map((char) => Number(char));
  const sum = digits.reduce((acc, digit, index) => {
    const coefficient =
      CHECKSUM_COEFFICIENTS[index % CHECKSUM_COEFFICIENTS.length]!;
    return acc + ((digit * coefficient) % 10);
  }, 0);
  return sum % 10 === 0;
}
