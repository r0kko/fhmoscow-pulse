<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import BrandSpinner from '../components/BrandSpinner.vue';
import PageNav from '../components/PageNav.vue';
import BaseTile from '../components/BaseTile.vue';
import { apiFetch } from '../api';
import { loadPageSize, savePageSize } from '../utils/pageSize';

const route = useRoute();
const router = useRouter();

// Tabs: tournaments | stages | groups | teams
const activeTab = ref(route.query.tab || 'tournaments');

// Shared search
const search = ref(route.query.q || '');
const seasonOptions = ref([]);
const selectedSeasonId = ref(String(route.query.season_id || ''));

// Tournaments
const tournaments = ref([]);
const tournamentsTotal = ref(0);
const tournamentsPage = ref(Number(route.query.tp || 1) || 1);
const tournamentsPageSize = ref(loadPageSize('adminTournamentsPageSize', 20));
const tournamentsLoading = ref(false);
const tournamentsError = ref('');
const tournamentsTotalPages = computed(() =>
  Math.max(
    1,
    Math.ceil((tournamentsTotal.value || 0) / tournamentsPageSize.value)
  )
);

// Stages
const stages = ref([]);
const stagesTotal = ref(0);
const stagesPage = ref(Number(route.query.sp || 1) || 1);
const stagesPageSize = ref(loadPageSize('adminStagesPageSize', 20));
const stagesLoading = ref(false);
const stagesError = ref('');
const stagesTotalPages = computed(() =>
  Math.max(1, Math.ceil((stagesTotal.value || 0) / stagesPageSize.value))
);

// Groups
const groups = ref([]);
const groupsTotal = ref(0);
const groupsPage = ref(Number(route.query.gp || 1) || 1);
const groupsPageSize = ref(loadPageSize('adminGroupsPageSize', 20));
const groupsLoading = ref(false);
const groupsError = ref('');
const groupsTotalPages = computed(() =>
  Math.max(1, Math.ceil((groupsTotal.value || 0) / groupsPageSize.value))
);

// Tournament teams
const tt = ref([]);
const ttTotal = ref(0);
const ttPage = ref(Number(route.query.up || 1) || 1);
const ttPageSize = ref(loadPageSize('adminTournamentTeamsPageSize', 20));
const ttLoading = ref(false);
const ttError = ref('');
const ttTotalPages = computed(() =>
  Math.max(1, Math.ceil((ttTotal.value || 0) / ttPageSize.value))
);

function updateQuery() {
  const q = { ...route.query };
  if (search.value) q.q = search.value;
  else delete q.q;
  q.tp = String(tournamentsPage.value);
  if (selectedSeasonId.value) q.season_id = selectedSeasonId.value;
  else delete q.season_id;
  // Remove obsolete params
  delete q.tab;
  delete q.sp;
  delete q.gp;
  delete q.up;
  delete q.gtid;
  delete q.stid;
  delete q.tt_tid;
  delete q.tt_gid;
  router.replace({ query: q });
}

async function loadTournaments() {
  tournamentsLoading.value = true;
  tournamentsError.value = '';
  try {
    const params = new URLSearchParams({
      page: String(tournamentsPage.value),
      limit: String(tournamentsPageSize.value),
    });
    const term = search.value.trim();
    if (term) params.set('search', term);
    if (selectedSeasonId.value) params.set('season_id', selectedSeasonId.value);
    const r = await apiFetch(`/tournaments?${params.toString()}`);
    tournaments.value = r.tournaments || [];
    tournamentsTotal.value = r.total || 0;
  } catch (e) {
    tournaments.value = [];
    tournamentsTotal.value = 0;
    tournamentsError.value = e.message || 'Ошибка загрузки турниров';
  } finally {
    tournamentsLoading.value = false;
  }
}

