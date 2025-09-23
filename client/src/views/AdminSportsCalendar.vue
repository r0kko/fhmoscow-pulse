<script setup>
import {
  ref,
  onMounted,
  onUnmounted,
  computed,
  watchEffect,
  reactive,
} from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { apiFetch } from '../api';
import TabSelector from '../components/TabSelector.vue';
import MatchesDayTiles from '../components/MatchesDayTiles.vue';
import { MOSCOW_TZ, toDayKey } from '../utils/time.js';
import Modal from 'bootstrap/js/dist/modal';

const daysCount = 10;
const matches = ref([]);
const loading = ref(false);
const error = ref('');
const activeDayKey = ref(null);

// Filters
const search = ref('');
const selectedHomeClubs = ref([]);
const selectedAwayClubs = ref([]);
const selectedTournaments = ref([]);
const selectedGroups = ref([]);
const selectedStadiums = ref([]);

// Filters modal
const filtersModalRef = ref(null);
let filtersModal;
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
});
const activeFiltersCount = computed(() => {
  // Show count for structural filters only (exclude free-text search)
  let n = 0;
  n += (selectedHomeClubs.value || []).length;
  n += (selectedAwayClubs.value || []).length;
  n += (selectedTournaments.value || []).length;
  n += (selectedGroups.value || []).length;
  n += (selectedStadiums.value || []).length;
  return n;
});
function openFilters() {
  draft.homeClubs = [...(selectedHomeClubs.value || [])];
  draft.awayClubs = [...(selectedAwayClubs.value || [])];
  draft.tournaments = [...(selectedTournaments.value || [])];
  draft.groups = [...(selectedGroups.value || [])];
  draft.stadiums = [...(selectedStadiums.value || [])];
  if (!filtersModal) filtersModal = new Modal(filtersModalRef.value);
  filtersModal.show();
}
function applyFilters() {
  selectedHomeClubs.value = [...(draft.homeClubs || [])];
  selectedAwayClubs.value = [...(draft.awayClubs || [])];
  selectedTournaments.value = [...(draft.tournaments || [])];
  selectedGroups.value = [...(draft.groups || [])];
  selectedStadiums.value = [...(draft.stadiums || [])];
  loadMatches();
  filtersModal?.hide();
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
}

function addUnique(list, val) {
  const v = (val || '').toString().trim();
  if (!v) return;
  if (!Array.isArray(list)) return;
  if (!list.includes(v)) list.push(v);
}
function removeFrom(list, val) {
  if (!Array.isArray(list)) return;
  const i = list.indexOf(val);
  if (i >= 0) list.splice(i, 1);
}
function addHome() {
  addUnique(draft.homeClubs, draft.homeCand);
  draft.homeCand = '';
}
function removeHome(v) {
  removeFrom(draft.homeClubs, v);
}
function addAway() {
  addUnique(draft.awayClubs, draft.awayCand);
  draft.awayCand = '';
}
function removeAway(v) {
  removeFrom(draft.awayClubs, v);
}
function addTournament() {
  addUnique(draft.tournaments, draft.tournamentCand);
  draft.tournamentCand = '';
}
function removeTournament(v) {
  removeFrom(draft.tournaments, v);
}
function addGroup() {
  addUnique(draft.groups, draft.groupCand);
  draft.groupCand = '';
}
function removeGroup(v) {
  removeFrom(draft.groups, v);
}
function addStadium() {
  addUnique(draft.stadiums, draft.stadiumCand);
  draft.stadiumCand = '';
}
function removeStadium(v) {
  removeFrom(draft.stadiums, v);
}

// Keep modal groups valid when tournaments change
watchEffect(() => {
  draft.groups = (draft.groups || []).filter((g) =>
    groupOptionsModal.value.includes(g)
  );
});

// If home clubs cleared entirely, reset away clubs selection to reduce confusion
let lastHomeCount = 0;
watchEffect(() => {
  const len = (draft.homeClubs || []).length;
  if (lastHomeCount > 0 && len === 0) {
    draft.awayClubs = [];
    draft.awayCand = '';
  }
  lastHomeCount = len;
});

