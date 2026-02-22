import type { LocationQuery, LocationQueryValue } from 'vue-router';

import type {
  CalendarPersistedState,
  StatusFilterScope,
  TimeScope,
} from '../types/adminSportsCalendar';

export const CALENDAR_STATE_VERSION = 3;
export const CALENDAR_STATE_STORAGE_KEY = `admin-sports-calendar-state-v${CALENDAR_STATE_VERSION}`;

export const QUERY_KEYS = {
  anchor: 'anchor',
  timeScope: 'time',
  statusScope: 'status',
  search: 'q',
  activeDayKey: 'day',
  home: 'home',
  away: 'away',
  tournament: 'tournament',
  group: 'group',
  stadium: 'stadium',
} as const;

type QueryLike = Record<string, string | string[] | null | undefined>;

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function toMoscowDateInputValue(
  value: string | Date | null | undefined,
  timeZone: string
): string {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
  const year = parts['year'] ?? '';
  const month = parts['month'] ?? '';
  const day = parts['day'] ?? '';
  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
}

export function getDefaultCalendarState(
  nowDateValue: string
): CalendarPersistedState {
  return {
    anchorDate: nowDateValue,
    timeScope: 'upcoming',
    statusScope: 'all',
    search: '',
    selectedHomeClubs: [],
    selectedAwayClubs: [],
    selectedTournaments: [],
    selectedGroups: [],
    selectedStadiums: [],
    activeDayKey: null,
  };
}

function normalizePersistedList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  value.forEach((item) => {
    const normalized = (item ?? '').toString().trim();
    if (normalized) seen.add(normalized);
  });
  return Array.from(seen);
}

export function sanitizePersistedState(
  input: Partial<CalendarPersistedState> | null | undefined,
  nowDateValue: string,
  toDateValue: (value: string | Date | null | undefined) => string
): CalendarPersistedState {
  const fallback = getDefaultCalendarState(nowDateValue);
  const candidate = (input ?? {}) as Record<string, unknown>;
  const anchorProvided = hasOwn(candidate, 'anchorDate');
  const rawAnchor = anchorProvided
    ? (candidate['anchorDate'] ?? '').toString().trim()
    : undefined;
  let anchorDate = fallback.anchorDate;
  if (anchorProvided) {
    if (!rawAnchor) {
      anchorDate = '';
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawAnchor)) {
      anchorDate = rawAnchor;
    } else {
      anchorDate = toDateValue(rawAnchor) || fallback.anchorDate;
    }
  }
  const normalizeSearch = (): string => {
    if (!hasOwn(candidate, 'search')) return fallback.search;
    return (candidate['search'] ?? '').toString().slice(0, 80);
  };
  const normalizeTimeScope = (): TimeScope =>
    candidate['timeScope'] === 'past' ? 'past' : 'upcoming';
  const allowedStatuses: StatusFilterScope[] = [
    'all',
    'attention',
    'pending',
    'accepted',
  ];
  const normalizeStatusScope = (): StatusFilterScope => {
    const raw = candidate['statusScope'];
    return allowedStatuses.includes(raw as StatusFilterScope)
      ? (raw as StatusFilterScope)
      : 'all';
  };
  const normalizeActiveDay = (): number | null => {
    if (!hasOwn(candidate, 'activeDayKey')) return fallback.activeDayKey;
    const raw = Number(candidate['activeDayKey']);
    return Number.isFinite(raw) ? raw : null;
  };
  return {
    anchorDate,
    timeScope: normalizeTimeScope(),
    statusScope: normalizeStatusScope(),
    search: normalizeSearch(),
    selectedHomeClubs: normalizePersistedList(candidate['selectedHomeClubs']),
    selectedAwayClubs: normalizePersistedList(candidate['selectedAwayClubs']),
    selectedTournaments: normalizePersistedList(
      candidate['selectedTournaments']
    ),
    selectedGroups: normalizePersistedList(candidate['selectedGroups']),
    selectedStadiums: normalizePersistedList(candidate['selectedStadiums']),
    activeDayKey: normalizeActiveDay(),
  };
}

export function readStateFromStorage(
  key: string,
  sanitize: (
    input: Partial<CalendarPersistedState> | null | undefined
  ) => CalendarPersistedState
): CalendarPersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage?.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CalendarPersistedState>;
    return sanitize(parsed);
  } catch {
    return null;
  }
}

export function writeStateToStorage(
  key: string,
  state: CalendarPersistedState
): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage?.setItem(key, JSON.stringify(state));
  } catch {
    /* ignore storage errors */
  }
}

function normalizeQueryValue(
  value: LocationQueryValue | LocationQueryValue[] | undefined
): LocationQueryValue | undefined {
  if (Array.isArray(value)) return value.at(-1);
  return value;
}

function queryValueToString(
  value: LocationQueryValue | LocationQueryValue[] | undefined
): string | undefined {
  const normalized = normalizeQueryValue(value);
  if (typeof normalized === 'string') return normalized;
  if (normalized === null) return '';
  return undefined;
}

