<script setup>
import { ref, onMounted, computed, watch, reactive } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { RouterLink } from 'vue-router';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import { apiFetch } from '../api.js';
import MatchesDayTiles from '../components/MatchesDayTiles.vue';
import PageNav from '../components/PageNav.vue';
import { loadPageSize, savePageSize } from '../utils/pageSize.js';

const matches = ref([]);
const loading = ref(false);
const error = ref('');
// External availability banner was removed for mobile in favor of local source of truth
const activeTab = ref('home'); // 'home' | 'away'
const search = ref('');
let searchTimer;
const debouncedSearch = ref('');
const selectedTournament = ref('');
const selectedGroup = ref('');
const selectedTour = ref('');
const filtersModalRef = ref(null);
let filtersModal;
const draft = reactive({ tournament: '', group: '', tour: '' });
const activeFiltersCount = computed(() => {
  let n = 0;
  if (selectedTournament.value) n += 1;
  if (selectedGroup.value) n += 1;
  if (selectedTour.value) n += 1;
  return n;
});

// Pagination state
const homePage = ref(1);
const awayPage = ref(1);
const pageSize = ref(loadPageSize('schoolMatchesPageSize', 20));

onMounted(load);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [homeRes, awayRes] = await Promise.all([
      apiFetch('/matches/upcoming?source=local&type=home&all=true'),
      apiFetch('/matches/upcoming?source=local&type=away&all=true'),
    ]);
    const home = Array.isArray(homeRes.matches) ? homeRes.matches : [];
    const away = Array.isArray(awayRes.matches) ? awayRes.matches : [];
    matches.value = [...home, ...away];
    resetFilters();
  } catch (e) {
    error.value = e.message || 'Не удалось загрузить данные';
  } finally {
    loading.value = false;
  }
}

// Fallback: if server doesn't provide is_home, show all in 'Домашние'
const homeMatches = computed(() =>
  matches.value.filter((m) => m.is_home !== false)
);
const awayMatches = computed(() =>
  matches.value.filter((m) => m.is_home === false)
);

const filteredHome = computed(() => filterByQuery(homeMatches.value));
const filteredAway = computed(() => filterByQuery(awayMatches.value));

// Attention indicators for tabs (pending or urgent agreements)
function needsAttention(m) {
  const alias = (m?.status?.alias || '').toUpperCase();
  const schedulable = !['CANCELLED', 'FINISHED', 'LIVE'].includes(alias);
  const agreed = Boolean(m?.agreement_accepted);
  if (!schedulable || agreed) return false;
  const diffMs = new Date(m?.date || '').getTime() - Date.now();
  const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
  const urgent = isFinite(diffMs) && diffMs >= 0 && diffMs < tenDaysMs;
  const pending = Boolean(m?.agreement_pending);
  return urgent || pending;
}

const attentionCountHome = computed(() =>
  homeMatches.value.reduce((acc, m) => acc + (needsAttention(m) ? 1 : 0), 0)
);
const attentionCountAway = computed(() =>
  awayMatches.value.reduce((acc, m) => acc + (needsAttention(m) ? 1 : 0), 0)
);
const attentionBadgeHome = computed(() =>
  attentionCountHome.value > 99 ? '99+' : String(attentionCountHome.value)
);
const attentionBadgeAway = computed(() =>
  attentionCountAway.value > 99 ? '99+' : String(attentionCountAway.value)
);

const totalHomePages = computed(() =>
  Math.max(1, Math.ceil(filteredHome.value.length / pageSize.value))
);
const totalAwayPages = computed(() =>
  Math.max(1, Math.ceil(filteredAway.value.length / pageSize.value))
);

const paginatedHome = computed(() => {
  const start = (homePage.value - 1) * pageSize.value;
  return filteredHome.value.slice(start, start + pageSize.value);
});
const paginatedAway = computed(() => {
  const start = (awayPage.value - 1) * pageSize.value;
  return filteredAway.value.slice(start, start + pageSize.value);
});

// Entire list is shown; pagination removed in favor of grouped tiles

