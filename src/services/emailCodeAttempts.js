const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const attempts = new Map();

export function markFailed(id, now = Date.now()) {
  const entry = attempts.get(id);
  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(id, { count: 1, first: now });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

export function clear(id) {
  attempts.delete(id);
}

export function get(id, now = Date.now()) {
  const entry = attempts.get(id);
  if (!entry) return 0;
  if (now - entry.first > WINDOW_MS) {
    attempts.delete(id);
    return 0;
  }
  return entry.count;
}

export function _reset() {
  attempts.clear();
}

export { WINDOW_MS };
