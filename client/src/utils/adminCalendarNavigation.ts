export interface CalendarReturnLocation {
  path: string;
  query?: Record<string, string | string[]>;
  hash?: string;
}

const CALENDAR_RETURN_KEY = 'admin-sports-calendar-return-v1';
const DEFAULT_CALENDAR_PATH = '/admin/sports-calendar';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeQuery(
  input: unknown
): Record<string, string | string[]> | undefined {
  if (!isRecord(input)) return undefined;
  const result: Record<string, string | string[]> = {};
  Object.entries(input).forEach(([key, raw]) => {
    if (Array.isArray(raw)) {
      const arr = raw
        .map((item) => (typeof item === 'string' ? item : ''))
        .filter(Boolean);
      if (arr.length) result[key] = arr;
      return;
    }
    if (typeof raw === 'string' && raw.trim()) {
      result[key] = raw;
    }
  });
  return Object.keys(result).length ? result : undefined;
}

function sanitizeLocation(value: unknown): CalendarReturnLocation | null {
  if (!isRecord(value)) return null;
  const rawPath = value['path'];
  const path = typeof rawPath === 'string' ? rawPath : '';
  if (!path) return null;
  const query = sanitizeQuery(value['query']);
  const rawHash = value['hash'];
  const hash =
    typeof rawHash === 'string' && rawHash.startsWith('#') ? rawHash : undefined;
  const location: CalendarReturnLocation = { path };
  if (query) location.query = query;
  if (hash) location.hash = hash;
  return location;
}

function safeSet(
  storage: Storage | undefined | null,
  payload: string
): void {
  try {
    storage?.setItem(CALENDAR_RETURN_KEY, payload);
  } catch {
    /* ignore storage errors */
  }
}

function safeGet(storage: Storage | undefined | null): string | null {
  try {
    return storage?.getItem(CALENDAR_RETURN_KEY) ?? null;
  } catch {
    return null;
  }
}

export function storeCalendarReturnLocation(
  location: CalendarReturnLocation
): void {
  if (typeof window === 'undefined') return;
  const safeLocation = sanitizeLocation(location) ?? { path: DEFAULT_CALENDAR_PATH };
  const payload = JSON.stringify(safeLocation);
  safeSet(window.sessionStorage, payload);
  safeSet(window.localStorage, payload);
}

function readCalendarLocation(): CalendarReturnLocation | null {
  if (typeof window === 'undefined') return null;
  const raw =
    safeGet(window.sessionStorage) ?? safeGet(window.localStorage);
  if (!raw) return null;
  try {
    return sanitizeLocation(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function resolveCalendarReturnLocation(): CalendarReturnLocation {
  return readCalendarLocation() ?? { path: DEFAULT_CALENDAR_PATH };
}