// If tournaments cleared entirely, reset groups selection
let lastTournCount = 0;
watchEffect(() => {
  const len = (draft.tournaments || []).length;
  if (lastTournCount > 0 && len === 0) {
    draft.groups = [];
    draft.groupCand = '';
  }
  lastTournCount = len;
});

async function loadMatches() {
  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams();
    params.set('game_days', 'true');
    params.set('count', String(daysCount));
    params.set('horizon', '90');
    if (search.value.trim()) params.set('q', search.value.trim());
    for (const v of selectedHomeClubs.value || [])
      params.append('home_club', v);
    for (const v of selectedAwayClubs.value || [])
      params.append('away_club', v);
    for (const v of selectedTournaments.value || [])
      params.append('tournament', v);
    for (const v of selectedGroups.value || []) params.append('group', v);
    for (const v of selectedStadiums.value || []) params.append('stadium', v);
    const res = await apiFetch(`/matches/admin/calendar?${params.toString()}`);
    matches.value = Array.isArray(res.matches) ? res.matches : [];
  } catch (e) {
    error.value = e.message || 'Не удалось загрузить данные';
  } finally {
    loading.value = false;
  }
  const todayKey = toDayKey(new Date(), MOSCOW_TZ);
  const todayTab = dayTabs.value.find((t) => t.key === todayKey);
  if (
    !activeDayKey.value ||
    !dayTabs.value.some((t) => t.key === activeDayKey.value)
  ) {
    activeDayKey.value = todayTab
      ? todayTab.key
      : dayTabs.value[0]?.key || null;
  }
}

const route = useRoute();

function initFromQuery() {
  try {
    const q = route.query || {};
    const t = q.tournament;
    const g = q.group;
    const asArr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
    const tVals = asArr(t).filter((s) => !!s);
    const gVals = asArr(g).filter((s) => !!s);
    if (tVals.length) selectedTournaments.value = tVals;
    if (gVals.length) selectedGroups.value = gVals;
  } catch (_) {
    /* no-op */
  }
}

onMounted(() => {
  initFromQuery();
  loadMatches();
  if (typeof document !== 'undefined') {
    const handler = () => {
      if (document.visibilityState === 'visible') loadMatches();
    };
    document.addEventListener('visibilitychange', handler);
    // Save for removal on unmount
    window.__adminCalVisHandler = handler;
  }
});
onUnmounted(() => {
  try {
    if (window.__adminCalVisHandler) {
      document.removeEventListener(
        'visibilitychange',
        window.__adminCalVisHandler
      );
      delete window.__adminCalVisHandler;
    }
  } catch (_) {}
});

const filteredAll = computed(() => {
  const list = matches.value || [];
  const q = (search.value || '').trim().toLowerCase();
  if (!q) return list;
  const tokens = q.split(/\s+/).filter(Boolean);
  const norm = (s) => (s || '').toString().toLowerCase();
  function lev(a, b) {
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
  }
  function fuzzyIncludes(hay, needle) {
    if (!needle) return true;
    if (!hay) return false;
    if (hay.includes(needle)) return true;
    if (needle.length >= 4) {
      // sliding window check for near matches
      for (let i = 0; i <= hay.length - needle.length; i += 1) {
        const seg = hay.slice(i, i + needle.length);
        if (lev(seg, needle) <= 1) return true;
      }
    }
    return false;
  }
  function matchesItem(m) {
    const fields = [
      norm(m.team1),
      norm(m.team2),
      norm(m.home_club),
      norm(m.away_club),
      norm(m.tournament),
      norm(m.group),
      norm(m.tour),
      norm(m.stadium),
    ];
    return tokens.every((t) => fields.some((f) => fuzzyIncludes(f, t)));
  }
  return list.filter(matchesItem);
});

