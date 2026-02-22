<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
  type Ref,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';

import Breadcrumbs from '../components/Breadcrumbs.vue';
import TabSelector from '../components/TabSelector.vue';
import MatchesDayTiles from '../components/MatchesDayTiles.vue';
import { MOSCOW_TZ, toDayKey } from '../utils/time';
import CalendarControls from '../components/admin-sports-calendar/CalendarControls.vue';
import CalendarFiltersModal from '../components/admin-sports-calendar/CalendarFiltersModal.vue';
import type {
  CalendarFilterChip,
  CalendarFilterDraft,
  StatusOption,
  StatusFilterScope,
  TimeScope,
} from '../components/admin-sports-calendar/types';
import {
  storeCalendarReturnLocation,
  type CalendarReturnLocation,
  DEFAULT_CALENDAR_PATH,
} from '../utils/adminCalendarNavigation';
import { trackAdminSportsCalendarEvent } from '../utils/adminSportsCalendarTelemetry';
import {
  addUnique,
  removeFrom,
  toSortedUnique,
} from '../composables/useAdminCalendarFilters';
import { useAdminCalendarData } from '../composables/useAdminCalendarData';
import {
  buildQueryFromState,
  CALENDAR_STATE_STORAGE_KEY,
  getDefaultCalendarState,
  parseStateFromQuery,
  queriesMatch,
  readStateFromStorage,
  sanitizePersistedState,
  toMoscowDateInputValue,
  writeStateToStorage,
} from '../composables/useAdminCalendarState';
import type {
  CalendarApiMeta,
  CalendarDayTab,
  CalendarMatch,
  CalendarPersistedState,
} from '../types/adminSportsCalendar';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAY_WINDOW = 14;
const DEFAULT_HORIZON_DAYS = DEFAULT_DAY_WINDOW * 4;
const EMPTY_STATE_SHIFT_DAYS = DEFAULT_DAY_WINDOW;
const SEARCH_DEBOUNCE_MS = 350;
const SEARCH_MAX_LEN_FALLBACK = 80;
const pluralRules = new Intl.PluralRules('ru-RU');

const statusOptions = [
  { value: 'all', label: 'Все матчи', icon: 'bi-collection' },
  {
    value: 'attention',
    label: 'Требуют внимания',
    icon: 'bi-exclamation-triangle',
  },
  {
    value: 'pending',
    label: 'Ожидает согласования',
    icon: 'bi-hourglass-split',
  },
  { value: 'accepted', label: 'Согласовано', icon: 'bi-check2-circle' },
] as const satisfies ReadonlyArray<StatusOption & { value: StatusFilterScope }>;

const breadcrumbItems = Object.freeze([
  { label: 'Администрирование', to: '/admin' },
  { label: 'Управление спортивной частью', disabled: true },
  { label: 'Календарь игр' },
]);

const route = useRoute();
const router = useRouter();
const { loadCalendar, cancelPending } = useAdminCalendarData();

const getNowDateValue = () => toMoscowDateInputValue(new Date(), MOSCOW_TZ);

const timeScope = ref<TimeScope>('upcoming');
const statusScope = ref<StatusFilterScope>('all');
const anchorDate = ref(getNowDateValue());
const matches = ref<CalendarMatch[]>([]);
const loading = ref(false);
const error = ref('');
const activeDayKey = ref<number | null>(null);
const pendingDayKey = ref<number | null>(null);
const search = ref('');
const searchApplied = ref('');
const serverDayTabs = ref<CalendarDayTab[]>([]);
const apiMeta = ref<CalendarApiMeta>({
  attention_days: 7,
  search_max_len: SEARCH_MAX_LEN_FALLBACK,
  direction: 'forward',
});

const selectedHomeClubs = ref<string[]>([]);
const selectedAwayClubs = ref<string[]>([]);
const selectedTournaments = ref<string[]>([]);
const selectedGroups = ref<string[]>([]);
const selectedStadiums = ref<string[]>([]);

const filtersModal = ref<InstanceType<typeof CalendarFiltersModal> | null>(
  null
);
const draft = reactive<CalendarFilterDraft>({
  homeClubs: [],
  awayClubs: [],
  tournaments: [],
  groups: [],
  stadiums: [],
  homeCand: '',
  awayCand: '',
  tournamentCand: '',
  groupCand: '',
  stadiumCand: '',
  statusScope: 'all',
  timeScope: 'upcoming',
  anchorDate: getNowDateValue(),
});

const draftModel = computed<CalendarFilterDraft>({
  get: () => draft,
  set: (value) => {
    Object.assign(draft, value);
  },
});

const calendarQuerySnapshot = computed<Record<string, string | string[]>>(
  () => {
    const query = route.query;
    const snapshot: Record<string, string | string[]> = {};
    Object.entries(query).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        const arr = value.filter(
          (item): item is string => typeof item === 'string'
        );
        if (arr.length) snapshot[key] = arr;
        return;
      }
      if (typeof value === 'string') {
        snapshot[key] = value;
      }
    });
    return snapshot;
  }
);

