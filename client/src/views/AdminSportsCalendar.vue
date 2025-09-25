<script setup>
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api';
import TabSelector from '../components/TabSelector.vue';
import MatchesDayTiles from '../components/MatchesDayTiles.vue';
import { MOSCOW_TZ, toDayKey } from '../utils/time';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAY_WINDOW = 7;
const dayWindowOptions = [3, 5, 7, 10, 14];
const pluralRules = new Intl.PluralRules('ru-RU');

const dayWindow = ref(DEFAULT_DAY_WINDOW);
const timeScope = ref('upcoming');
const statusScope = ref('all');
const anchorDate = ref(toMoscowDateInputValue(new Date()));
const matches = ref([]);
const range = ref(null);
const loading = ref(false);
const error = ref('');
const activeDayKey = ref(null);
const search = ref('');

const selectedHomeClubs = ref([]);
const selectedAwayClubs = ref([]);
const selectedTournaments = ref([]);
const selectedGroups = ref([]);
const selectedStadiums = ref([]);

let filtersModal;
const filtersModalRef = ref(null);
const draft = reactive({
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
];

const searchMatcher = computed(() => buildSearchMatcher(search.value));
const matchesAfterSearch = computed(() => {
  const matcher = searchMatcher.value;
  const list = matches.value || [];
  return matcher ? list.filter(matcher) : list;
});

function isAttentionMatch(match) {
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

const matchesAfterStatus = computed(() => {
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

const statusCounters = computed(() => {
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

const statusCountMap = computed(() => {
  const counters = statusCounters.value;
  return {
    all: counters.total,
    attention: counters.attention,
    pending: counters.pending,
    accepted: counters.accepted,
  };
});

function getStatusCount(scope) {
  const map = statusCountMap.value;
  return map?.[scope] ?? 0;
}

const dayTabs = computed(() => {
  const counts = new Map();
  const attention = new Map();
  (matchesAfterStatus.value || []).forEach((match) => {
    const key = toDayKey(match.date, MOSCOW_TZ);
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
  const todayKey = toDayKey(new Date(), MOSCOW_TZ);
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
    };
  });
});

const filteredDayItems = computed(() => {
  if (!activeDayKey.value) return [];
  return (matchesAfterStatus.value || []).filter(
    (match) => toDayKey(match.date, MOSCOW_TZ) === activeDayKey.value
  );
});

const selectedDayCount = computed(() => filteredDayItems.value.length);

const homeClubOptions = computed(() =>
  toSortedUnique(matches.value, (match) => match.home_club)
);
const awayClubOptions = computed(() =>
  toSortedUnique(matches.value, (match) => match.away_club)
);
const tournamentOptions = computed(() =>
  toSortedUnique(matches.value, (match) => match.tournament)
);
const groupOptions = computed(() => {
  const selected = selectedTournaments.value || [];
  const base = selected.length
    ? (matches.value || []).filter((match) =>
        selected.includes(match.tournament)
      )
    : matches.value || [];
  return toSortedUnique(base, (match) => match.group);
});
const groupOptionsModal = computed(() => {
  const selected = draft.tournaments || [];
  const base = selected.length
    ? (matches.value || []).filter((match) =>
        selected.includes(match.tournament)
      )
    : matches.value || [];
  return toSortedUnique(base, (match) => match.group);
});
const stadiumOptions = computed(() =>
  toSortedUnique(matches.value, (match) => match.stadium)
);

const rangeSummary = computed(() => {
  if (!range.value?.start || !range.value?.end_exclusive) return '';
  const startDate = new Date(range.value.start);
  const endExclusive = new Date(range.value.end_exclusive);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endExclusive.getTime()))
    return '';
  const endDate = new Date(endExclusive.getTime() - DAY_MS);
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return `${formatter.format(startDate)} — ${formatter.format(endDate)}`;
});

watch(
  () => groupOptions.value,
  () => {
    const filtered = (selectedGroups.value || []).filter((group) =>
      groupOptions.value.includes(group)
    );
    if (filtered.length !== (selectedGroups.value || []).length) {
      selectedGroups.value = filtered;
    }
  }
);

watch(
  () => [draft.tournaments.slice(), groupOptionsModal.value],
  () => {
    draft.groups = (draft.groups || []).filter((group) =>
      groupOptionsModal.value.includes(group)
    );
  }
);

watch(
  () => draft.homeClubs.length,
  (len, prevLen) => {
    if (prevLen > 0 && len === 0) {
      draft.awayClubs = [];
      draft.awayCand = '';
    }
  }
);

watch(
  () => draft.tournaments.length,
  (len, prevLen) => {
    if (prevLen > 0 && len === 0) {
      draft.groups = [];
      draft.groupCand = '';
    }
  }
);

watch(
  () => dayTabs.value.map((tab) => tab.key),
  (keys) => {
    if (!keys.length) {
      activeDayKey.value = null;
      return;
    }
    if (!keys.includes(activeDayKey.value)) {
      activeDayKey.value = keys[0];
    }
  }
);

let suppressReload = false;
let searchTimer;
let requestToken = 0;
let visibilityHandler;

async function loadMatches() {
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
    const res = await apiFetch(`/matches/admin/calendar?${params.toString()}`);
    if (token !== requestToken) return;
    matches.value = Array.isArray(res.matches) ? res.matches : [];
    range.value = res.range || null;
    const tabs = dayTabs.value;
    const anchorTab = anchorKey.value
      ? tabs.find((tab) => tab.key === anchorKey.value)
      : null;
    const hasActive = tabs.some((tab) => tab.key === activeDayKey.value);
    if (!hasActive) {
      if (anchorTab) {
        activeDayKey.value = anchorTab.key;
      } else if (directionParam.value === 'backward') {
        activeDayKey.value = tabs[tabs.length - 1]?.key ?? null;
      } else {
        activeDayKey.value = tabs[0]?.key ?? null;
      }
    }
  } catch (err) {
    if (token === requestToken) {
      error.value =
        err?.message ||
        'Не удалось загрузить данные. Попробуйте обновить страницу.';
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
  (query) => {
    if (searchTimer) clearTimeout(searchTimer);
    if (suppressReload) return;
    const delay = query?.trim() ? 300 : 0;
    searchTimer = setTimeout(() => {
      void loadMatches();
    }, delay);
  }
);

function setDraftFromState() {
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

function openFilters() {
  setDraftFromState();
  if (!filtersModal) filtersModal = new Modal(filtersModalRef.value);
  filtersModal.show();
}

function applyFilters() {
  selectedHomeClubs.value = [...draft.homeClubs];
  selectedAwayClubs.value = [...draft.awayClubs];
  selectedTournaments.value = [...draft.tournaments];
  selectedGroups.value = [...draft.groups];
  selectedStadiums.value = [...draft.stadiums];
  statusScope.value = draft.statusScope || 'all';
  timeScope.value = draft.timeScope || 'upcoming';
  dayWindow.value = Number.isFinite(draft.dayWindow)
    ? draft.dayWindow
    : DEFAULT_DAY_WINDOW;
  anchorDate.value = draft.anchorDate || '';
  filtersModal?.hide();
  void loadMatches();
}

function resetDraft() {
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

function handleModalReset() {
  resetAllFilters();
  filtersModal?.hide();
}

function shiftDraftAnchor(offsetDays) {
  const base = draft.anchorDate
    ? new Date(`${draft.anchorDate}T00:00:00Z`)
    : new Date();
  if (Number.isNaN(base.getTime())) return;
  const shifted = new Date(base.getTime() + offsetDays * DAY_MS);
  draft.anchorDate = toMoscowDateInputValue(shifted);
}

function resetDraftAnchorToToday() {
  draft.anchorDate = toMoscowDateInputValue(new Date());
}

function selectDraftDayWindow(option) {
  draft.dayWindow = option;
}

function manualRefresh() {
  void loadMatches();
}

function toggleDraftStatus(scope) {
  if (scope === 'all') {
    draft.statusScope = 'all';
    return;
  }
  draft.statusScope = draft.statusScope === scope ? 'all' : scope;
}

function resetAllFilters() {
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
  setDraftFromState();
  nextTick(() => {
    suppressReload = false;
    void loadMatches();
  });
}

function removeHeaderChip(chip) {
  let requiresReload = true;
  const remove = (refList) => {
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

function addUnique(list, value) {
  const val = (value || '').toString().trim();
  if (!val || !Array.isArray(list)) return;
  if (!list.includes(val)) list.push(val);
}

function removeFrom(list, value) {
  if (!Array.isArray(list)) return;
  const index = list.indexOf(value);
  if (index >= 0) list.splice(index, 1);
}

function addHome() {
  addUnique(draft.homeClubs, draft.homeCand);
  draft.homeCand = '';
}

function removeHome(value) {
  removeFrom(draft.homeClubs, value);
}

function addAway() {
  addUnique(draft.awayClubs, draft.awayCand);
  draft.awayCand = '';
}

function removeAway(value) {
  removeFrom(draft.awayClubs, value);
}

function addTournament() {
  addUnique(draft.tournaments, draft.tournamentCand);
  draft.tournamentCand = '';
}

function removeTournament(value) {
  removeFrom(draft.tournaments, value);
}

function addGroup() {
  addUnique(draft.groups, draft.groupCand);
  draft.groupCand = '';
}

function removeGroup(value) {
  removeFrom(draft.groups, value);
}

function addStadium() {
  addUnique(draft.stadiums, draft.stadiumCand);
  draft.stadiumCand = '';
}

function removeStadium(value) {
  removeFrom(draft.stadiums, value);
}

const activeFilterChips = computed(() => {
  const chips = [];
  const pushChip = (type, value, label, icon) =>
    chips.push({ key: `${type}:${value}`, type, value, label, icon });
  (selectedHomeClubs.value || []).forEach((value) =>
    pushChip('home', value, `Хозяин: ${value}`, 'bi-house-door')
  );
  (selectedAwayClubs.value || []).forEach((value) =>
    pushChip('away', value, `Гость: ${value}`, 'bi-flag')
  );
  (selectedTournaments.value || []).forEach((value) =>
    pushChip('tourn', value, `Соревнование: ${value}`, 'bi-trophy')
  );
  (selectedGroups.value || []).forEach((value) =>
    pushChip('group', value, `Группа: ${value}`, 'bi-diagram-3')
  );
  (selectedStadiums.value || []).forEach((value) =>
    pushChip('stad', value, `Стадион: ${value}`, 'bi-geo-alt')
  );
  if (statusScope.value !== 'all') {
    const option = statusOptions.find((opt) => opt.value === statusScope.value);
    pushChip(
      'status',
      statusScope.value,
      `Статус: ${option ? option.label : 'Выбранный'}`,
      option?.icon || 'bi-flag'
    );
  }
  return chips;
});

function toSortedUnique(list, selector) {
  const items = new Set();
  (list || []).forEach((item) => {
    const value = selector(item);
    if (value) items.add(value);
  });
  return Array.from(items).sort((a, b) =>
    String(a).localeCompare(String(b), 'ru', { sensitivity: 'base' })
  );
}

function buildSearchMatcher(query) {
  const normalized = (query || '').trim().toLowerCase();
  if (!normalized) return null;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  const lev = (a, b) => {
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1));
    for (let i = 0; i <= m; i += 1) dp[i][0] = i;
    for (let j = 0; j <= n; j += 1) dp[0][j] = j;
    for (let i = 1; i <= m; i += 1) {
      for (let j = 1; j <= n; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  };
  const fuzzyIncludes = (hay, needle) => {
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
  return (match) => {
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
      .map((field) => (field || '').toString().toLowerCase())
      .filter(Boolean);
    return tokens.every((token) =>
      fields.some((field) => fuzzyIncludes(field, token))
    );
  };
}

function toMoscowDateInputValue(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MOSCOW_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(date)
    .reduce((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
  const { year, month, day } = parts;
  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
}

function formatDaysLabel(value) {
  const rule = pluralRules.select(value);
  const unit = rule === 'one' ? 'день' : rule === 'few' ? 'дня' : 'дней';
  return `${value} ${unit}`;
}

function formatMatchesLabel(value) {
  const rule = pluralRules.select(value);
  if (rule === 'one') return 'матч';
  if (rule === 'few') return 'матча';
  return 'матчей';
}

function formatTabLines(date, offset) {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TZ,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
    .formatToParts(date)
    .reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  const weekday = (parts.weekday || '').replace('.', '');
  const ddmm = `${parts.day} ${parts.month}`;
  const normalizedOffset = Math.round(offset);
  if (normalizedOffset === 0) return { line1: ddmm, line2: 'Сегодня' };
  if (normalizedOffset === 1) return { line1: ddmm, line2: 'Завтра' };
  if (normalizedOffset === -1) return { line1: ddmm, line2: 'Вчера' };
  if (normalizedOffset === -2) return { line1: ddmm, line2: 'Позавчера' };
  return { line1: ddmm, line2: weekday };
}

const route = useRoute();

function initFromQuery() {
  try {
    const query = route.query || {};
    const toArray = (value) =>
      Array.isArray(value) ? value : value ? [value] : [];
    const tournaments = toArray(query.tournament).filter(Boolean);
    const groups = toArray(query.group).filter(Boolean);
    if (tournaments.length) selectedTournaments.value = tournaments;
    if (groups.length) selectedGroups.value = groups;
  } catch {
    /* no-op */
  }
}

onMounted(() => {
  initFromQuery();
  void loadMatches();
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
  if (searchTimer) clearTimeout(searchTimer);
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
        <div class="card-body d-flex flex-column gap-3">
          <div class="controls-header">
            <div class="controls-search">
              <label class="visually-hidden" for="calendar-search"
                >Поиск по матчам</label
              >
              <div class="input-group input-group-sm">
                <span class="input-group-text">
                  <i class="bi bi-search" aria-hidden="true"></i>
                </span>
                <input
                  id="calendar-search"
                  v-model="search"
                  type="search"
                  class="form-control"
                  placeholder="Поиск по командам, клубам, стадионам"
                  autocomplete="off"
                />
              </div>
            </div>
            <div class="controls-buttons">
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                :disabled="loading"
                @click="manualRefresh"
              >
                <span
                  v-if="loading"
                  class="spinner-border spinner-border-sm me-1"
                  aria-hidden="true"
                ></span>
                Обновить
              </button>
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                @click="openFilters"
              >
                <i class="bi bi-sliders me-1" aria-hidden="true"></i>
                Фильтры
                <span
                  v-if="activeFiltersCount"
                  class="badge text-bg-secondary ms-1"
                  >{{ activeFiltersCount }}</span
                >
              </button>
            </div>
          </div>

          <div v-if="activeFilterChips.length" class="active-chips">
            <button
              v-for="chip in activeFilterChips"
              :key="chip.key"
              type="button"
              class="chip btn btn-light btn-sm border"
              :aria-label="`Удалить фильтр ${chip.label}`"
              @click="removeHeaderChip(chip)"
            >
              <i
                v-if="chip.icon"
                :class="['bi', chip.icon, 'me-1']"
                aria-hidden="true"
              ></i>
              {{ chip.label }}
              <i class="bi bi-x-lg ms-1" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </section>

      <section class="card section-card tile fade-in shadow-sm">
        <div class="card-body calendar-results">
          <div class="results-header">
            <TabSelector
              v-model="activeDayKey"
              :tabs="dayTabs"
              aria-label="Дни календаря"
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

  <div
    ref="filtersModalRef"
    class="modal fade"
    tabindex="-1"
    aria-hidden="true"
  >
    <div
      class="modal-dialog modal-lg modal-dialog-scrollable modal-fullscreen-sm-down"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title h5">Фильтры</h2>
          <button
            type="button"
            class="btn-close"
            aria-label="Закрыть"
            @click="filtersModal?.hide()"
          ></button>
        </div>
        <div class="modal-body">
          <div class="modal-filter-group">
            <span class="modal-filter-title">Статус согласования</span>
            <div class="status-pills">
              <button
                v-for="option in statusOptions"
                :key="option.value"
                type="button"
                class="status-pill"
                :class="{
                  'status-pill--active': draft.statusScope === option.value,
                  'status-pill--disabled':
                    option.value !== 'all' && !getStatusCount(option.value),
                }"
                :aria-pressed="draft.statusScope === option.value"
                :disabled="
                  option.value !== 'all' && !getStatusCount(option.value)
                "
                @click="toggleDraftStatus(option.value)"
              >
                <i :class="['bi', option.icon]" aria-hidden="true"></i>
                <span>{{ option.label }}</span>
                <span class="badge text-bg-light ms-2">
                  {{ getStatusCount(option.value) }}
                </span>
              </button>
            </div>
          </div>

          <div class="modal-filter-group">
            <span class="modal-filter-title">Период календаря</span>
            <TabSelector
              v-model="draft.timeScope"
              :tabs="timeScopeTabs"
              aria-label="Период"
              :nav-fill="false"
              justify="start"
            />
          </div>

          <div class="modal-filter-group modal-grid">
            <div class="modal-grid-item">
              <span class="modal-filter-title">Опорная дата</span>
              <div class="anchor-row">
                <input
                  id="modal-anchor-date"
                  v-model="draft.anchorDate"
                  type="date"
                  class="form-control form-control-sm"
                />
                <div
                  class="btn-group btn-group-sm"
                  role="group"
                  aria-label="Сдвиг по диапазону"
                >
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    @click="
                      shiftDraftAnchor(-draft.dayWindow || -DEFAULT_DAY_WINDOW)
                    "
                  >
                    -{{
                      formatDaysLabel(draft.dayWindow || DEFAULT_DAY_WINDOW)
                    }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    @click="
                      shiftDraftAnchor(draft.dayWindow || DEFAULT_DAY_WINDOW)
                    "
                  >
                    +{{
                      formatDaysLabel(draft.dayWindow || DEFAULT_DAY_WINDOW)
                    }}
                  </button>
                </div>
                <button
                  type="button"
                  class="btn btn-link btn-sm text-decoration-none px-0"
                  @click="resetDraftAnchorToToday"
                >
                  Сбросить
                </button>
              </div>
            </div>
            <div class="modal-grid-item">
              <span class="modal-filter-title">Диапазон, дни</span>
              <div
                class="btn-group btn-group-sm flex-wrap"
                role="group"
                aria-label="Диапазон, дни"
              >
                <button
                  v-for="option in dayWindowOptions"
                  :key="option"
                  type="button"
                  class="btn"
                  :class="
                    draft.dayWindow === option
                      ? 'btn-brand'
                      : 'btn-outline-secondary'
                  "
                  :aria-pressed="draft.dayWindow === option"
                  @click="selectDraftDayWindow(option)"
                >
                  {{ formatDaysLabel(option) }}
                </button>
              </div>
              <small v-if="rangeSummary" class="text-muted d-block mt-1"
                >Текущий диапазон: {{ rangeSummary }}</small
              >
            </div>
          </div>

          <div class="modal-filter-group">
            <span class="modal-filter-title">Структурные фильтры</span>
            <div class="row g-3">
              <div class="col-12 col-md-6">
                <label for="f-home" class="form-label small text-muted"
                  >Клуб хозяина</label
                >
                <div class="d-flex gap-2">
                  <select
                    id="f-home"
                    v-model="draft.homeCand"
                    class="form-select"
                  >
                    <option value="">Выберите клуб</option>
                    <option
                      v-for="club in homeClubOptions"
                      :key="club"
                      :value="club"
                    >
                      {{ club }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    :disabled="!draft.homeCand"
                    @click="addHome"
                  >
                    <i class="bi bi-plus-lg" aria-hidden="true"></i>
                  </button>
                </div>
                <div class="mt-2 d-flex flex-wrap gap-1">
                  <span
                    v-for="value in draft.homeClubs"
                    :key="`h-${value}`"
                    class="badge bg-light text-muted border"
                    role="button"
                    tabindex="0"
                    :aria-label="`Удалить фильтр Хозяин: ${value}`"
                    @click="removeHome(value)"
                    @keydown.enter.prevent="removeHome(value)"
                  >
                    {{ value }}
                    <i class="bi bi-x-lg ms-1" aria-hidden="true"></i>
                  </span>
                </div>
              </div>
              <div class="col-12 col-md-6">
                <label for="f-away" class="form-label small text-muted"
                  >Клуб гостя</label
                >
                <div class="d-flex gap-2">
                  <select
                    id="f-away"
                    v-model="draft.awayCand"
                    class="form-select"
                  >
                    <option value="">Выберите клуб</option>
                    <option
                      v-for="club in awayClubOptions"
                      :key="club"
                      :value="club"
                    >
                      {{ club }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    :disabled="!draft.awayCand"
                    @click="addAway"
                  >
                    <i class="bi bi-plus-lg" aria-hidden="true"></i>
                  </button>
                </div>
                <div class="mt-2 d-flex flex-wrap gap-1">
                  <span
                    v-for="value in draft.awayClubs"
                    :key="`a-${value}`"
                    class="badge bg-light text-muted border"
                    role="button"
                    tabindex="0"
                    :aria-label="`Удалить фильтр Гость: ${value}`"
                    @click="removeAway(value)"
                    @keydown.enter.prevent="removeAway(value)"
                  >
                    {{ value }}
                    <i class="bi bi-x-lg ms-1" aria-hidden="true"></i>
                  </span>
                </div>
              </div>
              <div class="col-12 col-md-4">
                <label for="f-tournament" class="form-label small text-muted"
                  >Соревнование</label
                >
                <div class="d-flex gap-2">
                  <select
                    id="f-tournament"
                    v-model="draft.tournamentCand"
                    class="form-select"
                  >
                    <option value="">Выберите соревнование</option>
                    <option
                      v-for="value in tournamentOptions"
                      :key="value"
                      :value="value"
                    >
                      {{ value }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    :disabled="!draft.tournamentCand"
                    @click="addTournament"
                  >
                    <i class="bi bi-plus-lg" aria-hidden="true"></i>
                  </button>
                </div>
                <div class="mt-2 d-flex flex-wrap gap-1">
                  <span
                    v-for="value in draft.tournaments"
                    :key="`t-${value}`"
                    class="badge bg-light text-muted border"
                    role="button"
                    tabindex="0"
                    :aria-label="`Удалить фильтр Соревнование: ${value}`"
                    @click="removeTournament(value)"
                    @keydown.enter.prevent="removeTournament(value)"
                  >
                    {{ value }}
                    <i class="bi bi-x-lg ms-1" aria-hidden="true"></i>
                  </span>
                </div>
              </div>
              <div class="col-12 col-md-4">
                <label for="f-group" class="form-label small text-muted"
                  >Группа</label
                >
                <div class="d-flex gap-2">
                  <select
                    id="f-group"
                    v-model="draft.groupCand"
                    class="form-select"
                  >
                    <option value="">Выберите группу</option>
                    <option
                      v-for="value in groupOptionsModal"
                      :key="value"
                      :value="value"
                    >
                      {{ value }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    :disabled="!draft.groupCand"
                    @click="addGroup"
                  >
                    <i class="bi bi-plus-lg" aria-hidden="true"></i>
                  </button>
                </div>
                <div class="mt-2 d-flex flex-wrap gap-1">
                  <span
                    v-for="value in draft.groups"
                    :key="`g-${value}`"
                    class="badge bg-light text-muted border"
                    role="button"
                    tabindex="0"
                    :aria-label="`Удалить фильтр Группа: ${value}`"
                    @click="removeGroup(value)"
                    @keydown.enter.prevent="removeGroup(value)"
                  >
                    {{ value }}
                    <i class="bi bi-x-lg ms-1" aria-hidden="true"></i>
                  </span>
                </div>
              </div>
              <div class="col-12 col-md-4">
                <label for="f-stadium" class="form-label small text-muted"
                  >Стадион</label
                >
                <div class="d-flex gap-2">
                  <select
                    id="f-stadium"
                    v-model="draft.stadiumCand"
                    class="form-select"
                  >
                    <option value="">Выберите стадион</option>
                    <option
                      v-for="value in stadiumOptions"
                      :key="value"
                      :value="value"
                    >
                      {{ value }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    :disabled="!draft.stadiumCand"
                    @click="addStadium"
                  >
                    <i class="bi bi-plus-lg" aria-hidden="true"></i>
                  </button>
                </div>
                <div class="mt-2 d-flex flex-wrap gap-1">
                  <span
                    v-for="value in draft.stadiums"
                    :key="`s-${value}`"
                    class="badge bg-light text-muted border"
                    role="button"
                    tabindex="0"
                    :aria-label="`Удалить фильтр Стадион: ${value}`"
                    @click="removeStadium(value)"
                    @keydown.enter.prevent="removeStadium(value)"
                  >
                    {{ value }}
                    <i class="bi bi-x-lg ms-1" aria-hidden="true"></i>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            @click="handleModalReset"
          >
            Сбросить фильтры
          </button>
          <button
            type="button"
            class="btn btn-link text-decoration-none"
            @click="resetDraft"
          >
            Очистить форму
          </button>
          <button type="button" class="btn btn-brand" @click="applyFilters">
            Применить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.controls-card .card-body {
  padding: 1.5rem;
}

.controls-header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
}

.controls-search {
  flex: 1 1 260px;
}

.controls-buttons {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.active-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.active-chips .chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 999px;
  padding-inline: 0.75rem;
  font-size: 0.8rem;
}

.results-header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.modal-filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.modal-filter-group:last-child {
  margin-bottom: 0;
}

.modal-filter-title {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--bs-secondary-color);
}

.status-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  background: var(--bs-body-bg);
  font-size: 0.85rem;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.status-pill--active {
  border-color: var(--bs-primary);
  background: rgba(var(--bs-primary-rgb), 0.08);
  color: var(--bs-primary);
}

.status-pill--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status-pill .badge {
  font-size: 0.7rem;
}

.modal-grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.anchor-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.anchor-row input {
  min-width: 160px;
}

.anchor-row .btn-group {
  flex-wrap: nowrap;
}

@media (max-width: 991.98px) {
  .controls-buttons {
    justify-content: flex-start;
  }
}

@media (max-width: 767.98px) {
  .controls-card .card-body {
    padding: 1.25rem;
  }
  .controls-header {
    flex-direction: column;
    align-items: stretch;
  }
  .controls-buttons {
    align-items: stretch;
  }
  .controls-buttons .btn {
    width: 100%;
  }
  .anchor-row {
    flex-direction: column;
    align-items: stretch;
  }
  .anchor-row .btn-group,
  .anchor-row .btn-link {
    width: 100%;
    text-align: left;
  }
  .modal-grid {
    grid-template-columns: 1fr;
  }
}
</style>
