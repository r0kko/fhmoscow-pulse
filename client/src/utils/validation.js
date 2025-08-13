import { fromDateTimeLocal } from './time.js';

export function required(value) {
  return !(value === undefined || value === null || value === '');
}

export function nonNegativeNumber(value) {
  if (value === '' || value === null || value === undefined) return true;
  const n = Number(value);
  return !Number.isNaN(n) && n >= 0;
}

export function endAfterStart(startLocal, endLocal) {
  if (!required(startLocal) || !required(endLocal)) return true;
  const startISO = fromDateTimeLocal(startLocal);
  const endISO = fromDateTimeLocal(endLocal);
  return new Date(endISO) > new Date(startISO);
}

export function validateDateRange(startLocal, endLocal) {
  if (!required(startLocal)) return 'start_required';
  if (!required(endLocal)) return 'end_required';
  if (!endAfterStart(startLocal, endLocal)) return 'order_invalid';
  return null;
}
