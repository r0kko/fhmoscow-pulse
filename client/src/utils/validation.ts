import { fromDateTimeLocal } from './time';

export function required<T>(value: T | null | undefined): boolean {
  return !(value === undefined || value === null || value === '');
}

export function nonNegativeNumber(value: unknown): boolean {
  if (value === '' || value === null || value === undefined) return true;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0;
}

export function endAfterStart(startLocal: string, endLocal: string): boolean {
  if (!required(startLocal) || !required(endLocal)) return true;
  const startISO = fromDateTimeLocal(startLocal);
  const endISO = fromDateTimeLocal(endLocal);
  return new Date(endISO).getTime() > new Date(startISO).getTime();
}

export function validateDateRange(
  startLocal: string,
  endLocal: string
): 'start_required' | 'end_required' | 'order_invalid' | null {
  if (!required(startLocal)) return 'start_required';
  if (!required(endLocal)) return 'end_required';
  if (!endAfterStart(startLocal, endLocal)) return 'order_invalid';
  return null;
}