// Inline desktop chips summarizing active structural filters
const activeFilterChips = computed(() => {
  const chips = [];
  (selectedHomeClubs.value || []).forEach((v) =>
    chips.push({
      key: `home:${v}`,
      type: 'home',
      value: v,
      label: `Хозяин: ${v}`,
    })
  );
  (selectedAwayClubs.value || []).forEach((v) =>
    chips.push({
      key: `away:${v}`,
      type: 'away',
      value: v,
      label: `Гость: ${v}`,
    })
  );
  (selectedTournaments.value || []).forEach((v) =>
    chips.push({
      key: `tourn:${v}`,
      type: 'tourn',
      value: v,
      label: `Соревнование: ${v}`,
    })
  );
  (selectedGroups.value || []).forEach((v) =>
    chips.push({
      key: `group:${v}`,
      type: 'group',
      value: v,
      label: `Группа: ${v}`,
    })
  );
  (selectedStadiums.value || []).forEach((v) =>
    chips.push({
      key: `stad:${v}`,
      type: 'stad',
      value: v,
      label: `Стадион: ${v}`,
    })
  );
  return chips;
});

function removeHeaderChip(chip) {
  const remove = (arrRef) => {
    const arr = arrRef.value || [];
    const i = arr.indexOf(chip.value);
    if (i >= 0) arr.splice(i, 1);
  };
  if (chip.type === 'home') remove(selectedHomeClubs);
  else if (chip.type === 'away') remove(selectedAwayClubs);
  else if (chip.type === 'tourn') remove(selectedTournaments);
  else if (chip.type === 'group') remove(selectedGroups);
  else if (chip.type === 'stad') remove(selectedStadiums);
  loadMatches();
}

// Build tabs only for days that have matches after filters (up to daysCount)
const dayTabs = computed(() => {
  const counts = new Map();
  const attention = new Map();
  (filteredAll.value || []).forEach((m) => {
    const k = toDayKey(m.date, MOSCOW_TZ);
    counts.set(k, (counts.get(k) || 0) + 1);
    // Frontend attention: not agreed AND (pending OR < 10 дней)
    const alias = (m?.status?.alias || '').toUpperCase();
    const schedulable = !['CANCELLED', 'FINISHED', 'LIVE'].includes(alias);
    const agreed = Boolean(m?.agreement_accepted);
    const pending = Boolean(m?.agreement_pending);
    const diffMs = new Date(m?.date || '').getTime() - Date.now();
    const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
    const soon = isFinite(diffMs) && diffMs >= 0 && diffMs < tenDaysMs;
    const needsAttention = schedulable && !agreed && (pending || soon);
    if (needsAttention) attention.set(k, (attention.get(k) || 0) + 1);
  });
  const keys = [...counts.keys()].sort((a, b) => a - b).slice(0, daysCount);
  const todayKey = toDayKey(new Date(), MOSCOW_TZ);
  return keys.map((k) => {
    const offset = (k - todayKey) / (24 * 60 * 60 * 1000);
    const d = new Date(k);
    const c = counts.get(k) || 0;
    const badge = attention.get(k) || 0;
    const { line1, line2 } = formatTabLines(d, offset, c);
    return { key: k, label: line1, subLabel: line2, badge };
  });
});

// no need for count helper; counts computed within dayTabs

const filteredDayItems = computed(() => {
  if (!activeDayKey.value) return [];
  return (filteredAll.value || []).filter(
    (m) => toDayKey(m.date, MOSCOW_TZ) === activeDayKey.value
  );
});

const selectedDayCount = computed(() => filteredDayItems.value.length);

