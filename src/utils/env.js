// Helpers for consistently parsing environment variables.
// Keep conversions small to avoid implicit coercion bugs.

function normalize(value) {
  if (value == null) return undefined;
  return String(value).trim();
}

export function readBool(value, defaultValue = false) {
  const normalized = normalize(value);
  if (normalized === undefined || normalized === '') return defaultValue;
  const lower = normalized.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(lower)) return true;
  if (['0', 'false', 'no', 'off'].includes(lower)) return false;
  return defaultValue;
}

export function readNumber(value, defaultValue) {
  const normalized = normalize(value);
  if (normalized === undefined || normalized === '') return defaultValue;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : defaultValue;
}

export function readString(value, defaultValue) {
  const normalized = normalize(value);
  if (normalized === undefined || normalized === '') return defaultValue;
  return normalized;
}

export default {
  readBool,
  readNumber,
  readString,
};