interface QueryConstraints {
  hasSearch: boolean;
  hasStructuralFilters: boolean;
  hasNonDefaultPeriod: boolean;
  hasNonDefaultAnchor: boolean;
}

const structuralFiltersCount = computed(() => {
  let n = 0;
  n += selectedHomeClubs.value.length;
  n += selectedAwayClubs.value.length;
  n += selectedTournaments.value.length;
  n += selectedGroups.value.length;
  n += selectedStadiums.value.length;
  if (statusScope.value !== 'all') n += 1;
  return n;
});

const effectiveQueryConstraints = computed<QueryConstraints>(() => {
  const today = getNowDateValue();
  return {
    hasSearch: Boolean(searchApplied.value.trim()),
    hasStructuralFilters: structuralFiltersCount.value > 0,
    hasNonDefaultPeriod: timeScope.value !== 'upcoming',
    hasNonDefaultAnchor: Boolean(
      anchorDate.value && anchorDate.value !== today
    ),
  };
});

const activeFiltersCount = computed(() => {
  const c = effectiveQueryConstraints.value;
  let n = structuralFiltersCount.value;
  if (c.hasSearch) n += 1;
  if (c.hasNonDefaultPeriod) n += 1;
  if (c.hasNonDefaultAnchor) n += 1;
  return n;
});

const hasAnyActiveConstraints = computed(() => {
  const c = effectiveQueryConstraints.value;
  return (
    c.hasSearch ||
    c.hasStructuralFilters ||
    c.hasNonDefaultPeriod ||
    c.hasNonDefaultAnchor
  );
});

const filtersSummaryText = computed(() => {
  const count = activeFiltersCount.value;
  if (!count) return 'Параметры не применены';
  const rule = pluralRules.select(count);
  const suffix = rule === 'one' ? 'активен' : 'активны';
  return `${count} ${formatParamsLabel(count)} ${suffix}`;
});

const directionParam = computed<'forward' | 'backward'>(() =>
  timeScope.value === 'past' ? 'backward' : 'forward'
);
const anchorDateIso = computed(() =>
  anchorDate.value ? `${anchorDate.value}T00:00:00Z` : ''
);
const anchorKey = computed(() =>
  anchorDateIso.value ? toDayKey(anchorDateIso.value, MOSCOW_TZ) : null
);

const scopeOptions = [
  { value: 'upcoming', label: 'Предстоящие' },
  { value: 'past', label: 'Прошедшие' },
];
const timeScopeTabs = computed(() =>
  scopeOptions.map((option) => ({ key: option.value, label: option.label }))
);

function isAttentionMatch(match: CalendarMatch): boolean {
  if (!match) return false;
  if (match.agreements_allowed === false) return false;
  if (match.needs_attention === true) return true;
  if (match.urgent_unagreed === true) return true;
  return Boolean(
    match.agreement_pending &&
    !match.agreement_accepted &&
    match.agreements_allowed
  );
}

const matchesAfterStatus = computed<CalendarMatch[]>(() => {
  const scope = statusScope.value;
  const base = matches.value || [];
  if (scope === 'all') return base;
  if (scope === 'accepted')
    return base.filter((match) => match.agreement_accepted);
  if (scope === 'pending')
    return base.filter((match) => match.agreement_pending);
  if (scope === 'attention')
    return base.filter((match) => isAttentionMatch(match));
  return base;
});

interface StatusCounters {
  total: number;
  accepted: number;
  pending: number;
  attention: number;
}

const statusCounters = computed<StatusCounters>(() => {
  const list = matches.value;
  let accepted = 0;
  let pending = 0;
  let attention = 0;
  for (const match of list) {
    if (match.agreement_accepted) accepted += 1;
    if (match.agreement_pending) pending += 1;
    if (isAttentionMatch(match)) attention += 1;
  }
  return {
    total: list.length,
    accepted,
    pending,
    attention,
  };
});

const statusCountMap = computed<Record<StatusFilterScope, number>>(() => {
  const counters = statusCounters.value;
  return {
    all: counters.total,
    attention: counters.attention,
    pending: counters.pending,
    accepted: counters.accepted,
  };
});

function getStatusCount(scope: StatusFilterScope): number {
  return statusCountMap.value?.[scope] ?? 0;
}

interface DayTab {
  key: number;
  label: string;
  subLabel: string;
  badge: number;
}