function filterByQuery(list) {
  const q = (debouncedSearch.value || '').trim().toLowerCase();
  let res = list;
  if (q) {
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
        norm(m.tournament),
        norm(m.group),
        norm(m.tour),
      ];
      return tokens.every((t) => fields.some((f) => fuzzyIncludes(f, t)));
    }
    res = res.filter(matchesItem);
  }
  if (selectedTournament.value) {
    res = res.filter((m) => (m.tournament || '') === selectedTournament.value);
  }
  if (selectedGroup.value) {
    res = res.filter((m) => (m.group || '') === selectedGroup.value);
  }
  if (selectedTour.value) {
    res = res.filter((m) => (m.tour || '') === selectedTour.value);
  }
  return res;
}

// Reset dependent state
function resetFilters() {
  selectedTournament.value = '';
  selectedGroup.value = '';
  selectedTour.value = '';
  homePage.value = 1;
  awayPage.value = 1;
}

const baseForOptions = computed(() =>
  activeTab.value === 'home' ? homeMatches.value : awayMatches.value
);
const tournamentOptions = computed(() => {
  const set = Array.from(
    new Set(baseForOptions.value.map((m) => m.tournament).filter(Boolean))
  );
  return set.sort((a, b) =>
    String(a).localeCompare(String(b), 'ru', { sensitivity: 'base' })
  );
});
const groupOptions = computed(() => {
  const withinTournament = selectedTournament.value
    ? baseForOptions.value.filter(
        (m) => m.tournament === selectedTournament.value
      )
    : baseForOptions.value;
  const set = Array.from(
    new Set(withinTournament.map((m) => m.group).filter(Boolean))
  );
  return set.sort((a, b) =>
    String(a).localeCompare(String(b), 'ru', { sensitivity: 'base' })
  );
});
const tourOptions = computed(() => {
  const withinGroup = selectedGroup.value
    ? baseForOptions.value.filter(
        (m) =>
          (selectedTournament.value
            ? m.tournament === selectedTournament.value
            : true) && m.group === selectedGroup.value
      )
    : selectedTournament.value
      ? baseForOptions.value.filter(
          (m) => m.tournament === selectedTournament.value
        )
      : baseForOptions.value;
  const unique = Array.from(
    new Set(withinGroup.map((m) => m.tour).filter(Boolean))
  );
  const parseLeadingNumber = (s) => {
    if (!s) return { has: false, n: 0 };
    const m = String(s)
      .trim()
      .match(/^(\d{1,4})/);
    return m ? { has: true, n: Number(m[1]) } : { has: false, n: 0 };
  };
  return unique.sort((a, b) => {
    const A = parseLeadingNumber(a);
    const B = parseLeadingNumber(b);
    if (A.has && B.has) return A.n - B.n;
    if (A.has) return -1;
    if (B.has) return 1;
    return String(a).localeCompare(String(b), 'ru');
  });
});

// Keep dependent filter values valid when higher-level filter or tab changes
watch([activeTab, selectedTournament], () => {
  if (
    selectedGroup.value &&
    !groupOptions.value.includes(selectedGroup.value)
  ) {
    selectedGroup.value = '';
  }
  if (selectedTour.value && !tourOptions.value.includes(selectedTour.value)) {
    selectedTour.value = '';
  }
});
watch([activeTab, selectedGroup], () => {
  if (selectedTour.value && !tourOptions.value.includes(selectedTour.value)) {
    selectedTour.value = '';
  }
});

// Reset page on filters/search change
watch([search, selectedTournament, selectedGroup, selectedTour], () => {
  homePage.value = 1;
  awayPage.value = 1;
});

// Debounce search input for smoother UX
watch(
  search,
  (val) => {
    if (searchTimer) clearTimeout(searchTimer);
    const q = (val || '').toString();
    searchTimer = setTimeout(
      () => {
        debouncedSearch.value = q;
      },
      q.trim() ? 200 : 0
    );
  },
  { immediate: true }
);

// Clamp pages when filtered count or page size changes
watch([filteredHome, pageSize], () => {
  const total = totalHomePages.value;
  if (homePage.value > total) homePage.value = total;
  if (homePage.value < 1) homePage.value = 1;
});
watch([filteredAway, pageSize], () => {
  const total = totalAwayPages.value;
  if (awayPage.value > total) awayPage.value = total;
  if (awayPage.value < 1) awayPage.value = 1;
});

