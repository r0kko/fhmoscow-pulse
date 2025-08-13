export function loadPageSize(key, def) {
  try {
    const v = localStorage.getItem(key);
    const n = parseInt(v ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : def;
  } catch (_) {
    return def;
  }
}

export function savePageSize(key, val) {
  try {
    localStorage.setItem(key, String(val));
  } catch (_) {}
}