const dayTabs = computed<DayTab[]>(() => {
  const todayKey = toDayKey(new Date().toISOString(), MOSCOW_TZ);
  const tabsSource =
    statusScope.value === 'all' && serverDayTabs.value.length
      ? serverDayTabs.value.map((item) => ({
          key: item.day_key,
          count: item.count,
          attention: item.attention_count,
        }))
      : (() => {
          const counts = new Map<number, number>();
          const attention = new Map<number, number>();
          matchesAfterStatus.value.forEach((match) => {
            const key = toDayKey(match.date, MOSCOW_TZ);
            if (key == null) return;
            counts.set(key, (counts.get(key) || 0) + 1);
            if (isAttentionMatch(match)) {
              attention.set(key, (attention.get(key) || 0) + 1);
            }
          });
          return [...counts.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([key, count]) => ({
              key,
              count,
              attention: attention.get(key) || 0,
            }));
        })();
  const sliced =
    directionParam.value === 'backward'
      ? tabsSource.slice(-DEFAULT_DAY_WINDOW)
      : tabsSource.slice(0, DEFAULT_DAY_WINDOW);
  return sliced.map((tab) => {
    const offset = todayKey == null ? 0 : (tab.key - todayKey) / DAY_MS;
    const date = new Date(tab.key);
    const { line1, line2 } = formatTabLines(date, offset);
    return {
      key: tab.key,
      label: line1,
      subLabel:
        tab.key === anchorKey.value && line2 !== 'Сегодня'
          ? 'Опорный день'
          : line2,
      badge: tab.attention,
    };
  });
});

let daySelectionPersistPending = false;
const activeDayTabKey = computed<string | number>({
  get: () => (activeDayKey.value ?? '') as string | number,
  set: (value) => {
    daySelectionPersistPending = true;
    if (value === '' || value == null) {
      activeDayKey.value = null;
      pendingDayKey.value = null;
      return;
    }
    const numericValue =
      typeof value === 'number' ? value : Number.parseInt(String(value), 10);
    activeDayKey.value = Number.isNaN(numericValue) ? null : numericValue;
    pendingDayKey.value = null;
  },
});

const filteredDayItems = computed<CalendarMatch[]>(() => {
  const key = activeDayKey.value;
  if (key == null) return [];
  return matchesAfterStatus.value.filter((match) => {
    const dayKey = toDayKey(match.date, MOSCOW_TZ);
    return dayKey != null && dayKey === key;
  });
});

const selectedDayCount = computed<number>(() => filteredDayItems.value.length);
type EmptyReason =
  | 'none'
  | 'no_matches_in_range'
  | 'constrained_empty'
  | 'selected_day_empty';

const emptyReason = computed<EmptyReason>(() => {
  if (loading.value || error.value) return 'none';
  if (!dayTabs.value.length) {
    return hasAnyActiveConstraints.value
      ? 'constrained_empty'
      : 'no_matches_in_range';
  }
  if (!filteredDayItems.value.length) {
    return 'selected_day_empty';
  }
  return 'none';
});

const emptyStateTitle = computed(() => {
  if (emptyReason.value === 'no_matches_in_range') {
    return 'В выбранном диапазоне матчей нет.';
  }
  if (emptyReason.value === 'constrained_empty') {
    return 'По текущим параметрам матчей не найдено.';
  }
  return '';
});

const homeClubOptions = computed<string[]>(() =>
  toSortedUnique(matches.value, (match) => match.home_club)
);
const awayClubOptions = computed<string[]>(() =>
  toSortedUnique(matches.value, (match) => match.away_club)
);
const tournamentOptions = computed<string[]>(() =>
  toSortedUnique(matches.value, (match) => match.tournament)
);
const groupOptions = computed<string[]>(() => {
  const selected = selectedTournaments.value;
  const base = selected.length
    ? matches.value.filter(
        (match) => match.tournament && selected.includes(match.tournament)
      )
    : matches.value;
  return toSortedUnique(base, (match) => match.group);
});
const groupOptionsModal = computed<string[]>(() => {
  const selected = draft.tournaments;
  const base = selected.length
    ? matches.value.filter(
        (match) => match.tournament && selected.includes(match.tournament)
      )
    : matches.value;
  return toSortedUnique(base, (match) => match.group);
});
const stadiumOptions = computed<string[]>(() =>
  toSortedUnique(matches.value, (match) => match.stadium)
);

watch(
  () => groupOptions.value,
  () => {
    const filtered = selectedGroups.value.filter((group) =>
      groupOptions.value.includes(group)
    );
    if (filtered.length !== selectedGroups.value.length) {
      selectedGroups.value = filtered;
    }
  }
);

watch(
  () => [draft.tournaments.slice(), groupOptionsModal.value],
  () => {
    draft.groups = draft.groups.filter((group) =>
      groupOptionsModal.value.includes(group)
    );
  }
);

watch(
  () => draft.tournaments.length,
  (len: number, prevLen: number) => {
    if (prevLen > 0 && len === 0) {
      draft.groups = [];
      draft.groupCand = '';
    }
  }
);

watch(
  () => dayTabs.value.map((tab) => tab.key),
  (keys: number[]) => {
    if (!keys.length) {
      activeDayKey.value = null;
      return;
    }
    const requested = pendingDayKey.value;
    if (requested != null && keys.includes(requested)) {
      activeDayKey.value = requested;
      pendingDayKey.value = null;
      return;
    }
    const currentKey = activeDayKey.value;
    if (currentKey != null && keys.includes(currentKey)) return;
    const anchorCandidate = anchorKey.value;
    if (anchorCandidate != null && keys.includes(anchorCandidate)) {
      activeDayKey.value = anchorCandidate;
      return;
    }
    activeDayKey.value =
      directionParam.value === 'backward'
        ? (keys[keys.length - 1] ?? null)
        : (keys[0] ?? null);
  }
);

