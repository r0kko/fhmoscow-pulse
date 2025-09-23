export function loadPageSize(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    const parsed = Number.parseInt(raw ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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
