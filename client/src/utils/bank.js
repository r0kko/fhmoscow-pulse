export function isValidAccountNumber(number, bic) {
  if (!/^\d{20}$/.test(number) || !/^\d{9}$/.test(bic)) return false;
  const coeff = [
    7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1,
  ];
  const digits = (bic.slice(-3) + number).split('').map(Number);
  const sum = digits.reduce((acc, d, idx) => acc + ((d * coeff[idx]) % 10), 0);
  return sum % 10 === 0;
}