let suppressReload = false;
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let requestToken = 0;
let visibilityHandler: (() => void) | null = null;
let skipSearchWatcher = false;

const persistedStateSnapshot = computed<CalendarPersistedState>(() =>
  createStateSnapshot()
);

const loadTriggerKey = computed(() =>
  JSON.stringify({
    direction: directionParam.value,
    anchorDate: anchorDate.value,
    search: searchApplied.value,
    home: selectedHomeClubs.value,
    away: selectedAwayClubs.value,
    tournaments: selectedTournaments.value,
    groups: selectedGroups.value,
    stadiums: selectedStadiums.value,
  })
);

watch(
  persistedStateSnapshot,
  (state) => {
    if (suppressReload) return;
    const safe = sanitizePersistedState(state, getNowDateValue(), (value) =>
      toMoscowDateInputValue(value, MOSCOW_TZ)
    );
    writeStateToStorage(CALENDAR_STATE_STORAGE_KEY, safe);
    const defaults = getDefaultCalendarState(getNowDateValue());
    const query = buildQueryFromState(safe, defaults);
    const location: CalendarReturnLocation = {
      path: DEFAULT_CALENDAR_PATH,
      query,
    };
    if (route.path === DEFAULT_CALENDAR_PATH && route.hash) {
      location.hash = route.hash;
    }
    storeCalendarReturnLocation(location);
  },
  { deep: true, flush: 'post' }
);

watch(
  () => loadTriggerKey.value,
  () => {
    if (suppressReload) return;
    void loadMatches();
  }
);

watch(
  () => activeDayKey.value,
  (value) => {
    if (pendingDayKey.value != null && pendingDayKey.value === value) {
      pendingDayKey.value = null;
    }
    if (!daySelectionPersistPending || suppressReload) return;
    daySelectionPersistPending = false;
    persistCurrentState({ replace: false, updateRoute: true });
    trackAdminSportsCalendarEvent({
      event: 'admin_sports_calendar_day_selected',
      direction: directionParam.value,
      filtersCount: activeFiltersCount.value,
    });
  }
);

async function loadMatches(): Promise<void> {
  const token = ++requestToken;
  loading.value = true;
  error.value = '';
  try {
    const res = await loadCalendar({
      dayWindow: DEFAULT_DAY_WINDOW,
      horizonDays: DEFAULT_HORIZON_DAYS,
      direction: directionParam.value,
      anchorDate: anchorDate.value,
      search: searchApplied.value,
      homeClubs: selectedHomeClubs.value,
      awayClubs: selectedAwayClubs.value,
      tournaments: selectedTournaments.value,
      groups: selectedGroups.value,
      stadiums: selectedStadiums.value,
    });
    if (token !== requestToken) return;
    matches.value = Array.isArray(res.matches) ? res.matches : [];
    serverDayTabs.value = Array.isArray(res.day_tabs) ? res.day_tabs : [];
    apiMeta.value = {
      attention_days: Number(res.meta?.attention_days || 7),
      search_max_len: Number(
        res.meta?.search_max_len || SEARCH_MAX_LEN_FALLBACK
      ),
      direction: res.meta?.direction === 'backward' ? 'backward' : 'forward',
      result_count: Number(res.meta?.result_count ?? matches.value.length),
      requested_anchor:
        typeof res.meta?.requested_anchor === 'string' ||
        res.meta?.requested_anchor === null
          ? res.meta?.requested_anchor
          : null,
      requested_direction:
        res.meta?.requested_direction === 'backward'
          ? 'backward'
          : res.meta?.requested_direction === 'both'
            ? 'both'
            : 'forward',
      requested_count: Number(res.meta?.requested_count ?? DEFAULT_DAY_WINDOW),
      requested_horizon: Number(
        res.meta?.requested_horizon ?? DEFAULT_HORIZON_DAYS
      ),
      constraint_flags: {
        has_search: Boolean(res.meta?.constraint_flags?.has_search),
        has_structural_filters: Boolean(
          res.meta?.constraint_flags?.has_structural_filters
        ),
      },
    };
  } catch (err) {
    if (token !== requestToken) return;
    const message =
      err instanceof Error
        ? err.message
        : 'Не удалось загрузить данные. Попробуйте обновить страницу.';
    error.value = message;
    trackAdminSportsCalendarEvent({
      event: 'admin_sports_calendar_load_failed',
      status: 'error',
      detail: message,
      direction: directionParam.value,
      filtersCount: activeFiltersCount.value,
    });
  } finally {
    if (token === requestToken) {
      loading.value = false;
    }
  }
}