async function loadStages() {
  stagesLoading.value = true;
  stagesError.value = '';
  try {
    const params = new URLSearchParams({
      page: String(stagesPage.value),
      limit: String(stagesPageSize.value),
    });
    if (selectedTournamentForStages.value)
      params.set('tournament_id', selectedTournamentForStages.value);
    const r = await apiFetch(`/tournaments/stages?${params.toString()}`);
    stages.value = r.stages || [];
    stagesTotal.value = r.total || 0;
  } catch (e) {
    stages.value = [];
    stagesTotal.value = 0;
    stagesError.value = e.message || 'Ошибка загрузки этапов';
  } finally {
    stagesLoading.value = false;
  }
}

async function loadGroups() {
  groupsLoading.value = true;
  groupsError.value = '';
  try {
    const params = new URLSearchParams({
      page: String(groupsPage.value),
      limit: String(groupsPageSize.value),
    });
    const term = search.value.trim();
    if (term) params.set('search', term);
    if (selectedTournamentForGroups.value)
      params.set('tournament_id', selectedTournamentForGroups.value);
    const r = await apiFetch(`/tournaments/groups?${params.toString()}`);
    groups.value = r.groups || [];
    groupsTotal.value = r.total || 0;
  } catch (e) {
    groups.value = [];
    groupsTotal.value = 0;
    groupsError.value = e.message || 'Ошибка загрузки групп';
  } finally {
    groupsLoading.value = false;
  }
}

async function loadTournamentTeams() {
  ttLoading.value = true;
  ttError.value = '';
  try {
    const params = new URLSearchParams({
      page: String(ttPage.value),
      limit: String(ttPageSize.value),
    });
    const term = search.value.trim();
    if (term) params.set('search', term);
    if (selectedTournamentForTeams.value)
      params.set('tournament_id', selectedTournamentForTeams.value);
    if (selectedGroupForTeams.value)
      params.set('group_id', selectedGroupForTeams.value);
    const r = await apiFetch(`/tournaments/teams?${params.toString()}`);
    tt.value = r.teams || [];
    ttTotal.value = r.total || 0;
  } catch (e) {
    tt.value = [];
    ttTotal.value = 0;
    ttError.value = e.message || 'Ошибка загрузки команд турниров';
  } finally {
    ttLoading.value = false;
  }
}

const tournamentsVisible = computed(() => tournaments.value || []);
const stagesVisible = computed(() => stages.value || []);
const groupsVisible = computed(() => groups.value || []);
const ttVisible = computed(() => tt.value || []);

// Helper maps for chips
const seasonNameById = computed(
  () => new Map((seasonOptions.value || []).map((s) => [String(s.id), s.name]))
);
// type removed

const filterChips = computed(() => {
  const chips = [];
  const q = (search.value || '').trim();
  if (q) chips.push({ key: 'q', label: `Поиск: ${q}` });
  if (selectedSeasonId.value) {
    const name = seasonNameById.value.get(String(selectedSeasonId.value));
    chips.push({ key: 'season', label: `Сезон: ${name || '—'}` });
  }
  return chips;
});

function clearChip(key) {
  if (key === 'q') search.value = '';
  if (key === 'season') selectedSeasonId.value = '';
}

function clearAllFilters() {
  search.value = '';
  selectedSeasonId.value = '';
  selectedTournamentForStages.value = '';
  selectedTournamentForGroups.value = '';
  selectedTournamentForTeams.value = '';
  selectedGroupForTeams.value = '';
  tournamentsPage.value = 1;
  stagesPage.value = 1;
  groupsPage.value = 1;
  ttPage.value = 1;
  loadTournaments();
  loadStages();
  loadGroups();
  loadTournamentTeams();
  updateQuery();
}

// Persist season/type filters
const FILTERS_KEY = 'adminTournamentsFilters';
function saveFilters() {
  try {
    const data = { season_id: selectedSeasonId.value || '' };
    localStorage.setItem(FILTERS_KEY, JSON.stringify(data));
  } catch (_) {}
}
function loadSavedFilters() {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return;
    const f = JSON.parse(raw);
    if (f && typeof f === 'object') {
      selectedSeasonId.value = String(f.season_id || '');
    }
  } catch (_) {}
}

