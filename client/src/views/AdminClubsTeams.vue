<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useToast } from '../utils/toast';
import BrandSpinner from '../components/BrandSpinner.vue';
import PageNav from '../components/PageNav.vue';
import TeamTiles from '../components/TeamTiles.vue';
import { apiFetch } from '../api';
import { loadPageSize, savePageSize } from '../utils/pageSize';

const route = useRoute();
const router = useRouter();

// List state
const clubs = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(loadPageSize('adminClubsTeamsPageSize', 12));
const q = ref('');
const loading = ref(false);
const syncing = ref(false);
const error = ref('');
const clubTypes = ref([]);
const clubTypesLoading = ref(false);
const createClubOpen = ref(false);
const createClubLoading = ref(false);
const createClubError = ref('');
const createClubForm = ref({
  name: '',
  club_type_id: '',
});

// Detail state
const seasons = ref([]); // seasons for selected club
const selectedSeasonId = ref('');
const seasonsLoading = ref(false);
const seasonsError = ref('');
const activeSeasonId = ref('');
const countsLoading = ref(false);
const updateClubTypeLoading = ref(false);
const updateClubTypeError = ref('');
const updateClubTypeForm = ref({ club_type_id: '' });
const manualTeams = ref([]);
const manualTeamsLoading = ref(false);
const manualTeamsError = ref('');
const createTeamLoading = ref(false);
const createTeamError = ref('');
const createTeamForm = ref({
  name: '',
  birth_year: '',
});

// Toast
const { showToast } = useToast();

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value))
);

const selectedClubId = computed(() => String(route.query.club_id || ''));
const selectedClub = computed(() => {
  if (!selectedClubId.value) return null;
  return clubs.value.find((c) => String(c.id) === selectedClubId.value) || null;
});
const inDetail = computed(() => Boolean(selectedClubId.value));
const selectedClubIsImported = computed(
  () => selectedClub.value?.external_id != null
);
const defaultYouthClubTypeId = computed(() => {
  const youth = (clubTypes.value || []).find((type) => type.alias === 'YOUTH');
  return youth?.id || clubTypes.value?.[0]?.id || '';
});

// global toast via useToast()

function resetCreateClubForm() {
  createClubForm.value = {
    name: '',
    club_type_id: defaultYouthClubTypeId.value,
  };
  createClubError.value = '';
}

function resetCreateTeamForm() {
  createTeamForm.value = {
    name: '',
    birth_year: '',
  };
  createTeamError.value = '';
}

function syncUpdateClubTypeForm() {
  updateClubTypeForm.value = {
    club_type_id:
      selectedClub.value?.club_type_id || defaultYouthClubTypeId.value || '',
  };
  updateClubTypeError.value = '';
}

function toggleCreateClub() {
  createClubOpen.value = !createClubOpen.value;
  if (createClubOpen.value) {
    resetCreateClubForm();
  }
}

async function loadClubs() {
  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      limit: String(pageSize.value),
    });
    // Request both associations explicitly
    params.append('include', 'teams');
    params.append('include', 'grounds');
    const term = q.value.trim();
    if (term) params.set('search', term);
    const res = await apiFetch(`/clubs?${params}`);
    clubs.value = res.clubs || [];
    total.value = res.total || 0;
    const pages = Math.max(1, Math.ceil(total.value / pageSize.value));
    if (page.value > pages) page.value = pages;
    await loadVisibleTeamCounts();
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки клубов';
    clubs.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

async function loadClubTypes() {
  clubTypesLoading.value = true;
  try {
    const res = await apiFetch('/clubs/types');
    clubTypes.value = res.types || [];
    if (!createClubForm.value.club_type_id) {
      createClubForm.value.club_type_id = defaultYouthClubTypeId.value;
    }
    if (inDetail.value) {
      syncUpdateClubTypeForm();
    }
  } catch (_) {
    clubTypes.value = [];
  } finally {
    clubTypesLoading.value = false;
  }
}

// Team counts for visible clubs in the active season
const teamCounts = ref({}); // { [clubId]: number }
// Show full list; do not hide clubs without teams to keep pagination intuitive
const visibleClubs = computed(() => clubs.value || []);

