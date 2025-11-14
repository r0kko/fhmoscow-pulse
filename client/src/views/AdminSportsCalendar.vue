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
import {
  RouterLink,
  useRoute,
  useRouter,
  type LocationQuery,
  type LocationQueryValue,
} from 'vue-router';
import { apiFetch } from '../api';
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
} from '../utils/adminCalendarNavigation';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAY_WINDOW = 14;
const SEARCH_DEBOUNCE_MS = 1300;
const SEARCH_PERSIST_GRACE_MS = 1500;
const pluralRules = new Intl.PluralRules('ru-RU');

interface CalendarMatch {
  id: number;
  date: string;
  team1: string;
  team2: string;
  home_club?: string | null;
  away_club?: string | null;
  stadium?: string | null;
  tournament?: string | null;
  group?: string | null;
  tour?: string | number | null;
  urgent_unagreed?: boolean;
  agreement_accepted?: boolean;
  agreement_pending?: boolean;
  status?: { alias?: string | null; name?: string | null } | null;
  technical_winner?: string | null;
  score_team1?: number | null;
  score_team2?: number | null;
  is_home?: boolean;
  is_away?: boolean;
  is_both_teams?: boolean;
}

interface CalendarRange {
  start: string;
  end_exclusive: string;
}

interface CalendarApiResponse {
  matches?: CalendarMatch[];
  range?: CalendarRange | null;
}

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

type MatchesSearchPredicate = (match: CalendarMatch) => boolean;

const dayWindow = ref<number>(DEFAULT_DAY_WINDOW);
const timeScope = ref<TimeScope>('upcoming');
const statusScope = ref<StatusFilterScope>('all');
const anchorDate = ref(toMoscowDateInputValue(new Date()));
const matches = ref<CalendarMatch[]>([]);
const range = ref<CalendarRange | null>(null);
const loading = ref(false);
const error = ref('');
const activeDayKey = ref<number | null>(null);
const pendingDayKey = ref<number | null>(null);
const search = ref('');

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
  dayWindow: DEFAULT_DAY_WINDOW,
  anchorDate: toMoscowDateInputValue(new Date()),
});

const draftModel = computed<CalendarFilterDraft>({
  get: () => draft,
  set: (value) => {
    Object.assign(draft, value);
  },
});

const route = useRoute();
const router = useRouter();
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

interface CalendarPersistedState {
  anchorDate: string;
  dayWindow: number;
  timeScope: TimeScope;
  statusScope: StatusFilterScope;
  search: string;
  selectedHomeClubs: string[];
  selectedAwayClubs: string[];
  selectedTournaments: string[];
  selectedGroups: string[];
  selectedStadiums: string[];
  activeDayKey: number | null;
}

