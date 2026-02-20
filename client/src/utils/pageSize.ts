export function loadPageSize(
  key: string,
  fallback: number,
  allowed?: readonly number[]
): number {
  try {
    const raw = localStorage.getItem(key);
    const parsed = Number.parseInt(raw ?? '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    if (allowed && allowed.length > 0 && !allowed.includes(parsed)) {
      return fallback;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

export function savePageSize(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore quota errors */
  }
}