watch(
  () => search.value,
  (query: string) => {
    if (skipSearchWatcher) {
      skipSearchWatcher = false;
      return;
    }
    if (suppressReload) return;
    const maxLen = Number(
      apiMeta.value.search_max_len || SEARCH_MAX_LEN_FALLBACK
    );
    let effectiveQuery = query;
    if (effectiveQuery.length > maxLen) {
      effectiveQuery = effectiveQuery.slice(0, maxLen);
      skipSearchWatcher = true;
      search.value = effectiveQuery;
    }
    if (searchTimer) {
      clearTimeout(searchTimer);
      searchTimer = undefined;
    }
    const trimmed = effectiveQuery.trim();
    if (!trimmed) {
      searchApplied.value = '';
      persistCurrentState({ replace: true, updateRoute: true });
      return;
    }
    searchTimer = setTimeout(() => {
      searchApplied.value = trimmed;
      persistCurrentState({ replace: true, updateRoute: true });
    }, SEARCH_DEBOUNCE_MS);
  }
);

function setDraftFromState(): void {
  draft.homeClubs = [...selectedHomeClubs.value];
  draft.awayClubs = [...selectedAwayClubs.value];
  draft.tournaments = [...selectedTournaments.value];
  draft.groups = [...selectedGroups.value];
  draft.stadiums = [...selectedStadiums.value];
  draft.statusScope = statusScope.value;
  draft.timeScope = timeScope.value;
  draft.anchorDate = anchorDate.value;
  draft.homeCand = '';
  draft.awayCand = '';
  draft.tournamentCand = '';
  draft.groupCand = '';
  draft.stadiumCand = '';
}

function openFilters(): void {
  setDraftFromState();
  filtersModal.value?.show();
}

function applyFilters(): void {
  selectedHomeClubs.value = [...draft.homeClubs];
  selectedAwayClubs.value = [...draft.awayClubs];
  selectedTournaments.value = [...draft.tournaments];
  selectedGroups.value = [...draft.groups];
  selectedStadiums.value = [...draft.stadiums];
  statusScope.value = draft.statusScope;
  timeScope.value = draft.timeScope;
  anchorDate.value = draft.anchorDate || '';
  filtersModal.value?.hide();
  persistCurrentState({ replace: false, updateRoute: true });
  trackAdminSportsCalendarEvent({
    event: 'admin_sports_calendar_filters_applied',
    status: 'success',
    direction: directionParam.value,
    filtersCount: activeFiltersCount.value,
  });
}

function resetDraft(): void {
  draft.homeClubs = [];
  draft.awayClubs = [];
  draft.tournaments = [];
  draft.groups = [];
  draft.stadiums = [];
  draft.homeCand = '';
  draft.awayCand = '';
  draft.tournamentCand = '';
  draft.groupCand = '';
  draft.stadiumCand = '';
  draft.statusScope = 'all';
  draft.timeScope = 'upcoming';
  draft.anchorDate = getNowDateValue();
}

function handleModalReset(): void {
  resetAllFilters();
  filtersModal.value?.hide();
}

function shiftDraftAnchor(offsetDays: number): void {
  const base = draft.anchorDate
    ? new Date(`${draft.anchorDate}T00:00:00Z`)
    : new Date();
  if (Number.isNaN(base.getTime())) return;
  const shifted = new Date(base.getTime() + offsetDays * DAY_MS);
  draft.anchorDate = toMoscowDateInputValue(shifted, MOSCOW_TZ);
}

function resetDraftAnchorToToday(): void {
  draft.anchorDate = getNowDateValue();
}

function submitSearchNow(): void {
  if (suppressReload) return;
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = undefined;
  }
  searchApplied.value = search.value.trim();
  persistCurrentState({ replace: true, updateRoute: true });
}

function clearSearchQuery(): void {
  if (!search.value && !searchApplied.value) return;
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = undefined;
  }
  skipSearchWatcher = true;
  search.value = '';
  searchApplied.value = '';
  persistCurrentState({ replace: true, updateRoute: true });
}

function toggleDraftStatus(scope: StatusFilterScope): void {
  if (scope === 'all') {
    draft.statusScope = 'all';
    return;
  }
  draft.statusScope = draft.statusScope === scope ? 'all' : scope;
}

function resetAllFilters(): void {
  suppressReload = true;
  search.value = '';
  searchApplied.value = '';
  selectedHomeClubs.value = [];
  selectedAwayClubs.value = [];
  selectedTournaments.value = [];
  selectedGroups.value = [];
  selectedStadiums.value = [];
  statusScope.value = 'all';
  timeScope.value = 'upcoming';
  anchorDate.value = getNowDateValue();
  activeDayKey.value = null;
  pendingDayKey.value = null;
  setDraftFromState();
  void nextTick(() => {
    suppressReload = false;
    persistCurrentState({ replace: false, updateRoute: true });
    void loadMatches();
  });
  trackAdminSportsCalendarEvent({
    event: 'admin_sports_calendar_filters_reset',
    status: 'success',
    direction: directionParam.value,
    filtersCount: 0,
  });
}

