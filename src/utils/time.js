/**
 * Timezone helpers for Europe/Moscow (+03:00) vs UTC.
 *
 * We assume Moscow time is permanently UTC+3 (no DST since 2014).
 * These helpers are deliberately simple and avoid external deps.
 */

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000; // +03:00

/**
 * Convert an external Moscow-time Date to UTC Date for storage.
 * @param {Date|string|number|null} d
 * @returns {Date|null}
 */
export function moscowToUtc(d) {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() - MSK_OFFSET_MS);
}

/**
 * Convert a UTC Date to Moscow-time Date (useful for external comparisons).
 * @param {Date|string|number|null} d
 * @returns {Date|null}
 */
export function utcToMoscow(d) {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + MSK_OFFSET_MS);
}

/**
 * Format seconds as M:SS string (e.g., 75 -> "1:15").
 * Non-finite inputs return empty string.
 * @param {number} seconds
 * @returns {string}
 */
export function formatMinutesSeconds(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n)) return '';
  const total = Math.round(n);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default { moscowToUtc, utcToMoscow };