function onChangePageSize(val) {
  pageSize.value = val;
  savePageSize('schoolMatchesPageSize', val);
  homePage.value = 1;
  awayPage.value = 1;
}

function openFilters() {
  draft.tournament = selectedTournament.value || '';
  draft.group = selectedGroup.value || '';
  draft.tour = selectedTour.value || '';
  if (!filtersModal) filtersModal = new Modal(filtersModalRef.value);
  filtersModal.show();
}
function applyFilters() {
  selectedTournament.value = draft.tournament || '';
  selectedGroup.value = draft.group || '';
  selectedTour.value = draft.tour || '';
  homePage.value = 1;
  awayPage.value = 1;
  filtersModal?.hide();
}
function resetDraft() {
  draft.tournament = '';
  draft.group = '';
  draft.tour = '';
}
</script>

<template>
  <div class="py-3 school-matches-page">
    <div class="container">
      <Breadcrumbs
        :items="[
          { label: 'Главная', to: '/' },
          { label: 'Управление спортивной школой', disabled: true },
          { label: 'Матчи' },
        ]"
      />
      <h1 class="mb-3">Ближайшие матчи</h1>

      <!-- External DB banner hidden: we use local schedule as the source of truth -->

      <div class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body">
          <ul class="nav nav-pills nav-fill mb-0 tab-selector" role="tablist">
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: activeTab === 'home' }"
                role="tab"
                :aria-selected="activeTab === 'home'"
                @click="activeTab = 'home'"
              >
                Домашние матчи
                <span
                  v-if="attentionCountHome"
                  class="notif-badge"
                  :title="attentionBadgeHome"
                  aria-hidden="true"
                >
                  {{ attentionBadgeHome }}
                </span>
                <span v-if="attentionCountHome" class="visually-hidden">{{
                  attentionBadgeHome
                }}</span>
              </button>
            </li>
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: activeTab === 'away' }"
                role="tab"
                :aria-selected="activeTab === 'away'"
                @click="activeTab = 'away'"
              >
                Матчи на выезде
                <span
                  v-if="attentionCountAway"
                  class="notif-badge"
                  :title="attentionBadgeAway"
                  aria-hidden="true"
                >
                  {{ attentionBadgeAway }}
                </span>
                <span v-if="attentionCountAway" class="visually-hidden">{{
                  attentionBadgeAway
                }}</span>
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <!-- Sticky controls on mobile: search, filters, toggle -->
          <div class="sticky-controls">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <div class="flex-grow-1 min-w-0">
                <input
                  v-model="search"
                  type="text"
                  class="form-control form-control-sm w-100"
                  placeholder="Поиск по командам/турниру/группе/туру"
                  aria-label="Поиск"
                />
              </div>
              <div class="flex-shrink-0 d-flex align-items-center gap-2">
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
            <!-- Active filter chips -->
            <div
              v-if="selectedTournament || selectedGroup || selectedTour"
              class="filter-chips mt-2"
            >
              <span v-if="selectedTournament" class="chip">
                {{ selectedTournament }}
                <button
                  type="button"
                  class="btn-close btn-close-sm"
                  aria-label="Сбросить фильтр соревнования"
                  @click="selectedTournament = ''"
                ></button>
              </span>
              <span v-if="selectedGroup" class="chip">
                {{ selectedGroup }}
                <button
                  type="button"
                  class="btn-close btn-close-sm"
                  aria-label="Сбросить фильтр группы"
                  @click="selectedGroup = ''"
                ></button>
              </span>
              <span v-if="selectedTour" class="chip">
                {{ selectedTour }}
                <button
                  type="button"
                  class="btn-close btn-close-sm"
                  aria-label="Сбросить фильтр тура"
                  @click="selectedTour = ''"
                ></button>
              </span>
            </div>
            <div class="visually-hidden" aria-live="polite">
              Показано
              {{
                activeTab === 'home' ? filteredHome.length : filteredAway.length
              }}
              матчей
            </div>
          </div>

          <div class="legend small text-muted mb-3" aria-label="Обозначения">
            <span class="legend-item">
              <span class="pill status-pill pill-success">По расписанию</span>
            </span>
            <span class="legend-item">
              <span class="pill status-pill pill-muted"
                >Согласование времени</span
              >
            </span>
            <span class="legend-item">
              <span class="pill status-pill pill-warning"
                >Согласуйте время</span
              >
              <span class="ms-1">(до матча &lt; 10 дней или есть заявка)</span>
            </span>
          </div>

          <div v-if="error" class="alert alert-danger">{{ error }}</div>
          <div v-if="loading" class="py-2">
            <!-- Lightweight skeleton for better perceived performance on mobile -->
            <div class="skeleton-line mb-2" style="width: 60%"></div>
            <div class="skeleton-line mb-2" style="width: 85%"></div>
            <div class="skeleton-line mb-2" style="width: 72%"></div>
            <div class="skeleton-line mb-2" style="width: 90%"></div>
          </div>

          <template v-else>
            <div v-show="activeTab === 'home'">
              <MatchesDayTiles :items="paginatedHome" mobile-style="divider" />
              <p v-if="!filteredHome.length" class="mb-0">
                Нет домашних матчей.
              </p>
              <PageNav
                v-if="filteredHome.length > 0"
                v-model:page="homePage"
                :total-pages="totalHomePages"
                :page-size="pageSize"
                @update:page-size="onChangePageSize"
              />
            </div>
            <div v-show="activeTab === 'away'">
              <MatchesDayTiles :items="paginatedAway" mobile-style="divider" />
              <p v-if="!filteredAway.length" class="mb-0">
                Нет матчей на выезде.
              </p>
              <PageNav
                v-if="filteredAway.length > 0"
                v-model:page="awayPage"
                :total-pages="totalAwayPages"
                :page-size="pageSize"
                @update:page-size="onChangePageSize"
              />
            </div>
          </template>
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
          class="modal-dialog modal-dialog-scrollable modal-fullscreen-sm-down"
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
                <div class="col-12">
                  <label class="form-label small text-muted" for="f-tourn"
                    >Соревнование</label
                  >
                  <select
                    id="f-tourn"
                    v-model="draft.tournament"
                    class="form-select"
                  >
                    <option value="">Все соревнования</option>
                    <option v-for="t in tournamentOptions" :key="t" :value="t">
                      {{ t }}
                    </option>
                  </select>
                </div>
                <div class="col-12">
                  <label class="form-label small text-muted" for="f-group"
                    >Группа</label
                  >
                  <select
                    id="f-group"
                    v-model="draft.group"
                    class="form-select"
                  >
                    <option value="">Все группы</option>
                    <option v-for="g in groupOptions" :key="g" :value="g">
                      {{ g }}
                    </option>
                  </select>
                </div>
                <div class="col-12">
                  <label class="form-label small text-muted" for="f-tour"
                    >Тур</label
                  >
                  <select id="f-tour" v-model="draft.tour" class="form-select">
                    <option value="">Все туры</option>
                    <option v-for="tr in tourOptions" :key="tr" :value="tr">
                      {{ tr }}
                    </option>
                  </select>
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
              <button
                type="button"
                class="btn btn-primary"
                @click="applyFilters"
              >
                Применить
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default { name: 'SchoolMatchesView' };
</script>

<style scoped>
/* Mobile paddings and gutters use global styles */

.sticky-controls {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #fff;
  /* subtle divider to distinguish from content while scrolling */
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
}

.filter-chips {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.filter-chips .chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  background: #f8f9fa;
  font-size: 0.875rem;
}
.filter-chips .btn-close-sm {
  width: 0.65rem;
  height: 0.65rem;
}

.legend {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}
.legend-dot {
  width: 0.85rem;
  height: 0.85rem;
  display: inline-block;
  border-radius: 3px;
  border-color: var(--border-subtle) !important;
}

/* Local pill samples for legend (scoped) */
.legend .pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  font-size: 0.875rem;
}
.legend .status-pill.pill-success {
  background: var(--bs-success-bg-subtle, #d1e7dd);
  color: var(--bs-success-text, #0f5132);
  border-color: rgba(25, 135, 84, 0.35);
}
.legend .status-pill.pill-muted {
  background: #f1f3f5;
  color: #495057;
}
.legend .status-pill.pill-warning {
  background: var(--bs-warning-bg-subtle, #fff3cd);
  color: var(--bs-warning-text, #664d03);
  border-color: rgba(255, 193, 7, 0.35);
}
</style>
