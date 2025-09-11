// Small, side-effect free helpers used across services and tests.
// Kept generic and 100% covered to improve overall reliability.

export function coalesce(value, fallback) {
  return value == null ? fallback : value;
}

export function tryParseInt(value, def = null) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? def : n;
}

export function ensureArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

export function isEmpty(v) {
  if (v == null) return true;
  if (typeof v === 'string') return v.length === 0;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

export function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return Number(min);
  return Math.min(Math.max(x, Number(min)), Number(max));
}

export function pick(obj, keys) {
  const out = {};
  for (const k of keys || [])
    if (Object.prototype.hasOwnProperty.call(obj || {}, k)) out[k] = obj[k];
  return out;
}

export function uniq(arr) {
  return Array.from(new Set(arr || []));
}

export default {
  coalesce,
  tryParseInt,
  ensureArray,
  isEmpty,
  clamp,
  pick,
  uniq,
};