function removeHeaderChip(chip: CalendarFilterChip): void {
  const remove = (refList: Ref<string[]>) => {
    const arr = refList.value || [];
    const idx = arr.indexOf(chip.value);
    if (idx >= 0) arr.splice(idx, 1);
  };
  switch (chip.type) {
    case 'home':
      remove(selectedHomeClubs);
      break;
    case 'away':
      remove(selectedAwayClubs);
      break;
    case 'tourn':
      remove(selectedTournaments);
      break;
    case 'group':
      remove(selectedGroups);
      break;
    case 'stad':
      remove(selectedStadiums);
      break;
    case 'status':
      statusScope.value = 'all';
      break;
    case 'search':
      search.value = '';
      searchApplied.value = '';
      break;
    case 'period':
      timeScope.value = 'upcoming';
      break;
    case 'anchor':
      anchorDate.value = getNowDateValue();
      break;
    default:
      break;
  }
  persistCurrentState({ replace: false, updateRoute: true });
}

function retryLoad(): void {
  if (suppressReload) return;
  void loadMatches();
}

function addHome(): void {
  addUnique(draft.homeClubs, draft.homeCand);
  draft.homeCand = '';
}

function removeHome(value: string): void {
  removeFrom(draft.homeClubs, value);
}

function addAway(): void {
  addUnique(draft.awayClubs, draft.awayCand);
  draft.awayCand = '';
}

function removeAway(value: string): void {
  removeFrom(draft.awayClubs, value);
}

function addTournament(): void {
  addUnique(draft.tournaments, draft.tournamentCand);
  draft.tournamentCand = '';
}

function removeTournament(value: string): void {
  removeFrom(draft.tournaments, value);
}

function addGroup(): void {
  addUnique(draft.groups, draft.groupCand);
  draft.groupCand = '';
}

function removeGroup(value: string): void {
  removeFrom(draft.groups, value);
}

function addStadium(): void {
  addUnique(draft.stadiums, draft.stadiumCand);
  draft.stadiumCand = '';
}

function removeStadium(value: string): void {
  removeFrom(draft.stadiums, value);
}

const activeFilterChips = computed<CalendarFilterChip[]>(() => {
  const chips: CalendarFilterChip[] = [];
  const pushChip = (
    type: CalendarFilterChip['type'],
    value: string,
    label: string,
    icon?: string
  ) => {
    const chip: CalendarFilterChip = {
      key: `${type}:${value}`,
      type,
      value,
      label,
    };
    if (icon) chip.icon = icon;
    chips.push(chip);
  };
  selectedHomeClubs.value.forEach((value) =>
    pushChip('home', value, `Хозяин: ${value}`, 'bi-house-door')
  );
  selectedAwayClubs.value.forEach((value) =>
    pushChip('away', value, `Гость: ${value}`, 'bi-flag')
  );
  selectedTournaments.value.forEach((value) =>
    pushChip('tourn', value, `Соревнование: ${value}`, 'bi-trophy')
  );
  selectedGroups.value.forEach((value) =>
    pushChip('group', value, `Группа: ${value}`, 'bi-diagram-3')
  );
  selectedStadiums.value.forEach((value) =>
    pushChip('stad', value, `Стадион: ${value}`, 'bi-geo-alt')
  );
  if (effectiveQueryConstraints.value.hasSearch) {
    pushChip(
      'search',
      searchApplied.value.trim(),
      `Поиск: ${searchApplied.value.trim()}`,
      'bi-search'
    );
  }
  if (effectiveQueryConstraints.value.hasNonDefaultPeriod) {
    pushChip(
      'period',
      timeScope.value,
      `Период: ${timeScope.value === 'past' ? 'Прошедшие' : 'Предстоящие'}`,
      'bi-clock-history'
    );
  }
  if (effectiveQueryConstraints.value.hasNonDefaultAnchor) {
    pushChip(
      'anchor',
      anchorDate.value,
      `Опорная дата: ${anchorDate.value}`,
      'bi-calendar-event'
    );
  }
  if (statusScope.value !== 'all') {
    const option = statusOptions.find((opt) => opt.value === statusScope.value);
    pushChip(
      'status',
      statusScope.value,
      `Статус: ${option ? option.label : 'Выбранный'}`,
      option?.icon ?? 'bi-flag'
    );
  }
  return chips;
});

function applyCalendarState(state: CalendarPersistedState): void {
  search.value = state.search || '';
  searchApplied.value = (state.search || '').trim();
  selectedHomeClubs.value = [...state.selectedHomeClubs];
  selectedAwayClubs.value = [...state.selectedAwayClubs];
  selectedTournaments.value = [...state.selectedTournaments];
  selectedGroups.value = [...state.selectedGroups];
  selectedStadiums.value = [...state.selectedStadiums];
  anchorDate.value = state.anchorDate;
  timeScope.value = state.timeScope;
  statusScope.value = state.statusScope;
  activeDayKey.value = state.activeDayKey;
}

function createStateSnapshot(): CalendarPersistedState {
  return {
    anchorDate: anchorDate.value,
    timeScope: timeScope.value,
    statusScope: statusScope.value,
    search: search.value,
    selectedHomeClubs: [...selectedHomeClubs.value],
    selectedAwayClubs: [...selectedAwayClubs.value],
    selectedTournaments: [...selectedTournaments.value],
    selectedGroups: [...selectedGroups.value],
    selectedStadiums: [...selectedStadiums.value],
    activeDayKey: activeDayKey.value,
  };
}