// Options for selects
const homeClubOptions = computed(() =>
  Array.from(
    new Set((matches.value || []).map((m) => m.home_club).filter(Boolean))
  ).sort((a, b) =>
    String(a).localeCompare(String(b), 'ru', { sensitivity: 'base' })
  )
);
const awayClubOptions = computed(() =>
  Array.from(
    new Set((matches.value || []).map((m) => m.away_club).filter(Boolean))
  ).sort((a, b) =>
    String(a).localeCompare(String(b), 'ru', { sensitivity: 'base' })
  )
);
const tournamentOptions = computed(() =>
  Array.from(
    new Set((matches.value || []).map((m) => m.tournament).filter(Boolean))
  ).sort((a, b) =>
    String(a).localeCompare(String(b), 'ru', { sensitivity: 'base' })
  )
);
const groupOptions = computed(() => {
  const sels = selectedTournaments.value || [];
  const base = sels.length
    ? (matches.value || []).filter((m) => sels.includes(m.tournament))
    : matches.value || [];
  return Array.from(new Set(base.map((m) => m.group).filter(Boolean))).sort(
    (a, b) => String(a).localeCompare(String(b), 'ru', { sensitivity: 'base' })
  );
});
// For modal: depend on draft.tournament to filter group options live
const groupOptionsModal = computed(() => {
  const sels = draft.tournaments || [];
  const base = sels.length
    ? (matches.value || []).filter((m) => sels.includes(m.tournament))
    : matches.value || [];
  return Array.from(new Set(base.map((m) => m.group).filter(Boolean))).sort(
    (a, b) => String(a).localeCompare(String(b), 'ru', { sensitivity: 'base' })
  );
});
const stadiumOptions = computed(() =>
  Array.from(
    new Set((matches.value || []).map((m) => m.stadium).filter(Boolean))
  ).sort((a, b) =>
    String(a).localeCompare(String(b), 'ru', { sensitivity: 'base' })
  )
);

function resetFilters() {
  search.value = '';
  selectedHomeClubs.value = [];
  selectedAwayClubs.value = [];
  selectedTournaments.value = [];
  selectedGroups.value = [];
  selectedStadiums.value = [];
  // no status reset needed
}

// Keep dependent filter values valid when higher-level filter changes
watchEffect(() => {
  selectedGroups.value = (selectedGroups.value || []).filter((g) =>
    groupOptions.value.includes(g)
  );
  // Active day must be valid after filters; if not, select first tab
  const keys = dayTabs.value.map((t) => t.key);
  if (!keys.includes(activeDayKey.value)) {
    activeDayKey.value = keys[0] ?? null;
  }
});

// Debounced fetch for header search input
let searchTimer;
watchEffect(() => {
  const q = (search.value || '').trim();
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(
    () => {
      // Keep filters as-is; only refresh data based on new query
      loadMatches();
    },
    q ? 300 : 0
  );
});

function formatTabLines(date, offset, _count) {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TZ,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
    .formatToParts(date)
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  const wd = (parts.weekday || '').replace('.', '');
  const ddmm = `${parts.day} ${parts.month}`;
  if (offset === 0) return { line1: ddmm, line2: 'Сегодня' };
  if (offset === 1) return { line1: ddmm, line2: 'Завтра' };
  return { line1: ddmm, line2: wd };
}
</script>