const CALENDAR_STATE_VERSION = 1;
const CALENDAR_STATE_STORAGE_KEY = `admin-sports-calendar-state-v${CALENDAR_STATE_VERSION}`;
const QUERY_KEYS = {
  anchor: 'anchor',
  dayWindow: 'window',
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

const activeFiltersCount = computed(() => {
  let n = 0;
  n += selectedHomeClubs.value.length;
  n += selectedAwayClubs.value.length;
  n += selectedTournaments.value.length;
  n += selectedGroups.value.length;
  n += selectedStadiums.value.length;
  if (statusScope.value !== 'all') n += 1;
  return n;
});

const filtersSummaryText = computed(() => {
  const count = activeFiltersCount.value;
  if (!count) return 'Фильтры не применены';
  const rule = pluralRules.select(count);
  const suffix = rule === 'one' ? 'активен' : 'активны';
  return `${count} ${formatFiltersLabel(count)} ${suffix}`;
});

const directionParam = computed(() =>
  timeScope.value === 'past' ? 'backward' : 'forward'
);
const horizonDays = computed(() => Math.max(dayWindow.value * 4, 45));
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

const searchMatcher = computed<MatchesSearchPredicate | null>(() =>
  buildSearchMatcher(search.value)
);
const matchesAfterSearch = computed<CalendarMatch[]>(() => {
  const matcher = searchMatcher.value;
  const list = matches.value || [];
  return matcher ? list.filter(matcher) : list;
});

function isAttentionMatch(match: CalendarMatch): boolean {
  if (!match) return false;
  if (match.urgent_unagreed) return true;
  const alias = (match.status?.alias || '').toUpperCase();
  const schedulable = !['CANCELLED', 'FINISHED', 'LIVE'].includes(alias);
  const agreed = Boolean(match.agreement_accepted);
  const pending = Boolean(match.agreement_pending);
  const diffMs = new Date(match.date || '').getTime() - Date.now();
  const soon = Number.isFinite(diffMs) && diffMs >= 0 && diffMs < 10 * DAY_MS;
  return schedulable && !agreed && (pending || soon);
}

const matchesAfterStatus = computed<CalendarMatch[]>(() => {
  const scope = statusScope.value;
  const base = matchesAfterSearch.value;
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
  const list = matchesAfterSearch.value;
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
  const map = statusCountMap.value;
  return map?.[scope] ?? 0;
}

interface DayTab {
  key: number;
  label: string;
  subLabel: string;
  badge: number;
}

const dayTabs = computed<DayTab[]>(() => {
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
  const keysSorted = [...counts.keys()].sort((a, b) => a - b);
  const windowSize = dayWindow.value;
  const keys =
    directionParam.value === 'backward'
      ? keysSorted.slice(-windowSize)
      : keysSorted.slice(0, windowSize);
  const todayKey = toDayKey(new Date().toISOString(), MOSCOW_TZ);
  return keys.map((key) => {
    const offset = todayKey == null ? 0 : (key - todayKey) / DAY_MS;
    const date = new Date(key);
    const badge = attention.get(key) || 0;
    const { line1, line2 } = formatTabLines(date, offset);
    return {
      key,
      label: line1,
      subLabel:
        key === anchorKey.value && line2 !== 'Сегодня' ? 'Опорный день' : line2,
      badge,
    } satisfies DayTab;
  });
});

const activeDayTabKey = computed<string | number>({
  get: () => (activeDayKey.value ?? '') as string | number,
  set: (value) => {
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
  () => draft.homeClubs.length,
  (len: number, prevLen: number) => {
    if (prevLen > 0 && len === 0) {
      draft.awayClubs = [];
      draft.awayCand = '';
    }
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
    if (directionParam.value === 'backward') {
      activeDayKey.value = keys[keys.length - 1] ?? null;
    } else {
      activeDayKey.value = keys[0] ?? null;
    }
  }
);

watch(
  () => activeDayKey.value,
  (value) => {
    if (pendingDayKey.value != null && pendingDayKey.value === value) {
      pendingDayKey.value = null;
    }
  }
);

let suppressReload = false;
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let requestToken = 0;
let visibilityHandler: (() => void) | null = null;
let skipSearchWatcher = false;
let persistencePaused = false;
let persistenceResumeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPersistenceState: CalendarPersistedState | null = null;

const persistedStateSnapshot = computed<CalendarPersistedState>(() =>
  createStateSnapshot()
);

function queuePersistence(state: CalendarPersistedState): void {
  if (persistencePaused) {
    pendingPersistenceState = state;
    return;
  }
  pendingPersistenceState = null;
  persistCalendarState(state);
}

function pausePersistenceTemporarily(
  delay: number = SEARCH_PERSIST_GRACE_MS
): void {
  persistencePaused = true;
  if (persistenceResumeTimer) {
    clearTimeout(persistenceResumeTimer);
    persistenceResumeTimer = null;
  }
  persistenceResumeTimer = setTimeout(() => {
    persistencePaused = false;
    persistenceResumeTimer = null;
    if (pendingPersistenceState) {
      const snapshot = pendingPersistenceState;
      pendingPersistenceState = null;
      persistCalendarState(snapshot);
    }
  }, delay);
}

function flushPendingPersistence(): void {
  if (persistenceResumeTimer) {
    clearTimeout(persistenceResumeTimer);
    persistenceResumeTimer = null;
  }
  const snapshot =
    pendingPersistenceState ?? (!suppressReload ? createStateSnapshot() : null);
  pendingPersistenceState = null;
  persistencePaused = false;
  if (!snapshot || suppressReload) {
    if (snapshot) pendingPersistenceState = snapshot;
    return;
  }
  persistCalendarState(snapshot);
}

watch(
  persistedStateSnapshot,
  (state) => {
    if (suppressReload) {
      pendingPersistenceState = state;
      return;
    }
    queuePersistence(state);
  },
  { deep: true, flush: 'post' }
);

async function loadMatches(): Promise<void> {
  const token = ++requestToken;
  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams();
    params.set('game_days', 'true');
    params.set('count', String(dayWindow.value));
    params.set('horizon', String(horizonDays.value));
    params.set('direction', directionParam.value);
    if (anchorDate.value) params.set('anchor', anchorDate.value);
    if (search.value.trim()) params.set('q', search.value.trim());
    for (const club of selectedHomeClubs.value || [])
      params.append('home_club', club);
    for (const club of selectedAwayClubs.value || [])
      params.append('away_club', club);
    for (const tournament of selectedTournaments.value || [])
      params.append('tournament', tournament);
    for (const group of selectedGroups.value || [])
      params.append('group', group);
    for (const stadium of selectedStadiums.value || [])
      params.append('stadium', stadium);
    const res = (await apiFetch(
      `/matches/admin/calendar?${params.toString()}`
    )) as CalendarApiResponse;
    if (token !== requestToken) return;
    matches.value = Array.isArray(res.matches) ? res.matches : [];
    range.value = res.range ?? null;
  } catch (err) {
    if (token === requestToken) {
      const message =
        err instanceof Error
          ? err.message
          : 'Не удалось загрузить данные. Попробуйте обновить страницу.';
      error.value = message;
    }
  } finally {
    if (token === requestToken) {
      loading.value = false;
    }
  }
}

watch(
  () => [timeScope.value, dayWindow.value, anchorDate.value],
  () => {
    if (suppressReload) return;
    void loadMatches();
  }
);

watch(
  () => search.value,
  (query: string) => {
    if (skipSearchWatcher) {
      skipSearchWatcher = false;
      return;
    }
    pausePersistenceTemporarily();
    if (searchTimer) {
      clearTimeout(searchTimer);
      searchTimer = undefined;
    }
    if (suppressReload) return;
    const delay = query?.trim() ? SEARCH_DEBOUNCE_MS : 0;
    searchTimer = setTimeout(() => {
      void loadMatches();
      flushPendingPersistence();
    }, delay);
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
  draft.dayWindow = dayWindow.value;
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
  dayWindow.value = DEFAULT_DAY_WINDOW;
  draft.dayWindow = DEFAULT_DAY_WINDOW;
  anchorDate.value = draft.anchorDate || '';
  filtersModal.value?.hide();
  void loadMatches();
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
  draft.dayWindow = DEFAULT_DAY_WINDOW;
  draft.anchorDate = toMoscowDateInputValue(new Date());
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
  draft.anchorDate = toMoscowDateInputValue(shifted);
}

function resetDraftAnchorToToday(): void {
  draft.anchorDate = toMoscowDateInputValue(new Date());
}

function submitSearchNow(): void {
  if (suppressReload) return;
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = undefined;
  }
  void loadMatches();
  flushPendingPersistence();
}

function clearSearchQuery(): void {
  if (!search.value) return;
  skipSearchWatcher = true;
  search.value = '';
  submitSearchNow();
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
  selectedHomeClubs.value = [];
  selectedAwayClubs.value = [];
  selectedTournaments.value = [];
  selectedGroups.value = [];
  selectedStadiums.value = [];
  statusScope.value = 'all';
  timeScope.value = 'upcoming';
  dayWindow.value = DEFAULT_DAY_WINDOW;
  anchorDate.value = toMoscowDateInputValue(new Date());
  range.value = null;
  activeDayKey.value = null;
  pendingDayKey.value = null;
  setDraftFromState();
  void nextTick(() => {
    suppressReload = false;
    persistCurrentState({ replace: true });
    void loadMatches();
  });
}

function removeHeaderChip(chip: CalendarFilterChip): void {
  let requiresReload = true;
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
      requiresReload = false;
      break;
    default:
      requiresReload = false;
  }
  if (requiresReload) void loadMatches();
}

function addUnique(list: string[], value: string): void {
  const val = (value ?? '').trim();
  if (!val) return;
  if (!list.includes(val)) list.push(val);
}

function removeFrom(list: string[], value: string): void {
  const index = list.indexOf(value);
  if (index >= 0) list.splice(index, 1);
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

function toSortedUnique<T>(
  list: ReadonlyArray<T> | null | undefined,
  selector: (item: T) => string | null | undefined
): string[] {
  const items = new Set<string>();
  (list ?? []).forEach((item) => {
    const raw = selector(item);
    const normalized = raw?.toString().trim();
    if (normalized) items.add(normalized);
  });
  return Array.from(items).sort((a, b) =>
    String(a).localeCompare(String(b), 'ru', { sensitivity: 'base' })
  );
}

function buildSearchMatcher(query: string): MatchesSearchPredicate | null {
  const normalized = (query || '').trim().toLowerCase();
  if (!normalized) return null;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  const lev = (a: string, b: string) => {
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const prev = Array.from({ length: n + 1 }, (_, index) => index);
    const curr = Array.from({ length: n + 1 }, () => 0);
    for (let i = 1; i <= m; i += 1) {
      curr[0] = i;
      for (let j = 1; j <= n; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        const insertCost = curr[j - 1]! + 1;
        const deleteCost = prev[j]! + 1;
        const replaceCost = prev[j - 1]! + cost;
        curr[j] = Math.min(insertCost, deleteCost, replaceCost);
      }
      for (let j = 0; j <= n; j += 1) {
        prev[j] = curr[j]!;
      }
    }
    return prev[n] ?? Number.POSITIVE_INFINITY;
  };
  const fuzzyIncludes = (hay: string, needle: string) => {
    if (!needle) return true;
    if (!hay) return false;
    if (hay.includes(needle)) return true;
    if (needle.length >= 4) {
      for (let i = 0; i <= hay.length - needle.length; i += 1) {
        const segment = hay.slice(i, i + needle.length);
        if (lev(segment, needle) <= 1) return true;
      }
    }
    return false;
  };
  return (match: CalendarMatch) => {
    const fields = [
      match.team1,
      match.team2,
      match.home_club,
      match.away_club,
      match.tournament,
      match.group,
      match.tour,
      match.stadium,
    ]
      .map((field) => (field ?? '').toString().toLowerCase())
      .filter(Boolean);
    return tokens.every((token) =>
      fields.some((field) => fuzzyIncludes(field, token))
    );
  };
}

function getDefaultCalendarState(): CalendarPersistedState {
  return {
    anchorDate: toMoscowDateInputValue(new Date()),
    dayWindow: DEFAULT_DAY_WINDOW,
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

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function sanitizePersistedState(
  input: Partial<CalendarPersistedState> | null | undefined
): CalendarPersistedState {
  const fallback = getDefaultCalendarState();
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
      anchorDate = toMoscowDateInputValue(rawAnchor) || fallback.anchorDate;
    }
  }
  const clampDayWindow = (): number => fallback.dayWindow;
  const normalizeSearch = (): string => {
    if (!hasOwn(candidate, 'search')) return fallback.search;
    return (candidate['search'] ?? '').toString().slice(0, 120);
  };
  const normalizeTimeScope = (): TimeScope =>
    candidate['timeScope'] === 'past' ? 'past' : 'upcoming';
  const allowedStatuses = statusOptions.map((option) => option.value);
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
    dayWindow: clampDayWindow(),
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

function readStateFromStorage(): CalendarPersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage?.getItem(CALENDAR_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CalendarPersistedState>;
    return sanitizePersistedState(parsed);
  } catch {
    return null;
  }
}

function writeStateToStorage(state: CalendarPersistedState): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage?.setItem(
      CALENDAR_STATE_STORAGE_KEY,
      JSON.stringify(state)
    );
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

function parseStateFromQuery(
  query: LocationQuery
): Partial<CalendarPersistedState> | null {
  const anchor = queryValueToString(query[QUERY_KEYS.anchor]);
  const dayWindowParam = queryValueToNumber(query[QUERY_KEYS.dayWindow]);
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
    dayWindowParam !== undefined ||
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
  if (dayWindowParam !== undefined) partial.dayWindow = dayWindowParam;
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

function buildQueryFromState(
  state: CalendarPersistedState
): Record<string, string | string[]> {
  const defaults = getDefaultCalendarState();
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

type QueryLike = Record<string, string | string[] | null | undefined>;

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

function queriesMatch(
  current: LocationQuery,
  next: Record<string, string | string[] | undefined>
): boolean {
  const currentEntries = queryEntries(current as QueryLike);
  const nextEntries = queryEntries(next as QueryLike);
  if (currentEntries.length !== nextEntries.length) return false;
  return currentEntries.every((entry, index) => entry === nextEntries[index]);
}

function applyCalendarState(state: CalendarPersistedState): void {
  search.value = state.search || '';
  selectedHomeClubs.value = [...state.selectedHomeClubs];
  selectedAwayClubs.value = [...state.selectedAwayClubs];
  selectedTournaments.value = [...state.selectedTournaments];
  selectedGroups.value = [...state.selectedGroups];
  selectedStadiums.value = [...state.selectedStadiums];
  anchorDate.value = state.anchorDate;
  dayWindow.value = state.dayWindow;
  timeScope.value = state.timeScope;
  statusScope.value = state.statusScope;
  activeDayKey.value = state.activeDayKey;
}

function createStateSnapshot(): CalendarPersistedState {
  return {
    anchorDate: anchorDate.value,
    dayWindow: dayWindow.value,
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
}

function persistCalendarState(
  state: CalendarPersistedState,
  { replace = true }: PersistOptions = {}
): void {
  const safeState = sanitizePersistedState(state);
  writeStateToStorage(safeState);
  const query = buildQueryFromState(safeState);
  const location: CalendarReturnLocation = { path: route.path, query };
  if (route.hash) location.hash = route.hash;
  storeCalendarReturnLocation(location);
  if (queriesMatch(route.query, query)) return;
  const target = {
    path: route.path,
    query,
    hash: route.hash,
  };
  const navigation = replace ? router.replace(target) : router.push(target);
  void navigation.catch(() => {});
}

function persistCurrentState(options?: PersistOptions): void {
  persistCalendarState(createStateSnapshot(), options);
}

function hydrateCalendarState(): void {
  suppressReload = true;
  const base = getDefaultCalendarState();
  const storageState = readStateFromStorage();
  const queryState = parseStateFromQuery(route.query);
  const resolved = sanitizePersistedState({
    ...base,
    ...(storageState ?? {}),
    ...(queryState ?? {}),
  });
  applyCalendarState(resolved);
  pendingDayKey.value = resolved.activeDayKey;
  setDraftFromState();
  void nextTick(() => {
    suppressReload = false;
    persistCurrentState({ replace: true });
    void loadMatches();
  });
}

function toMoscowDateInputValue(
  value: string | Date | null | undefined
): string {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MOSCOW_TZ,
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

function formatFiltersLabel(value: number): string {
  const rule = pluralRules.select(value);
  if (rule === 'one') return 'фильтр';
  if (rule === 'few') return 'фильтра';
  return 'фильтров';
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
});
</script>

<template>
  <div class="calendar-page py-3">
    <div class="container">
      <nav aria-label="breadcrumb" class="mb-2">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item">Управление спортивной частью</li>
          <li class="breadcrumb-item active" aria-current="page">
            Календарь игр
          </li>
        </ol>
      </nav>

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
            {{ error }}
          </div>
          <div v-else-if="loading" class="text-center py-3">
            <div
              class="spinner-border spinner-brand"
              role="status"
              aria-hidden="true"
            ></div>
          </div>
          <template v-else>
            <div
              v-if="!dayTabs.length"
              class="alert alert-light border small mb-0"
              role="status"
              aria-live="polite"
            >
              Нет матчей по выбранным фильтрам в указанном диапазоне.
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
                v-if="!filteredDayItems.length"
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