// Drill-down state for tile interface inside a tournament
const detailTournament = ref(null); // { id, name, season }
const detailStage = ref(null); // { id, external_id }
const detailGroup = ref(null); // { id, name }

const detailStages = ref([]);
const detailStagesLoading = ref(false);
const detailGroups = ref([]);
const detailGroupsLoading = ref(false);
const detailTeams = ref([]);
const detailTeamsLoading = ref(false);

function closeDetail() {
  detailTournament.value = null;
  detailStage.value = null;
  detailGroup.value = null;
  detailStages.value = [];
  detailGroups.value = [];
  detailTeams.value = [];
}

async function openTournamentDetail(t) {
  detailTournament.value = t;
  detailStage.value = null;
  detailGroup.value = null;
  await loadDetailStages();
}

function backToTournamentStages() {
  detailGroup.value = null;
  detailTeams.value = [];
}

function backToTournamentsList() {
  closeDetail();
}

async function openStageDetail(s) {
  detailStage.value = s;
  detailGroup.value = null;
  await loadDetailGroups();
}

async function openGroupDetail(g) {
  detailGroup.value = g;
  await loadDetailTeams();
}

async function loadDetailStages() {
  if (!detailTournament.value) return;
  detailStagesLoading.value = true;
  try {
    const p = new URLSearchParams({
      page: '1',
      limit: '1000',
      tournament_id: detailTournament.value.id,
    });
    const r = await apiFetch(`/tournaments/stages?${p.toString()}`);
    detailStages.value = r.stages || [];
  } catch (_) {
    detailStages.value = [];
  } finally {
    detailStagesLoading.value = false;
  }
}

async function loadDetailGroups() {
  if (!detailTournament.value || !detailStage.value) return;
  detailGroupsLoading.value = true;
  try {
    const p = new URLSearchParams({
      page: '1',
      limit: '1000',
      tournament_id: detailTournament.value.id,
      stage_id: detailStage.value.id,
    });
    const r = await apiFetch(`/tournaments/groups?${p.toString()}`);
    detailGroups.value = r.groups || [];
  } catch (_) {
    detailGroups.value = [];
  } finally {
    detailGroupsLoading.value = false;
  }
}

async function loadDetailTeams() {
  if (!detailTournament.value || !detailGroup.value) return;
  detailTeamsLoading.value = true;
  try {
    const p = new URLSearchParams({
      page: '1',
      limit: '1000',
      tournament_id: detailTournament.value.id,
      group_id: detailGroup.value.id,
    });
    const r = await apiFetch(`/tournaments/teams?${p.toString()}`);
    detailTeams.value = r.teams || [];
  } catch (_) {
    detailTeams.value = [];
  } finally {
    detailTeamsLoading.value = false;
  }
}

// Legacy globals removed (kept as inert state to avoid runtime errors)
const selectedTournamentForStages = ref('');
const selectedTournamentForGroups = ref('');
const selectedTournamentForTeams = ref('');
const selectedGroupForTeams = ref('');

async function loadFilters() {
  try {
    const [seasonsRes, activeRes] = await Promise.all([
      apiFetch('/seasons?limit=1000'),
      apiFetch('/seasons/active'),
    ]);
    seasonOptions.value = (seasonsRes.seasons || []).map((s) => ({
      id: s.id,
      name: s.name,
    }));
    if (!selectedSeasonId.value && activeRes?.season?.id) {
      selectedSeasonId.value = String(activeRes.season.id);
    }
  } catch (_) {}
}

// Populate group filter options for selected tournament
const groupOptionsForTournament = ref([]);
async function preloadGroupsForTournament(tournamentId) {
  try {
    if (!tournamentId) {
      groupOptionsForTournament.value = [];
      return;
    }
    const params = new URLSearchParams({
      limit: '1000',
      page: '1',
      tournament_id: String(tournamentId),
    });
    const r = await apiFetch(`/tournaments/groups?${params.toString()}`);
    groupOptionsForTournament.value = (r.groups || []).map((g) => ({
      id: g.id,
      name: g.name || 'Без названия',
    }));
  } catch (_) {
    groupOptionsForTournament.value = [];
  }
}