async function loadActiveSeason() {
  try {
    const r = await apiFetch('/seasons/active');
    if (r?.season?.id) activeSeasonId.value = r.season.id;
  } catch (_) {}
}

async function loadVisibleTeamCounts() {
  countsLoading.value = true;
  const list = Array.isArray(clubs.value) ? clubs.value : [];
  if (!list.length) {
    teamCounts.value = {};
    countsLoading.value = false;
    return;
  }
  const updates = {};
  // Limit concurrency to 4
  const chunk = 4;
  for (let i = 0; i < list.length; i += chunk) {
    const part = list.slice(i, i + chunk);
    const results = await Promise.all(
      part.map(async (c) => {
        try {
          const p = new URLSearchParams({ club_id: String(c.id) });
          const r = await apiFetch(`/players/season-teams?${p.toString()}`);
          const seasons = Array.isArray(r.seasons) ? r.seasons : [];
          let season;
          if (activeSeasonId.value) {
            season = seasons.find(
              (s) => String(s.id) === String(activeSeasonId.value)
            );
          } else {
            season = seasons.find((s) => s.active);
          }
          const cnt =
            season?.teams?.filter((t) => Number.isFinite(t.birth_year))
              .length || 0;
          return { id: c.id, count: cnt };
        } catch (_) {
          return { id: c.id, count: 0 };
        }
      })
    );
    for (const r of results) updates[String(r.id)] = r.count;
  }
  teamCounts.value = updates;
  countsLoading.value = false;
}

function filterSeasonsForView(list) {
  const result = [];
  for (const s of list || []) {
    const teams = Array.isArray(s.teams) ? s.teams : [];
    const hasValidTeam = teams.some((t) => Number.isFinite(t.birth_year));
    if (!teams.length || !hasValidTeam) continue;
    result.push({ ...s, teams });
  }
  result.sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), 'ru', {
      numeric: true,
    })
  );
  return result;
}

async function loadClubSeasons() {
  if (!selectedClubId.value) return;
  // Ensure we can render the club name in breadcrumb even when deep-linked with pagination not covering it
  await ensureClubLoaded();
  syncUpdateClubTypeForm();
  resetCreateTeamForm();
  seasonsLoading.value = true;
  seasonsError.value = '';
  try {
    const p = new URLSearchParams({ club_id: selectedClubId.value });
    const r = await apiFetch(`/players/season-teams?${p.toString()}`);
    const list = Array.isArray(r.seasons) ? r.seasons : [];
    const filtered = filterSeasonsForView(list);
    seasons.value = filtered;
    const active = filtered.find((s) => s.active);
    selectedSeasonId.value = (active || filtered[0])?.id || '';
    // Preload grounds counts for all teams in this club (once per club)
    await Promise.all([loadTeamGroundCounts(), loadManualTeams()]);
  } catch (e) {
    seasons.value = [];
    selectedSeasonId.value = '';
    seasonsError.value = e.message || 'Не удалось загрузить данные по сезонам';
    await loadManualTeams();
  } finally {
    seasonsLoading.value = false;
  }
}

async function ensureClubLoaded() {
  if (!inDetail.value) return;
  if (selectedClub.value) return;
  try {
    const res = await apiFetch('/clubs?limit=1000');
    const list = res.clubs || [];
    // Merge by id to avoid losing current page state unnecessarily
    const map = new Map(clubs.value.map((c) => [String(c.id), c]));
    for (const c of list) map.set(String(c.id), c);
    clubs.value = Array.from(map.values());
  } catch (_) {
    // no-op; breadcrumb will fall back to generic label
  }
}

async function loadManualTeams() {
  if (!selectedClubId.value) return;
  manualTeamsLoading.value = true;
  manualTeamsError.value = '';
  try {
    const params = new URLSearchParams({
      club_id: String(selectedClubId.value),
      status: 'ALL',
      limit: '1000',
    });
    const res = await apiFetch(`/teams?${params.toString()}`);
    manualTeams.value = res.teams || [];
  } catch (e) {
    manualTeams.value = [];
    manualTeamsError.value = e.message || 'Ошибка загрузки команд клуба';
  } finally {
    manualTeamsLoading.value = false;
  }
}

