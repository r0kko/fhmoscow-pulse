<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import { apiFetch } from '../api';
import MatchesDayTiles from '../components/MatchesDayTiles.vue';
import PageNav from '../components/PageNav.vue';
import { loadPageSize, savePageSize } from '../utils/pageSize';
import { toDayKey } from '../utils/time';

const matches = ref([]);
const loading = ref(false);
const error = ref('');
const search = ref('');
const selectedTournament = ref('');
const selectedGroup = ref('');
const selectedTour = ref('');
const seasons = ref([]);
const selectedSeason = ref('');
// Filters modal state (mobile)
const filtersModalRef = ref(null);
let filtersModal;
const draft = reactive({
  season: '',
  search: '',
  tournament: '',
  group: '',
  tour: '',
});

// Active filters count (exclude free-text search)
const activeFiltersCount = computed(() => {
  let n = 0;
  if (selectedSeason.value) n += 1;
  if (selectedTournament.value) n += 1;
  if (selectedGroup.value) n += 1;
  if (selectedTour.value) n += 1;
  return n;
});

// Pagination state
const page = ref(1);
const pageSize = ref(loadPageSize('schoolPastMatchesPageSize', 20));

onMounted(init);

async function init() {
  try {
    const [activeRes, listRes] = await Promise.all([
      apiFetch('/seasons/active'),
      apiFetch('/seasons?limit=1000&page=1'),
    ]);
    seasons.value = Array.isArray(listRes.seasons) ? listRes.seasons : [];
    const activeSeason = activeRes?.season || null;
    if (activeSeason?.id) selectedSeason.value = activeSeason.id;
  } catch (_e) {
    seasons.value = [];
  } finally {
    await load();
  }
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const params = selectedSeason.value
      ? `&season_id=${encodeURIComponent(selectedSeason.value)}`
      : '';
    const res = await apiFetch(`/matches/past?source=local&all=true${params}`);
    matches.value = Array.isArray(res.matches) ? res.matches : [];
    resetFilters();
  } catch (e) {
    error.value = e.message || 'Не удалось загрузить данные';
  } finally {
    loading.value = false;
  }
}

const filtered = computed(() => filterByQuery(matches.value));
// Global sort for stable pagination: days DESC, time ASC within day
const sorted = computed(() => {
  const arr = [...filtered.value];
  arr.sort((a, b) => {
    const da = toDayKey(a.date);
    const db = toDayKey(b.date);
    if (db !== da) return db - da; // newer day first
    return new Date(a.date) - new Date(b.date); // within-day ascending
  });
  return arr;
});
const totalPages = computed(() =>
  Math.max(1, Math.ceil(sorted.value.length / pageSize.value))
);
const paginated = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return sorted.value.slice(start, start + pageSize.value);
});

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
  if (selectedTournament.value)
    res = res.filter((m) => (m.tournament || '') === selectedTournament.value);
  if (selectedGroup.value)
    res = res.filter((m) => (m.group || '') === selectedGroup.value);
  if (selectedTour.value)
    res = res.filter((m) => (m.tour || '') === selectedTour.value);
  return res;
}

function resetFilters() {
  selectedTournament.value = '';
  selectedGroup.value = '';
  selectedTour.value = '';
  page.value = 1;
}

function openFilters() {
  // Init draft with current filters
  draft.season = selectedSeason.value || '';
  draft.search = search.value || '';
  draft.tournament = selectedTournament.value || '';
  draft.group = selectedGroup.value || '';
  draft.tour = selectedTour.value || '';
  if (!filtersModal) filtersModal = new Modal(filtersModalRef.value);
  filtersModal.show();
}

function applyFilters() {
  selectedSeason.value = draft.season || '';
  search.value = draft.search || '';
  selectedTournament.value = draft.tournament || '';
  selectedGroup.value = draft.group || '';
  selectedTour.value = draft.tour || '';
  page.value = 1;
  load();
  filtersModal?.hide();
}

function resetDraft() {
  draft.season = '';
  draft.search = '';
  draft.tournament = '';
  draft.group = '';
  draft.tour = '';
}