function queryValueToNumber(
  value: LocationQueryValue | LocationQueryValue[] | undefined
): number | undefined {
  const raw = queryValueToString(value);
  if (raw == null || !raw.trim()) return undefined;
  const num = Number.parseInt(raw, 10);
  return Number.isFinite(num) ? num : undefined;
}

function queryValueToArray(
  value: LocationQueryValue | LocationQueryValue[] | undefined
): string[] {
  const values = Array.isArray(value) ? value : [normalizeQueryValue(value)];
  return values
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => Boolean(item));
}

export function parseStateFromQuery(
  query: LocationQuery
): Partial<CalendarPersistedState> | null {
  const anchor = queryValueToString(query[QUERY_KEYS.anchor]);
  const timeScopeParam = queryValueToString(query[QUERY_KEYS.timeScope]);
  const statusScopeParam = queryValueToString(query[QUERY_KEYS.statusScope]);
  const searchParam = queryValueToString(query[QUERY_KEYS.search]);
  const activeDayParam = queryValueToNumber(query[QUERY_KEYS.activeDayKey]);
  const home = queryValueToArray(query[QUERY_KEYS.home]);
  const away = queryValueToArray(query[QUERY_KEYS.away]);
  const tournaments = queryValueToArray(query[QUERY_KEYS.tournament]);
  const groups = queryValueToArray(query[QUERY_KEYS.group]);
  const stadiums = queryValueToArray(query[QUERY_KEYS.stadium]);
  const hasAny =
    anchor !== undefined ||
    timeScopeParam !== undefined ||
    statusScopeParam !== undefined ||
    searchParam !== undefined ||
    activeDayParam !== undefined ||
    home.length > 0 ||
    away.length > 0 ||
    tournaments.length > 0 ||
    groups.length > 0 ||
    stadiums.length > 0;
  if (!hasAny) return null;
  const partial: Partial<CalendarPersistedState> = {};
  if (anchor !== undefined) partial.anchorDate = anchor;
  if (timeScopeParam !== undefined)
    partial.timeScope = timeScopeParam as TimeScope;
  if (statusScopeParam !== undefined)
    partial.statusScope = statusScopeParam as StatusFilterScope;
  if (searchParam !== undefined) partial.search = searchParam;
  if (activeDayParam !== undefined) partial.activeDayKey = activeDayParam;
  if (home.length) partial.selectedHomeClubs = home;
  if (away.length) partial.selectedAwayClubs = away;
  if (tournaments.length) partial.selectedTournaments = tournaments;
  if (groups.length) partial.selectedGroups = groups;
  if (stadiums.length) partial.selectedStadiums = stadiums;
  return partial;
}

export function buildQueryFromState(
  state: CalendarPersistedState,
  defaults: CalendarPersistedState
): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  if (state.anchorDate && state.anchorDate !== defaults.anchorDate) {
    query[QUERY_KEYS.anchor] = state.anchorDate;
  }
  if (state.timeScope !== defaults.timeScope) {
    query[QUERY_KEYS.timeScope] = state.timeScope;
  }
  if (state.statusScope !== defaults.statusScope) {
    query[QUERY_KEYS.statusScope] = state.statusScope;
  }
  const trimmedSearch = state.search.trim();
  if (trimmedSearch) {
    query[QUERY_KEYS.search] = trimmedSearch;
  }
  if (state.activeDayKey != null) {
    query[QUERY_KEYS.activeDayKey] = String(state.activeDayKey);
  }
  if (state.selectedHomeClubs.length) {
    query[QUERY_KEYS.home] = [...state.selectedHomeClubs];
  }
  if (state.selectedAwayClubs.length) {
    query[QUERY_KEYS.away] = [...state.selectedAwayClubs];
  }
  if (state.selectedTournaments.length) {
    query[QUERY_KEYS.tournament] = [...state.selectedTournaments];
  }
  if (state.selectedGroups.length) {
    query[QUERY_KEYS.group] = [...state.selectedGroups];
  }
  if (state.selectedStadiums.length) {
    query[QUERY_KEYS.stadium] = [...state.selectedStadiums];
  }
  return query;
}

function queryEntries(source: QueryLike): string[] {
  const entries: string[] = [];
  Object.entries(source).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item === undefined) return;
        entries.push(`${key}=${item ?? ''}`);
      });
    } else if (value !== undefined) {
      entries.push(`${key}=${value ?? ''}`);
    }
  });
  return entries.sort();
}

export function queriesMatch(
  current: LocationQuery,
  next: Record<string, string | string[] | undefined>
): boolean {
  const currentEntries = queryEntries(current as QueryLike);
  const nextEntries = queryEntries(next as QueryLike);
  if (currentEntries.length !== nextEntries.length) return false;
  return currentEntries.every((entry, index) => entry === nextEntries[index]);
}