function openClub(club) {
  const query = { ...route.query, club_id: club.id };
  router.push({ path: route.path, query });
}

function closeClub() {
  const q = { ...route.query };
  delete q.club_id;
  router.push({ path: route.path, query: q });
}

async function syncAll() {
  syncing.value = true;
  try {
    // Syncing teams also syncs clubs internally
    const res = await apiFetch('/teams/sync', { method: 'POST' });
    if (inDetail.value) await loadClubSeasons();
    else await loadClubs();
    const s = res.stats?.teams || {};
    showToast(
      `Синхронизировано команд: добавлено/обновлено ${s.upserts ?? 0}, удалено ${s.softDeletedTotal ?? 0} (архив: ${s.softDeletedArchived ?? 0}, отсутствуют: ${s.softDeletedMissing ?? 0})`
    );
  } catch (e) {
    showToast(e.message || 'Ошибка синхронизации');
  } finally {
    syncing.value = false;
  }
}

async function submitCreateClub() {
  if (createClubLoading.value) return;
  const name = String(createClubForm.value.name || '').trim();
  if (!name) {
    createClubError.value = 'Укажите название клуба';
    return;
  }
  const clubTypeId =
    createClubForm.value.club_type_id || defaultYouthClubTypeId.value;
  if (!clubTypeId) {
    createClubError.value = 'Выберите тип клуба';
    return;
  }
  createClubLoading.value = true;
  createClubError.value = '';
  try {
    const res = await apiFetch('/clubs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        club_type_id: clubTypeId,
      }),
    });
    const created = res.club || null;
    showToast('Клуб создан');
    createClubOpen.value = false;
    resetCreateClubForm();
    await loadClubs();
    if (created) {
      openClub(created);
    }
  } catch (e) {
    createClubError.value = e.message || 'Ошибка создания клуба';
  } finally {
    createClubLoading.value = false;
  }
}