interface PersistOptions {
  replace?: boolean;
  updateRoute?: boolean;
}

function persistCalendarState(
  state: CalendarPersistedState,
  { replace = true, updateRoute = true }: PersistOptions = {}
): void {
  const safeState = sanitizePersistedState(state, getNowDateValue(), (value) =>
    toMoscowDateInputValue(value, MOSCOW_TZ)
  );
  writeStateToStorage(CALENDAR_STATE_STORAGE_KEY, safeState);
  const defaults = getDefaultCalendarState(getNowDateValue());
  const query = buildQueryFromState(safeState, defaults);
  const isCalendarRoute = route.path === DEFAULT_CALENDAR_PATH;
  const location: CalendarReturnLocation = {
    path: DEFAULT_CALENDAR_PATH,
    query,
  };
  if (isCalendarRoute && route.hash) location.hash = route.hash;
  storeCalendarReturnLocation(location);
  if (!updateRoute || !isCalendarRoute) return;
  if (queriesMatch(route.query, query)) return;
  const target = {
    path: DEFAULT_CALENDAR_PATH,
    query,
    hash: route.hash,
  };
  const navigation = replace ? router.replace(target) : router.push(target);
  void navigation.catch(() => {});
}

function persistCurrentState(options?: PersistOptions): void {
  persistCalendarState(createStateSnapshot(), options);
}

function shiftAnchorBy(offsetDays: number): void {
  const base = anchorDate.value
    ? new Date(`${anchorDate.value}T00:00:00Z`)
    : new Date();
  if (Number.isNaN(base.getTime())) return;
  const shifted = new Date(base.getTime() + offsetDays * DAY_MS);
  anchorDate.value = toMoscowDateInputValue(shifted, MOSCOW_TZ);
  persistCurrentState({ replace: false, updateRoute: true });
}

function togglePeriodForEmptyState(): void {
  timeScope.value = timeScope.value === 'past' ? 'upcoming' : 'past';
  persistCurrentState({ replace: false, updateRoute: true });
}

function hydrateCalendarState(): void {
  suppressReload = true;
  const base = getDefaultCalendarState(getNowDateValue());
  const storageState = readStateFromStorage(
    CALENDAR_STATE_STORAGE_KEY,
    (input) =>
      sanitizePersistedState(input, getNowDateValue(), (value) =>
        toMoscowDateInputValue(value, MOSCOW_TZ)
      )
  );
  const queryState = parseStateFromQuery(route.query);
  if (
    queryState &&
    !queryState.anchorDate &&
    typeof queryState.activeDayKey === 'number' &&
    Number.isFinite(queryState.activeDayKey)
  ) {
    queryState.anchorDate = toMoscowDateInputValue(
      new Date(queryState.activeDayKey),
      MOSCOW_TZ
    );
  }
  const resolved = sanitizePersistedState(
    {
      ...base,
      ...(storageState ?? {}),
      ...(queryState ?? {}),
    },
    getNowDateValue(),
    (value) => toMoscowDateInputValue(value, MOSCOW_TZ)
  );
  applyCalendarState(resolved);
  pendingDayKey.value = resolved.activeDayKey;
  setDraftFromState();
  void nextTick(() => {
    suppressReload = false;
    persistCurrentState({ replace: true, updateRoute: true });
    void loadMatches();
  });
}

function formatDaysLabel(value: number): string {
  const rule = pluralRules.select(value);
  const unit = rule === 'one' ? 'день' : rule === 'few' ? 'дня' : 'дней';
  return `${value} ${unit}`;
}

function formatMatchesLabel(value: number): string {
  const rule = pluralRules.select(value);
  if (rule === 'one') return 'матч';
  if (rule === 'few') return 'матча';
  return 'матчей';
}

function formatParamsLabel(value: number): string {
  const rule = pluralRules.select(value);
  if (rule === 'one') return 'параметр';
  if (rule === 'few') return 'параметра';
  return 'параметров';
}

function formatTabLines(
  date: Date,
  offset: number
): { line1: string; line2: string } {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TZ,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
  const weekday = (parts['weekday'] ?? '').replace('.', '');
  const day = parts['day'] ?? '';
  const month = parts['month'] ?? '';
  const ddmm = [day, month].filter(Boolean).join(' ');
  const normalizedOffset = Math.round(offset);
  if (normalizedOffset === 0) return { line1: ddmm, line2: 'Сегодня' };
  if (normalizedOffset === 1) return { line1: ddmm, line2: 'Завтра' };
  if (normalizedOffset === -1) return { line1: ddmm, line2: 'Вчера' };
  if (normalizedOffset === -2) return { line1: ddmm, line2: 'Позавчера' };
  return { line1: ddmm, line2: weekday };
}