onMounted(async () => {
  loadSavedFilters();
  await Promise.all([loadFilters(), loadTournaments()]);
});

// Watchers for pagination and sizes
watch([tournamentsPage, tournamentsPageSize], ([, size]) => {
  savePageSize('adminTournamentsPageSize', size);
  loadTournaments();
  updateQuery();
});
watch([selectedSeasonId], () => {
  tournamentsPage.value = 1;
  loadTournaments();
  updateQuery();
  saveFilters();
});
// Old global lists removed; watchers cleaned up

let searchTimeout;
watch(search, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    tournamentsPage.value = 1;
    groupsPage.value = 1;
    ttPage.value = 1;
    loadTournaments();
    loadGroups();
    loadTournamentTeams();
    updateQuery();
  }, 300);
});

watch(activeTab, () => updateQuery());

// Quick transitions: click counts now open tournament detail
</script>

<template>
  <div class="py-4 admin-tournaments-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Турниры</li>
        </ol>
      </nav>
      <h1 class="mb-3 text-start">Турниры</h1>

      <div v-if="!detailTournament">
        <div class="card section-card tile fade-in shadow-sm">
          <div class="card-body">
            <div class="row g-2 align-items-end mb-3">
              <div class="col-12 col-md-4">
                <div class="input-group">
                  <span class="input-group-text"
                    ><i class="bi bi-search" aria-hidden="true"></i
                  ></span>
                  <input
                    v-model="search"
                    type="search"
                    class="form-control"
                    placeholder="Поиск (название турнира, группа, команда)"
                    aria-label="Поиск"
                  />
                </div>
              </div>
              <div class="col-6 col-md-4">
                <select
                  v-model="selectedSeasonId"
                  class="form-select"
                  aria-label="Сезон"
                >
                  <option value="">Все сезоны</option>
                  <option v-for="s in seasonOptions" :key="s.id" :value="s.id">
                    {{ s.name }}
                  </option>
                </select>
              </div>
            </div>

            <div
              class="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2"
            >
              <div class="d-flex flex-wrap align-items-center gap-1">
                <button
                  v-for="chip in filterChips"
                  :key="chip.key"
                  type="button"
                  class="badge bg-light text-muted border d-inline-flex align-items-center gap-1"
                  :aria-label="`Удалить фильтр ${chip.label}`"
                  @click="clearChip(chip.key)"
                >
                  {{ chip.label }}
                  <i class="bi bi-x-lg" aria-hidden="true"></i>
                </button>
              </div>
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                @click="clearAllFilters"
              >
                Сбросить все
              </button>
            </div>

            <!-- Tournaments -->
            <div>
              <div v-if="tournamentsError" class="alert alert-danger mb-2">
                {{ tournamentsError }}
              </div>
              <BrandSpinner v-if="tournamentsLoading" label="Загрузка" />
              <div v-else>
                <div v-if="tournamentsVisible.length" class="table-responsive">
                  <table class="table align-middle">
                    <thead>
                      <tr>
                        <th>Название</th>
                        <th>Сезон</th>
                        <th>Год</th>
                        <th class="text-end">Этапы</th>
                        <th class="text-end">Группы</th>
                        <th class="text-end">Команды</th>
                        <th class="text-end">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="t in tournamentsVisible" :key="t.id">
                        <td class="text-start">
                          <div class="fw-semibold">{{ t.name }}</div>
                          <div v-if="t.full_name" class="small text-muted">
                            {{ t.full_name }}
                          </div>
                        </td>
                        <td>{{ t.season?.name || '—' }}</td>

                        <td>{{ t.birth_year || '—' }}</td>
                        <td class="text-end">
                          <button
                            class="btn btn-link px-0"
                            @click="openTournamentDetail(t)"
                          >
                            {{ t.counts?.stages ?? '—' }}
                          </button>
                        </td>
                        <td class="text-end">
                          <button
                            class="btn btn-link px-0"
                            @click="openTournamentDetail(t)"
                          >
                            {{ t.counts?.groups ?? '—' }}
                          </button>
                        </td>
                        <td class="text-end">
                          <button
                            class="btn btn-link px-0"
                            @click="openTournamentDetail(t)"
                          >
                            {{ t.counts?.teams ?? '—' }}
                          </button>
                        </td>
                        <td class="text-end">
                          <RouterLink
                            class="btn btn-outline-secondary btn-sm"
                            :to="{
                              path: '/admin/sports-calendar',
                              query: { tournament: t.name },
                            }"
                          >
                            Календарь
                          </RouterLink>
                          <button
                            class="btn btn-outline-brand btn-sm ms-2"
                            @click="openTournamentDetail(t)"
                          >
                            Открыть
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <PageNav
                    v-model:page="tournamentsPage"
                    v-model:page-size="tournamentsPageSize"
                    :total-pages="tournamentsTotalPages"
                    :sizes="[10, 20, 50]"
                  />
                </div>
                <div v-else class="alert alert-warning mb-0">
                  Турниры не найдены.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <!-- Drill-down tiles -->
  <div v-if="detailTournament" class="py-3">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item">
            <button
              type="button"
              class="btn btn-link p-0 align-baseline text-decoration-none"
              @click="backToTournamentsList"
            >
              Турниры
            </button>
          </li>
          <!-- Tournament crumb: active when no deeper selection; clickable otherwise -->
          <li
            v-if="!detailStage && !detailGroup"
            class="breadcrumb-item active"
            aria-current="page"
          >
            {{ detailTournament.name }}
          </li>
          <li v-else class="breadcrumb-item">
            <button
              type="button"
              class="btn btn-link p-0 align-baseline text-decoration-none"
              @click="
                (() => {
                  detailStage = null;
                  detailGroup = null;
                })()
              "
            >
              {{ detailTournament.name }}
            </button>
          </li>
          <!-- Stage crumb: show name if exists; active only when group is not selected -->
          <li
            v-if="detailStage && !detailGroup"
            class="breadcrumb-item active"
            aria-current="page"
          >
            Этап:
            {{
              detailStage.name ||
              '#' + (detailStage.external_id || detailStage.id)
            }}
          </li>
          <li v-else-if="detailStage && detailGroup" class="breadcrumb-item">
            <button
              type="button"
              class="btn btn-link p-0 align-baseline text-decoration-none"
              @click="backToTournamentStages"
            >
              Этап:
              {{
                detailStage.name ||
                '#' + (detailStage.external_id || detailStage.id)
              }}
            </button>
          </li>
          <!-- Group crumb: active only as the last crumb -->
          <li
            v-if="detailGroup"
            class="breadcrumb-item active"
            aria-current="page"
          >
            {{ detailGroup.name || 'Группа' }}
          </li>
        </ol>
      </nav>
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h2 class="h5 mb-0">
          {{ detailGroup ? 'Команды' : detailStage ? 'Группы' : 'Этапы' }}
        </h2>
        <div class="d-flex gap-2">
          <RouterLink
            class="btn btn-outline-secondary btn-sm"
            :to="{
              path: '/admin/sports-calendar',
              query: detailGroup
                ? {
                    tournament: detailTournament.name,
                    group: detailGroup.name || '',
                  }
                : { tournament: detailTournament.name },
            }"
          >
            Календарь {{ detailGroup ? 'группы' : 'турнира' }}
          </RouterLink>
          <button
            v-if="detailGroup"
            class="btn btn-outline-secondary btn-sm"
            @click="backToTournamentStages"
          >
            К группам
          </button>
          <button
            v-else-if="detailStage"
            class="btn btn-outline-secondary btn-sm"
            @click="detailStage = null"
          >
            К этапам
          </button>
        </div>
      </div>

      <div class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <!-- Stages tiles -->
          <BrandSpinner
            v-if="!detailStage && !detailGroup && detailStagesLoading"
            label="Загрузка"
          />
          <div v-else-if="!detailStage && !detailGroup">
            <div v-if="detailStages.length" class="row g-3">
              <div
                v-for="s in detailStages"
                :key="s.id"
                class="col-12 col-sm-6 col-lg-4"
              >
                <BaseTile
                  :aria-label="`Открыть этап ${s.name || '#' + (s.external_id || s.id)}`"
                  :extra-class="'section-card h-100 fade-in shadow-sm text-start w-100 btn-unstyled'"
                  role="button"
                  @click="openStageDetail(s)"
                  @keydown.enter.prevent="openStageDetail(s)"
                >
                  <div class="card-body">
                    <div class="card-title mb-1 fw-semibold">
                      Этап: {{ s.name || '#' + (s.external_id || s.id) }}
                    </div>
                  </div>
                </BaseTile>
              </div>
            </div>
            <div v-else class="d-flex justify-content-center">
              <div
                class="card section-card tile fade-in shadow-sm text-center empty-tile"
              >
                <div class="card-body py-4">
                  <i
                    class="bi bi-layers fs-2 text-muted"
                    aria-hidden="true"
                  ></i>
                  <div class="mt-2 text-muted">Этапы не найдены</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Groups tiles -->
          <BrandSpinner
            v-if="detailStage && !detailGroup && detailGroupsLoading"
            label="Загрузка"
          />
          <div v-else-if="detailStage && !detailGroup">
            <div v-if="detailGroups.length" class="row g-3">
              <div
                v-for="g in detailGroups"
                :key="g.id"
                class="col-12 col-sm-6 col-lg-4"
              >
                <BaseTile
                  :aria-label="`Открыть группу ${g.name || ''}`"
                  :extra-class="'section-card h-100 fade-in shadow-sm text-start w-100 btn-unstyled'"
                  role="button"
                  @click="openGroupDetail(g)"
                  @keydown.enter.prevent="openGroupDetail(g)"
                >
                  <div class="card-body">
                    <div class="card-title mb-1 fw-semibold">
                      {{ g.name || 'Группа' }}
                    </div>
                  </div>
                </BaseTile>
              </div>
            </div>
            <div v-else class="d-flex justify-content-center">
              <div
                class="card section-card tile fade-in shadow-sm text-center empty-tile"
              >
                <div class="card-body py-4">
                  <i
                    class="bi bi-collection fs-2 text-muted"
                    aria-hidden="true"
                  ></i>
                  <div class="mt-2 text-muted">Группы не найдены</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Teams tiles -->
          <BrandSpinner
            v-if="detailGroup && detailTeamsLoading"
            label="Загрузка"
          />
          <div v-else-if="detailGroup">
            <div v-if="detailTeams.length" class="row g-3">
              <div
                v-for="u in detailTeams"
                :key="u.id"
                class="col-12 col-sm-6 col-lg-4"
              >
                <BaseTile
                  :extra-class="'section-card h-100 fade-in shadow-sm text-start w-100'"
                >
                  <div class="card-body">
                    <div class="card-title mb-1 fw-semibold">
                      {{ u.team?.name || 'Команда' }}
                    </div>
                  </div>
                </BaseTile>
              </div>
            </div>
            <div v-else class="d-flex justify-content-center">
              <div
                class="card section-card tile fade-in shadow-sm text-center empty-tile"
              >
                <div class="card-body py-4">
                  <i
                    class="bi bi-people fs-2 text-muted"
                    aria-hidden="true"
                  ></i>
                  <div class="mt-2 text-muted">Команды не найдены</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Uses global .section-card from brand.css */
.empty-tile {
  max-width: 420px;
}
</style>