<template>
  <div class="py-3">
    <div class="container">
      <nav aria-label="breadcrumb">
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
      <div class="d-flex align-items-center mb-3 gap-2 flex-wrap header-row">
        <h1 class="mb-0 me-2 flex-shrink-0">Календарь игр</h1>
        <div class="flex-grow-1 min-w-0">
          <input
            v-model="search"
            type="text"
            class="form-control form-control-sm w-100"
            placeholder="Поиск по командам, клубам, соревнованиям, стадионам"
            aria-label="Поиск по матчам"
          />
        </div>
        <div class="d-flex align-items-center gap-2 flex-shrink-0">
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
          <div
            class="d-none d-md-flex flex-wrap align-items-center gap-1 chip-inline"
          >
            <span
              v-for="chip in activeFilterChips"
              :key="chip.key"
              class="badge bg-light text-muted border chip-badge"
              role="button"
              tabindex="0"
              :aria-label="`Удалить фильтр ${chip.label}`"
              @click="removeHeaderChip(chip)"
              @keydown.enter.prevent="removeHeaderChip(chip)"
            >
              {{ chip.label }}
              <i class="bi bi-x-lg ms-1" aria-hidden="true"></i>
            </span>
          </div>
        </div>
      </div>

      <div class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <div class="mb-2">
            <TabSelector
              v-model="activeDayKey"
              :tabs="dayTabs"
              :aria-label="'Дни календаря'"
              :nav-fill="false"
              justify="center"
            />
          </div>

          <div
            v-if="!dayTabs.length"
            class="alert alert-light border small mb-3"
            role="status"
            aria-live="polite"
          >
            Нет матчей по выбранным фильтрам в ближайшие 10 игровых дней.
          </div>

          <div v-if="error" class="alert alert-danger">{{ error }}</div>
          <div v-else-if="loading" class="text-center py-3">
            <div class="spinner-border spinner-brand" role="status"></div>
          </div>
          <template v-else>
            <div class="d-flex justify-content-end align-items-center mb-2">
              <span class="text-muted small" aria-live="polite"
                >Всего: {{ selectedDayCount }}</span
              >
            </div>
            <MatchesDayTiles
              :items="filteredDayItems"
              :show-actions="true"
              :show-day-header="false"
              :no-scroll="true"
              :details-base="'/admin/matches'"
            />
            <p v-if="!filteredDayItems.length" class="mb-0">
              На выбранный день матчей нет.
            </p>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- Filters Modal -->
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
                  <option v-for="c in homeClubOptions" :key="c" :value="c">
                    {{ c }}
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
                  v-for="v in draft.homeClubs"
                  :key="'h-' + v"
                  class="badge bg-light text-muted border"
                  role="button"
                  tabindex="0"
                  :aria-label="`Удалить фильтр Хозяин: ${v}`"
                  @click="removeHome(v)"
                  @keydown.enter.prevent="removeHome(v)"
                >
                  {{ v }} <i class="bi bi-x-lg ms-1" aria-hidden="true"></i>
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
                  <option v-for="c in awayClubOptions" :key="c" :value="c">
                    {{ c }}
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
                  v-for="v in draft.awayClubs"
                  :key="'a-' + v"
                  class="badge bg-light text-muted border"
                  role="button"
                  tabindex="0"
                  :aria-label="`Удалить фильтр Гость: ${v}`"
                  @click="removeAway(v)"
                  @keydown.enter.prevent="removeAway(v)"
                >
                  {{ v }} <i class="bi bi-x-lg ms-1" aria-hidden="true"></i>
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
                  <option v-for="t in tournamentOptions" :key="t" :value="t">
                    {{ t }}
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
                  v-for="v in draft.tournaments"
                  :key="'t-' + v"
                  class="badge bg-light text-muted border"
                  role="button"
                  tabindex="0"
                  :aria-label="`Удалить фильтр Соревнование: ${v}`"
                  @click="removeTournament(v)"
                  @keydown.enter.prevent="removeTournament(v)"
                >
                  {{ v }} <i class="bi bi-x-lg ms-1" aria-hidden="true"></i>
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
                  <option v-for="g in groupOptionsModal" :key="g" :value="g">
                    {{ g }}
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
                  v-for="v in draft.groups"
                  :key="'g-' + v"
                  class="badge bg-light text-muted border"
                  role="button"
                  tabindex="0"
                  :aria-label="`Удалить фильтр Группа: ${v}`"
                  @click="removeGroup(v)"
                  @keydown.enter.prevent="removeGroup(v)"
                >
                  {{ v }} <i class="bi bi-x-lg ms-1" aria-hidden="true"></i>
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
                  <option v-for="s in stadiumOptions" :key="s" :value="s">
                    {{ s }}
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
                  v-for="v in draft.stadiums"
                  :key="'s-' + v"
                  class="badge bg-light text-muted border"
                  role="button"
                  tabindex="0"
                  :aria-label="`Удалить фильтр Стадион: ${v}`"
                  @click="removeStadium(v)"
                  @keydown.enter.prevent="removeStadium(v)"
                >
                  {{ v }} <i class="bi bi-x-lg ms-1" aria-hidden="true"></i>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            @click="resetDraft"
          >
            Сбросить
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
@media (max-width: 575.98px) {
  .header-row {
    flex-direction: column;
    align-items: stretch;
  }
  .header-row h1 {
    margin-bottom: 0.25rem !important;
  }
  .header-row .btn {
    align-self: flex-end;
  }
}
.header-row .form-control {
  min-width: 180px;
}
</style>