const tournamentOptions = computed(() => {
  const set = Array.from(
    new Set(matches.value.map((m) => m.tournament).filter(Boolean))
  );
  return set.sort((a, b) =>
    String(a).localeCompare(String(b), 'ru', { sensitivity: 'base' })
  );
});
const groupOptions = computed(() => {
  const withinTournament = selectedTournament.value
    ? matches.value.filter((m) => m.tournament === selectedTournament.value)
    : matches.value;
  const set = Array.from(
    new Set(withinTournament.map((m) => m.group).filter(Boolean))
  );
  return set.sort((a, b) =>
    String(a).localeCompare(String(b), 'ru', { sensitivity: 'base' })
  );
});
const tourOptions = computed(() => {
  const withinGroup = selectedGroup.value
    ? matches.value.filter(
        (m) =>
          (selectedTournament.value
            ? m.tournament === selectedTournament.value
            : true) && m.group === selectedGroup.value
      )
    : selectedTournament.value
      ? matches.value.filter((m) => m.tournament === selectedTournament.value)
      : matches.value;
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

watch([selectedTournament], () => {
  if (selectedGroup.value && !groupOptions.value.includes(selectedGroup.value))
    selectedGroup.value = '';
  if (selectedTour.value && !tourOptions.value.includes(selectedTour.value))
    selectedTour.value = '';
});
watch([selectedGroup], () => {
  if (selectedTour.value && !tourOptions.value.includes(selectedTour.value))
    selectedTour.value = '';
});

watch(
  [search, selectedTournament, selectedGroup, selectedTour, selectedSeason],
  () => {
    page.value = 1;
  }
);

function onChangePageSize(val) {
  pageSize.value = val;
  savePageSize('schoolPastMatchesPageSize', val);
  page.value = 1;
}
</script>

<template>
  <div class="py-3 school-matches-page">
    <div class="container">
      <Breadcrumbs
        :items="[
          { label: 'Главная', to: '/' },
          { label: 'Управление спортивной школой', disabled: true },
          { label: 'Прошедшие матчи' },
        ]"
      />
      <h1 class="mb-3">Прошедшие матчи</h1>

      <!-- Removed home/away separation: unified past matches list -->

      <div class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <!-- Sticky controls on mobile: search + filters -->
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
              <div class="flex-shrink-0">
                <button
                  class="btn btn-outline-secondary btn-sm"
                  type="button"
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
              v-if="
                selectedSeason ||
                selectedTournament ||
                selectedGroup ||
                selectedTour
              "
              class="filter-chips mt-2"
            >
              <span v-if="selectedSeason" class="chip">
                {{
                  seasons.find(
                    (seasonOption) =>
                      String(seasonOption.id) === String(selectedSeason)
                  )?.name || 'Сезон'
                }}
                <button
                  type="button"
                  class="btn-close btn-close-sm"
                  aria-label="Сбросить фильтр сезона"
                  @click="
                    selectedSeason = '';
                    load();
                  "
                ></button>
              </span>
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
              Показано {{ filtered.length }} матчей
            </div>
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
            <MatchesDayTiles
              :items="paginated"
              :show-score-as-column="true"
              sort-direction="desc"
            />
            <p v-if="!filtered.length" class="mb-0">Нет матчей.</p>
            <PageNav
              v-if="filtered.length > 0"
              v-model:page="page"
              :total-pages="totalPages"
              :page-size="pageSize"
              @update:page-size="onChangePageSize"
            />
          </template>
        </div>
      </div>

      <!-- Filters Modal (mobile) -->
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
                  <label class="form-label small text-muted" for="m-season"
                    >Сезон</label
                  >
                  <select
                    id="m-season"
                    v-model="draft.season"
                    class="form-select"
                  >
                    <option value="">Все сезоны</option>
                    <option v-for="s in seasons" :key="s.id" :value="s.id">
                      {{ s.active ? `${s.name} (текущий)` : s.name }}
                    </option>
                  </select>
                </div>
                <div class="col-12">
                  <label class="form-label small text-muted" for="m-search"
                    >Поиск</label
                  >
                  <input
                    id="m-search"
                    v-model="draft.search"
                    type="text"
                    class="form-control"
                    placeholder="Команды/турнир/группа/тур"
                  />
                </div>
                <div class="col-12">
                  <label class="form-label small text-muted" for="m-tourn"
                    >Соревнование</label
                  >
                  <select
                    id="m-tourn"
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
                  <label class="form-label small text-muted" for="m-group"
                    >Группа</label
                  >
                  <select
                    id="m-group"
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
                  <label class="form-label small text-muted" for="m-tour"
                    >Тур</label
                  >
                  <select id="m-tour" v-model="draft.tour" class="form-select">
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
export default { name: 'SchoolPastMatchesView' };
</script>

<style scoped>
/* Mobile spacing handled globally */

.sticky-controls {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #fff;
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
</style>