onMounted(() => {
  hydrateCalendarState();
  trackAdminSportsCalendarEvent({
    event: 'admin_sports_calendar_opened',
    status: 'success',
  });
  if (typeof document !== 'undefined') {
    visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        void loadMatches();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
  }
});

onUnmounted(() => {
  if (visibilityHandler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = undefined;
  }
  cancelPending();
});
</script>

<template>
  <div class="calendar-page py-3">
    <div class="container">
      <Breadcrumbs class="mb-2" :items="breadcrumbItems" />

      <h1 class="mb-3">Календарь игр</h1>

      <section
        class="card section-card tile fade-in shadow-sm mb-3 controls-card"
      >
        <CalendarControls
          v-model:search="search"
          :active-filters-count="activeFiltersCount"
          :filters-summary-text="filtersSummaryText"
          :chips="activeFilterChips"
          @open-filters="openFilters"
          @remove-chip="removeHeaderChip"
          @reset-filters="resetAllFilters"
          @submit-search="submitSearchNow"
          @clear-search="clearSearchQuery"
        />
      </section>

      <section class="card section-card tile fade-in shadow-sm">
        <div class="card-body calendar-results">
          <div class="results-header">
            <TabSelector
              v-model="activeDayTabKey"
              :tabs="dayTabs"
              v-bind="{ ariaLabel: 'Дни календаря' }"
              :nav-fill="false"
              justify="start"
            />
            <div class="text-muted small">
              Всего: {{ selectedDayCount }}
              {{ formatMatchesLabel(selectedDayCount) }}
            </div>
          </div>

          <div v-if="error" class="alert alert-danger" role="alert">
            <div>{{ error }}</div>
            <button
              type="button"
              class="btn btn-outline-danger btn-sm mt-2"
              @click="retryLoad"
            >
              Повторить
            </button>
          </div>
          <div v-else-if="loading" class="py-2" aria-live="polite">
            <div class="skeleton-line mb-2" style="width: 45%"></div>
            <div class="skeleton-line mb-2" style="width: 88%"></div>
            <div class="skeleton-line mb-2" style="width: 72%"></div>
            <div class="skeleton-line" style="width: 90%"></div>
          </div>
          <template v-else>
            <div
              v-if="
                emptyReason === 'no_matches_in_range' ||
                emptyReason === 'constrained_empty'
              "
              class="alert alert-light border small mb-0"
              role="status"
              aria-live="polite"
            >
              <p class="mb-2">{{ emptyStateTitle }}</p>
              <div class="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  @click="shiftAnchorBy(EMPTY_STATE_SHIFT_DAYS)"
                >
                  Сдвинуть диапазон на +{{ EMPTY_STATE_SHIFT_DAYS }} дней
                </button>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  @click="togglePeriodForEmptyState"
                >
                  Переключить период
                </button>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  @click="openFilters"
                >
                  Открыть фильтры
                </button>
                <button
                  v-if="hasAnyActiveConstraints"
                  type="button"
                  class="btn btn-link btn-sm text-decoration-none"
                  @click="resetAllFilters"
                >
                  Сбросить параметры
                </button>
              </div>
            </div>
            <template v-else>
              <MatchesDayTiles
                :items="filteredDayItems"
                :show-actions="true"
                :show-day-header="false"
                :no-scroll="true"
                :details-base="'/admin/matches'"
                :details-query="calendarQuerySnapshot"
              />
              <p
                v-if="emptyReason === 'selected_day_empty'"
                class="mb-0 text-muted small text-center"
              >
                На выбранный день матчей нет.
              </p>
            </template>
          </template>
        </div>
      </section>
    </div>
  </div>

  <CalendarFiltersModal
    ref="filtersModal"
    v-model:draft="draftModel"
    :status-options="statusOptions"
    :time-scope-tabs="timeScopeTabs"
    :default-day-window="DEFAULT_DAY_WINDOW"
    :format-days-label="formatDaysLabel"
    :home-club-options="homeClubOptions"
    :away-club-options="awayClubOptions"
    :tournament-options="tournamentOptions"
    :group-options-modal="groupOptionsModal"
    :stadium-options="stadiumOptions"
    :get-status-count="getStatusCount"
    @toggle-status="toggleDraftStatus"
    @shift-anchor="shiftDraftAnchor"
    @reset-anchor="resetDraftAnchorToToday"
    @add-home="addHome"
    @remove-home="removeHome"
    @add-away="addAway"
    @remove-away="removeAway"
    @add-tournament="addTournament"
    @remove-tournament="removeTournament"
    @add-group="addGroup"
    @remove-group="removeGroup"
    @add-stadium="addStadium"
    @remove-stadium="removeStadium"
    @reset-filters="handleModalReset"
    @clear-draft="resetDraft"
    @apply="applyFilters"
  />
</template>

<style scoped>
.controls-card {
  --section-padding: 1.25rem;
}

.results-header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

@media (max-width: 1199.98px) {
  .controls-card {
    --section-padding: 1.1rem;
  }
}

@media (max-width: 767.98px) {
  .controls-card {
    --section-padding: 0.875rem;
  }
}
</style>
