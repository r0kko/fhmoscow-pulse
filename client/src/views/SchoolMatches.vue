<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import MatchesDayTiles from '../components/MatchesDayTiles.vue';
import PageNav from '../components/PageNav.vue';
import { loadPageSize, savePageSize } from '../utils/pageSize.js';

const matches = ref([]);
const loading = ref(false);
const error = ref('');
const extUnavailable = ref(false);
const activeTab = ref('home'); // 'home' | 'away'
const search = ref('');
const selectedTournament = ref('');
const selectedGroup = ref('');
const selectedTour = ref('');

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
    // When we explicitly force local source, do not surface external availability banner
    extUnavailable.value = false;
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
  const q = search.value.trim().toLowerCase();
  let res = list;
  if (q) {
    res = res.filter((m) => {
      const t1 = (m.team1 || '').toLowerCase();
      const t2 = (m.team2 || '').toLowerCase();
      const tourn = (m.tournament || '').toLowerCase();
      const group = (m.group || '').toLowerCase();
      const tour = (m.tour || '').toLowerCase();
      return (
        t1.includes(q) ||
        t2.includes(q) ||
        tourn.includes(q) ||
        group.includes(q) ||
        tour.includes(q)
      );
    });
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
</script>

<template>
  <div class="py-3 school-matches-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/">Главная</RouterLink>
          </li>
          <li class="breadcrumb-item">Управление спортивной школой</li>
          <li class="breadcrumb-item active" aria-current="page">
            Ближайшие матчи
          </li>
        </ol>
      </nav>
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
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <div class="row g-2 align-items-end mb-3">
            <div class="col-12 col-md-4">
              <input
                v-model="search"
                type="text"
                class="form-control form-control-sm"
                placeholder="Поиск по командам/турниру/группе/туру"
                aria-label="Поиск"
              />
            </div>
            <div class="col-12 col-md-3">
              <select
                v-model="selectedTournament"
                class="form-select form-select-sm"
                aria-label="Фильтр по соревнованию"
              >
                <option value="">Все соревнования</option>
                <option v-for="t in tournamentOptions" :key="t" :value="t">
                  {{ t }}
                </option>
              </select>
            </div>
            <div class="col-12 col-md-2">
              <select
                v-model="selectedGroup"
                class="form-select form-select-sm"
                aria-label="Фильтр по группе"
              >
                <option value="">Все группы</option>
                <option v-for="g in groupOptions" :key="g" :value="g">
                  {{ g }}
                </option>
              </select>
            </div>
            <div class="col-12 col-md-2">
              <select
                v-model="selectedTour"
                class="form-select form-select-sm"
                aria-label="Фильтр по туру"
              >
                <option value="">Все туры</option>
                <option v-for="tr in tourOptions" :key="tr" :value="tr">
                  {{ tr }}
                </option>
              </select>
            </div>
            <div class="col-12 col-md-1">
              <button
                class="btn btn-outline-secondary btn-sm w-100"
                @click="resetFilters"
              >
                Сбросить
              </button>
            </div>
          </div>

          <div class="legend small text-muted mb-3" aria-label="Обозначения">
            <span class="legend-item">
              <span class="legend-dot bg-success-subtle border"></span>
              Согласован
            </span>
            <span class="legend-item">
              <span class="legend-dot bg-warning-subtle border"></span>
              Ожидает согласования
            </span>
            <span class="legend-item">
              <span class="legend-dot bg-danger-subtle border"></span>
              Менее 7 суток до начала матча
            </span>
          </div>

          <div v-if="error" class="alert alert-danger">{{ error }}</div>
          <div v-if="loading" class="text-center py-3">
            <div class="spinner-border spinner-brand" role="status"></div>
          </div>

          <template v-else>
            <div v-show="activeTab === 'home'">
              <MatchesDayTiles :items="paginatedHome" />
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
              <MatchesDayTiles :items="paginatedAway" />
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
    </div>
  </div>
</template>

<script>
export default { name: 'SchoolMatchesView' };
</script>

<style scoped>
/* Mobile full-bleed gutters like in "Сборы" */
@media (max-width: 575.98px) {
  .school-matches-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
  }
  .section-card {
    margin-left: -1rem;
    margin-right: -1rem;
  }
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
</style>