async function saveClubType() {
  if (!selectedClubId.value || updateClubTypeLoading.value) return;
  if (!updateClubTypeForm.value.club_type_id) {
    updateClubTypeError.value = 'Выберите тип клуба';
    return;
  }
  updateClubTypeLoading.value = true;
  updateClubTypeError.value = '';
  try {
    const res = await apiFetch(`/clubs/${selectedClubId.value}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        club_type_id: updateClubTypeForm.value.club_type_id,
      }),
    });
    const updated = res.club || null;
    if (updated) {
      clubs.value = clubs.value.map((club) =>
        String(club.id) === String(updated.id) ? { ...club, ...updated } : club
      );
    }
    showToast('Тип клуба сохранён');
  } catch (e) {
    updateClubTypeError.value = e.message || 'Ошибка сохранения типа клуба';
  } finally {
    updateClubTypeLoading.value = false;
  }
}

async function submitCreateTeam() {
  if (createTeamLoading.value || !selectedClubId.value) return;
  const name = String(createTeamForm.value.name || '').trim();
  if (!name) {
    createTeamError.value = 'Укажите название команды';
    return;
  }
  createTeamLoading.value = true;
  createTeamError.value = '';
  try {
    await apiFetch('/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        club_id: selectedClubId.value,
        name,
        birth_year: createTeamForm.value.birth_year || null,
      }),
    });
    showToast('Команда добавлена');
    resetCreateTeamForm();
    await Promise.all([loadClubSeasons(), loadClubs()]);
  } catch (e) {
    createTeamError.value = e.message || 'Ошибка создания команды';
  } finally {
    createTeamLoading.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadActiveSeason(), loadClubTypes(), loadClubs()]);
  resetCreateClubForm();
  if (selectedClubId.value) await loadClubSeasons();
});

watch(page, loadClubs);
watch(pageSize, (val) => {
  page.value = 1;
  savePageSize('adminClubsTeamsPageSize', val);
  loadClubs();
});

let searchTimeout;
watch(q, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    page.value = 1;
    loadClubs();
  }, 300);
});

watch(
  () => route.query.club_id,
  async () => {
    // If we already have clubs loaded, just refresh seasons for the selected club
    if (selectedClubId.value) {
      await loadClubSeasons();
      return;
    }
    seasons.value = [];
    selectedSeasonId.value = '';
    manualTeams.value = [];
    manualTeamsError.value = '';
    syncUpdateClubTypeForm();
  }
);

watch([selectedClubId, clubTypes], () => {
  if (inDetail.value) {
    syncUpdateClubTypeForm();
  } else {
    updateClubTypeForm.value = { club_type_id: defaultYouthClubTypeId.value };
    updateClubTypeError.value = '';
  }
});

// Grounds count per team (map)
const teamGroundCounts = ref({}); // { [teamId]: number }
async function loadTeamGroundCounts() {
  if (!selectedClubId.value) return;
  try {
    const params = new URLSearchParams({
      club_id: String(selectedClubId.value),
      limit: '1000',
      include: 'grounds',
    });
    const r = await apiFetch(`/teams?${params.toString()}`);
    const map = {};
    for (const t of r.teams || []) {
      map[String(t.id)] = Array.isArray(t.grounds) ? t.grounds.length : 0;
    }
    teamGroundCounts.value = map;
  } catch (_) {
    teamGroundCounts.value = {};
  }
}
</script>

<template>
  <div class="py-4 admin-clubs-teams-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li
            v-if="!inDetail"
            class="breadcrumb-item active"
            aria-current="page"
          >
            Команды и клубы
          </li>
          <template v-else>
            <li class="breadcrumb-item">
              <RouterLink to="/admin/clubs-teams">Команды и клубы</RouterLink>
            </li>
            <li class="breadcrumb-item active" aria-current="page">
              {{ selectedClub?.name || 'Клуб' }}
            </li>
          </template>
        </ol>
      </nav>
      <h1 class="mb-3 text-start">Команды и клубы</h1>

      <!-- List view: clubs as tiles -->
      <div v-if="!inDetail" class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <div class="row g-2 align-items-end mb-3">
            <div class="col-12 col-sm">
              <div class="input-group">
                <span class="input-group-text">
                  <i class="bi bi-search" aria-hidden="true"></i>
                </span>
                <input
                  v-model="q"
                  type="search"
                  class="form-control"
                  placeholder="Поиск по клубам"
                  aria-label="Поиск клубов"
                />
              </div>
            </div>
            <div class="col-12 col-sm-auto">
              <button
                class="btn btn-brand w-100"
                type="button"
                @click="toggleCreateClub"
              >
                {{ createClubOpen ? 'Скрыть форму' : 'Добавить клуб' }}
              </button>
            </div>
            <div class="col-12 col-sm-auto">
              <button
                class="btn btn-outline-secondary w-100"
                :disabled="syncing"
                @click="syncAll"
              >
                <span
                  v-if="syncing"
                  class="spinner-border spinner-border-sm me-2"
                ></span>
                Синхронизировать
              </button>
            </div>
          </div>
          <div
            v-if="createClubOpen"
            class="card border-0 shadow-sm mb-3 bg-light-subtle"
          >
            <div class="card-body">
              <div class="fw-semibold mb-2">Новый клуб</div>
              <div v-if="createClubError" class="alert alert-danger mb-2">
                {{ createClubError }}
              </div>
              <div class="row g-2 align-items-end">
                <div class="col-12 col-lg-5">
                  <label class="form-label">Название клуба</label>
                  <input
                    v-model="createClubForm.name"
                    type="text"
                    class="form-control"
                    placeholder="Название клуба"
                    @input="createClubError = ''"
                  />
                </div>
                <div class="col-12 col-lg-4">
                  <label class="form-label">Тип клуба</label>
                  <select
                    v-model="createClubForm.club_type_id"
                    class="form-select"
                    :disabled="clubTypesLoading"
                  >
                    <option value="">Выберите тип</option>
                    <option
                      v-for="type in clubTypes"
                      :key="type.id"
                      :value="type.id"
                    >
                      {{ type.name }}
                    </option>
                  </select>
                </div>
                <div class="col-12 col-lg-3">
                  <button
                    type="button"
                    class="btn btn-brand w-100"
                    :disabled="
                      createClubLoading ||
                      !createClubForm.name.trim() ||
                      !createClubForm.club_type_id
                    "
                    @click="submitCreateClub"
                  >
                    <span
                      v-if="createClubLoading"
                      class="spinner-border spinner-border-sm me-2"
                    ></span>
                    Создать клуб
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="error" class="alert alert-danger mb-2">{{ error }}</div>
          <BrandSpinner v-if="loading" label="Загрузка" />
          <div v-else>
            <div v-if="visibleClubs.length" class="row g-3">
              <div
                v-for="c in visibleClubs"
                :key="c.id"
                class="col-12 col-md-6 col-lg-3 club-tile-col"
              >
                <div
                  role="button"
                  tabindex="0"
                  class="card section-card tile h-100 fade-in shadow-sm text-start w-100 btn-unstyled"
                  :aria-label="`Открыть клуб ${c.name}`"
                  @click="openClub(c)"
                  @keydown.enter.prevent="openClub(c)"
                  @keydown.space.prevent="openClub(c)"
                >
                  <div class="card-body">
                    <div class="card-title mb-1 fw-semibold">{{ c.name }}</div>
                    <div class="small text-muted mb-2">
                      Тип: {{ c.club_type?.name || '—' }}
                    </div>
                    <div
                      class="small text-muted d-flex align-items-center flex-wrap gap-3"
                    >
                      <span class="d-inline-flex align-items-center gap-1">
                        <i
                          class="bi bi-people text-brand"
                          aria-hidden="true"
                        ></i>
                        <template v-if="!countsLoading">
                          Команд: {{ teamCounts[String(c.id)] ?? '—' }}
                        </template>
                        <span v-else class="skeleton-badge ms-1"></span>
                      </span>
                      <span class="d-inline-flex align-items-center gap-1">
                        <i
                          class="bi bi-geo-alt text-brand"
                          aria-hidden="true"
                        ></i>
                        Площадок: {{ (c.grounds || []).length || 0 }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <PageNav
                v-if="clubs.length"
                v-model:page="page"
                v-model:page-size="pageSize"
                :total-pages="totalPages"
                :sizes="[12, 24, 48]"
              />
            </div>
            <div v-else class="alert alert-warning mb-0">Клубы не найдены.</div>
          </div>
        </div>
      </div>

      <!-- Detail view: selected club with season tabs and team tiles -->
      <div v-else class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <div
            class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3"
          >
            <div class="d-flex align-items-center gap-2">
              <button
                type="button"
                class="btn btn-outline-secondary"
                @click="closeClub"
              >
                <i class="bi bi-arrow-left" aria-hidden="true"></i>
                <span class="ms-1">К клубам</span>
              </button>
              <div class="h5 mb-0">{{ selectedClub?.name }}</div>
            </div>
            <div>
              <button
                class="btn btn-outline-secondary"
                :disabled="syncing"
                @click="syncAll"
              >
                <span
                  v-if="syncing"
                  class="spinner-border spinner-border-sm me-2"
                ></span>
                Синхронизировать
              </button>
            </div>
          </div>

          <div class="card border-0 shadow-sm mb-3 bg-light-subtle">
            <div class="card-body">
              <div class="fw-semibold mb-2">Настройки клуба</div>
              <div v-if="updateClubTypeError" class="alert alert-danger mb-2">
                {{ updateClubTypeError }}
              </div>
              <div class="row g-2 align-items-end">
                <div class="col-12 col-lg-6">
                  <label class="form-label">Тип клуба</label>
                  <select
                    v-model="updateClubTypeForm.club_type_id"
                    class="form-select"
                    :disabled="updateClubTypeLoading || clubTypesLoading"
                  >
                    <option value="">Выберите тип</option>
                    <option
                      v-for="type in clubTypes"
                      :key="type.id"
                      :value="type.id"
                    >
                      {{ type.name }}
                    </option>
                  </select>
                </div>
                <div class="col-12 col-lg-3">
                  <button
                    type="button"
                    class="btn btn-brand w-100"
                    :disabled="
                      updateClubTypeLoading || !updateClubTypeForm.club_type_id
                    "
                    @click="saveClubType"
                  >
                    <span
                      v-if="updateClubTypeLoading"
                      class="spinner-border spinner-border-sm me-2"
                    ></span>
                    Сохранить тип
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="card border-0 shadow-sm mb-3 bg-light-subtle">
            <div class="card-body">
              <div
                class="d-flex align-items-center justify-content-between mb-2"
              >
                <div class="fw-semibold">Команды клуба</div>
                <span class="badge bg-light text-muted border">
                  {{ manualTeams.length }}
                </span>
              </div>

              <div v-if="manualTeamsError" class="alert alert-danger mb-2">
                {{ manualTeamsError }}
              </div>
              <div
                v-if="selectedClubIsImported"
                class="alert alert-info small mb-2"
              >
                Клуб импортирован из внешней системы. Добавление команд вручную
                недоступно.
              </div>
              <div v-else class="row g-2 align-items-end mb-3">
                <div class="col-12 col-lg-5">
                  <label class="form-label">Название команды</label>
                  <input
                    v-model="createTeamForm.name"
                    type="text"
                    class="form-control"
                    placeholder="Название команды"
                    @input="createTeamError = ''"
                  />
                </div>
                <div class="col-12 col-lg-3">
                  <label class="form-label">Год</label>
                  <input
                    v-model="createTeamForm.birth_year"
                    type="number"
                    class="form-control"
                    min="1900"
                    max="2100"
                    placeholder="Год рождения"
                    @input="createTeamError = ''"
                  />
                </div>
                <div class="col-12 col-lg-4">
                  <button
                    type="button"
                    class="btn btn-brand w-100"
                    :disabled="createTeamLoading || !createTeamForm.name.trim()"
                    @click="submitCreateTeam"
                  >
                    <span
                      v-if="createTeamLoading"
                      class="spinner-border spinner-border-sm me-2"
                    ></span>
                    Добавить команду
                  </button>
                </div>
                <div v-if="createTeamError" class="col-12">
                  <div class="text-danger small">{{ createTeamError }}</div>
                </div>
              </div>

              <BrandSpinner v-if="manualTeamsLoading" label="Загрузка" />
              <div v-else>
                <div v-if="manualTeams.length" class="table-responsive">
                  <table class="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Команда</th>
                        <th>Год</th>
                        <th>Источник</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="team in manualTeams" :key="team.id">
                        <td>{{ team.name }}</td>
                        <td>{{ team.birth_year || '—' }}</td>
                        <td>
                          {{ team.external_id != null ? 'Импорт' : 'Ручная' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else class="text-muted small">
                  Команды пока не добавлены.
                </div>
              </div>
            </div>
          </div>

          <div v-if="seasonsError" class="alert alert-danger mb-2">
            {{ seasonsError }}
          </div>
          <BrandSpinner v-if="seasonsLoading" label="Загрузка" />
          <div v-else>
            <div
              v-if="!(seasons && seasons.length)"
              class="alert alert-info mb-0"
            >
              По сезону пока нет данных о заявках игроков.
            </div>
            <template v-else>
              <ul class="nav nav-pills mb-3" role="tablist">
                <li
                  v-for="s in seasons"
                  :key="s.id"
                  class="nav-item"
                  role="presentation"
                >
                  <button
                    class="nav-link"
                    :class="{ active: selectedSeasonId === s.id }"
                    :aria-selected="
                      selectedSeasonId === s.id ? 'true' : 'false'
                    "
                    @click="selectedSeasonId = s.id"
                  >
                    {{ s.name }}
                    <span
                      v-if="s.active"
                      class="badge bg-brand ms-1"
                      aria-label="Активный сезон"
                      >Активный</span
                    >
                  </button>
                </li>
              </ul>
              <div v-for="s in seasons" :key="s.id">
                <div v-if="selectedSeasonId === s.id">
                  <TeamTiles
                    :season="s"
                    :club-id="selectedClubId"
                    :link-to-roster="true"
                    roster-base-path="/admin/clubs-teams/season"
                    :grounds-count-by-team-id="teamGroundCounts"
                  />
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Uses global .section-card from brand.css */
.club-tile-col {
  min-width: 0;
  width: 100%;
}
@media (max-width: 767.98px) {
  .club-tile-col {
    flex: 0 0 100% !important;
    max-width: 100% !important;
  }
}
.btn-unstyled {
  background: transparent;
  border: 0;
  padding: 0;
}

/* Skeleton placeholder for smooth counter appearance */
/* Uses global skeleton utilities in brand.css */
</style>
