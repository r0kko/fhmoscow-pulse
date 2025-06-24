export function isValidInn(inn) {
  if (!/^\d{12}$/.test(inn)) return false;
  const digits = inn.split('').map(Number);
  const coeff11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  const coeff12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  const calc = (coefs) =>
    (coefs.reduce((sum, coef, idx) => sum + coef * digits[idx], 0) % 11) % 10;
  return calc(coeff11) === digits[10] && calc(coeff12) === digits[11];
}

export function isValidSnils(value) {
  const digits = value.replace(/\D/g, '');
  if (!/^\d{11}$/.test(digits)) return false;
  const number = digits.slice(0, 9);
  const control = parseInt(digits.slice(9), 10);
  if (parseInt(number, 10) <= 1001998) return true;
  const nums = number.split('').map(Number);
  const sum = nums.reduce((acc, d, idx) => acc + d * (9 - idx), 0);
  let check;
  if (sum < 100) check = sum;
  else if (sum === 100 || sum === 101) check = 0;
  else {
    check = sum % 101;
    if (check === 100) check = 0;
  }
  return check === control;
}
