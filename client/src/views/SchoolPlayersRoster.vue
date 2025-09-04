<script setup>
import { onMounted, ref, computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';

const route = useRoute();
const isAdminView = computed(() => (route.path || '').startsWith('/admin'));
const loading = ref(false);
const error = ref('');
const season = ref({ id: route.params.seasonId, name: '' });
const year = computed(() => Number(route.params.year));
const players = ref([]);
const staff = ref([]);
const clubName = ref('');
const q = ref('');
const activeTab = ref('players'); // 'players' | 'staff'
const teamId = computed(() => route.query.team_id || '');
const clubId = computed(() => route.query.club_id || '');

onMounted(async () => {
  // Always resolve labels; only fetch roster/staff when a specific team is provided
  await Promise.all([loadSeasonName(), loadClubName()]);
  await loadRoster();
  await loadStaff();
});

async function loadSeasonName() {
  try {
    // Reuse summary to resolve season name with minimal overhead
    const params = new URLSearchParams();
    if (!isAdminView.value) params.set('mine', 'true');
    if (clubId.value) params.set('club_id', clubId.value);
    const data = await apiFetch(`/players/season-summary?${params.toString()}`);
    const s = (data.seasons || []).find((x) => x.id === season.value.id);
    if (s) season.value.name = s.name;
  } catch (_) {}
}

async function loadClubName() {
  try {
    if (!clubId.value) return;
    if (isAdminView.value) {
      const data = await apiFetch('/clubs?limit=1000');
      const clubs = Array.isArray(data.clubs) ? data.clubs : [];
      const found = clubs.find((c) => String(c.id) === String(clubId.value));
      if (found) clubName.value = found.name || '';
    } else {
      const data = await apiFetch('/clubs?mine=true');
      const clubs = Array.isArray(data.clubs) ? data.clubs : [];
      const found = clubs.find((c) => String(c.id) === String(clubId.value));
      if (found) clubName.value = found.name || '';
    }
  } catch (_) {}
}

async function loadRoster() {
  loading.value = true;
  error.value = '';
  try {
    if (!teamId.value) {
      players.value = [];
      return;
    }
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('limit', '500');
    params.set('season', season.value.id);
    params.set('team_birth_year', String(year.value));
    params.append('include', 'clubs');
    params.append('include', 'teams');
    if (clubId.value) params.set('club_id', clubId.value);
    if (teamId.value) params.set('team_id', teamId.value);
    if (!isAdminView.value) params.set('mine', 'true');
    const res = await apiFetch(`/players?${params.toString()}`);
    players.value = res.players || [];
  } catch (e) {
    error.value = e.message || 'Не удалось загрузить состав команды';
  } finally {
    loading.value = false;
  }
}

async function loadStaff() {
  loading.value = true;
  error.value = '';
  try {
    if (!teamId.value) {
      staff.value = [];
      return;
    }
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('limit', '500');
    params.set('season', season.value.id);
    if (clubId.value) params.set('club_id', clubId.value);
    if (teamId.value) params.set('team_id', teamId.value);
    params.append('include', 'teams');
    if (!isAdminView.value) params.set('mine', 'true');
    const res = await apiFetch(`/staff?${params.toString()}`);
    staff.value = res.staff || [];
  } catch (e) {
    // staff fetch errors should not break the page
    console.warn('Staff load failed', e);
    staff.value = [];
  } finally {
    loading.value = false;
  }
}

function formatDate(val) {
  return val ? new Date(val).toLocaleDateString('ru-RU') : '-';
}

function openPlayer(p) {
  const id = p?.external_id;
  if (!id) return;
  const url = `https://fhmoscow.com/player/${id}`;
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener');
  }
}

const sorted = (arr) => {
  return [...arr].sort((a, b) => {
    const an = Number.isFinite(a.jersey_number) ? a.jersey_number : Infinity;
    const bn = Number.isFinite(b.jersey_number) ? b.jersey_number : Infinity;
    if (an !== bn) return an - bn;
    return (a.full_name || '').localeCompare(b.full_name || '', 'ru');
  });
};

const filteredPlayers = computed(() => {
  const term = (q.value || '').toString().trim().toLowerCase();
  if (!term) return players.value;
  return players.value.filter((p) => {
    const name = (p.full_name || '').toLowerCase();
    const jersey =
      p.jersey_number !== undefined && p.jersey_number !== null
        ? String(p.jersey_number)
        : '';
    return name.includes(term) || jersey.includes(term);
  });
});

const filteredStaff = computed(() => {
  const term = (q.value || '').toString().trim().toLowerCase();
  if (!term) return staff.value;
  return staff.value.filter((s) =>
    (s.full_name || '').toLowerCase().includes(term)
  );
});

const goalies = computed(() =>
  sorted(filteredPlayers.value.filter((p) => p.role_name === 'Вратарь'))
);
const defenders = computed(() =>
  sorted(filteredPlayers.value.filter((p) => p.role_name === 'Защитник'))
);
const forwards = computed(() =>
  sorted(filteredPlayers.value.filter((p) => p.role_name === 'Нападающий'))
);
</script>

<template>
  <div class="py-3 school-roster-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <template v-if="isAdminView">
            <li class="breadcrumb-item">
              <RouterLink to="/admin">Администрирование</RouterLink>
            </li>
            <li class="breadcrumb-item">
              <RouterLink to="/admin/clubs-teams">Команды и клубы</RouterLink>
            </li>
          </template>
          <template v-else>
            <li class="breadcrumb-item">
              <RouterLink to="/">Главная</RouterLink>
            </li>
            <li class="breadcrumb-item">Управление спортивной школой</li>
            <li class="breadcrumb-item">
              <RouterLink to="/school-players">Команды и составы</RouterLink>
            </li>
          </template>
          <li class="breadcrumb-item active" aria-current="page">
            Состав — {{ clubName || 'Клуб' }} / {{ year || '' }} г.р.
          </li>
        </ol>
      </nav>
      <h1 class="mb-3">
        Состав — {{ clubName || 'Клуб' }} / {{ year || '' }} г.р.
      </h1>
      <div v-if="!teamId" class="alert alert-info mb-3" role="alert">
        Для просмотра состава выберите конкретную команду на странице
        <RouterLink to="/school-players">«Команды и составы»</RouterLink>
        .
      </div>

      <!-- Плитка поиска -->
      <div class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body">
          <form class="search-form" @submit.prevent>
            <div class="search-control">
              <label for="rosterSearch" class="form-label small text-muted mb-1"
                >Поиск по ФИО (игроки и тренеры) или номеру</label
              >
              <div class="input-group">
                <span class="input-group-text" aria-hidden="true">
                  <i class="bi bi-search"></i>
                </span>
                <input
                  id="rosterSearch"
                  v-model="q"
                  type="search"
                  class="form-control"
                  placeholder="Например: Иванов или 17"
                  autocomplete="off"
                  aria-describedby="rosterSearchHelp"
                />
                <button
                  v-if="q"
                  type="button"
                  class="btn btn-outline-secondary"
                  aria-label="Очистить поиск"
                  @click="q = ''"
                >
                  Очистить
                </button>
              </div>
              <div id="rosterSearchHelp" class="form-text">
                Глобальный поиск по составу команды: фамилия/имя, номер
              </div>
            </div>
          </form>
        </div>
      </div>

      <!-- Плитка-предупреждение (только для режима школы) -->
      <div
        v-if="!isAdminView"
        class="card section-card tile fade-in shadow-sm mb-3"
      >
        <div class="card-body">
          <div class="alert alert-warning small mb-0" role="alert">
            <div class="d-flex align-items-start">
              <i
                class="bi bi-exclamation-triangle-fill me-2 fs-5 text-warning"
                aria-hidden="true"
              ></i>
              <div>
                <p class="mb-1">
                  В случае ошибок в отображении сведений или любых технических
                  проблем — обращайтесь к сотрудникам отдела проведения
                  соревнований ФХМ через телеграм-чат
                  <a
                    href="https://t.me/+XMZeDBBSbqxjYzVi"
                    target="_blank"
                    rel="noopener"
                    >по ссылке</a
                  >.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs: Игроки / Тренерский штаб -->
      <ul class="nav nav-pills tab-selector mb-3" role="tablist">
        <li class="nav-item">
          <button
            class="nav-link"
            :class="{ active: activeTab === 'players' }"
            role="tab"
            :aria-selected="activeTab === 'players'"
            aria-controls="players-tab"
            @click="activeTab = 'players'"
          >
            Игроки ({{ filteredPlayers.length }})
          </button>
        </li>
        <li class="nav-item">
          <button
            class="nav-link"
            :class="{ active: activeTab === 'staff' }"
            role="tab"
            :aria-selected="activeTab === 'staff'"
            aria-controls="staff-tab"
            @click="activeTab = 'staff'"
          >
            Тренерский штаб ({{ filteredStaff.length }})
          </button>
        </li>
      </ul>

      <div
        v-show="activeTab === 'players'"
        id="players-tab"
        class="stacked-roles"
      >
        <!-- Вратари -->
        <div class="card section-card tile fade-in shadow-sm mb-3">
          <div class="card-body">
            <h3 class="h5 mb-3">Вратари ({{ goalies.length }})</h3>
            <div v-if="error" class="alert alert-danger">{{ error }}</div>
            <div v-else-if="loading" class="text-center py-3">
              <div class="spinner-border spinner-brand" role="status"></div>
            </div>
            <ul v-else class="list-group list-group-flush">
              <li v-for="p in goalies" :key="p.id" class="list-group-item">
                <div
                  class="d-flex align-items-start gap-3 clickable-row"
                  role="button"
                  tabindex="0"
                  @click="openPlayer(p)"
                  @keydown.enter="openPlayer(p)"
                >
                  <div
                    class="jersey badge bg-secondary-subtle text-dark fw-semibold"
                  >
                    {{ p.jersey_number ?? '—' }}
                  </div>
                  <div class="flex-grow-1">
                    <div class="fw-semibold">{{ p.full_name || '—' }}</div>
                    <div class="text-muted small">
                      {{ formatDate(p.date_of_birth) || '—' }}
                    </div>
                    <div
                      v-if="p.height || p.weight || p.grip"
                      class="text-muted small mt-1"
                    >
                      <span v-if="p.height">{{ p.height }} см</span>
                      <span v-if="p.height && (p.weight || p.grip)"> · </span>
                      <span v-if="p.weight">{{ p.weight }} кг</span>
                      <span v-if="p.weight && p.grip"> · </span>
                      <span v-if="p.grip">Хват: {{ p.grip }}</span>
                    </div>
                  </div>
                </div>
              </li>
              <li v-if="!goalies.length" class="list-group-item text-muted">
                Нет игроков.
              </li>
            </ul>
          </div>
        </div>

        <!-- Защитники -->
        <div class="card section-card tile fade-in shadow-sm mb-3">
          <div class="card-body">
            <h3 class="h5 mb-3">Защитники ({{ defenders.length }})</h3>
            <div v-if="error" class="alert alert-danger">{{ error }}</div>
            <div v-else-if="loading" class="text-center py-3">
              <div class="spinner-border spinner-brand" role="status"></div>
            </div>
            <ul v-else class="list-group list-group-flush">
              <li v-for="p in defenders" :key="p.id" class="list-group-item">
                <div
                  class="d-flex align-items-start gap-3 clickable-row"
                  role="button"
                  tabindex="0"
                  @click="openPlayer(p)"
                  @keydown.enter="openPlayer(p)"
                >
                  <div
                    class="jersey badge bg-secondary-subtle text-dark fw-semibold"
                  >
                    {{ p.jersey_number ?? '—' }}
                  </div>
                  <div class="flex-grow-1">
                    <div class="fw-semibold">{{ p.full_name || '—' }}</div>
                    <div class="text-muted small">
                      {{ formatDate(p.date_of_birth) || '—' }}
                    </div>
                    <div
                      v-if="p.height || p.weight || p.grip"
                      class="text-muted small mt-1"
                    >
                      <span v-if="p.height">{{ p.height }} см</span>
                      <span v-if="p.height && (p.weight || p.grip)"> · </span>
                      <span v-if="p.weight">{{ p.weight }} кг</span>
                      <span v-if="p.weight && p.grip"> · </span>
                      <span v-if="p.grip">Хват: {{ p.grip }}</span>
                    </div>
                  </div>
                </div>
              </li>
              <li v-if="!defenders.length" class="list-group-item text-muted">
                Нет игроков.
              </li>
            </ul>
          </div>
        </div>

        <!-- Нападающие -->
        <div class="card section-card tile fade-in shadow-sm mb-3">
          <div class="card-body">
            <h3 class="h5 mb-3">Нападающие ({{ forwards.length }})</h3>
            <div v-if="error" class="alert alert-danger">{{ error }}</div>
            <div v-else-if="loading" class="text-center py-3">
              <div class="spinner-border spinner-brand" role="status"></div>
            </div>
            <ul v-else class="list-group list-group-flush">
              <li v-for="p in forwards" :key="p.id" class="list-group-item">
                <div
                  class="d-flex align-items-start gap-3 clickable-row"
                  role="button"
                  tabindex="0"
                  @click="openPlayer(p)"
                  @keydown.enter="openPlayer(p)"
                >
                  <div
                    class="jersey badge bg-secondary-subtle text-dark fw-semibold"
                  >
                    {{ p.jersey_number ?? '—' }}
                  </div>
                  <div class="flex-grow-1">
                    <div class="fw-semibold">{{ p.full_name || '—' }}</div>
                    <div class="text-muted small">
                      {{ formatDate(p.date_of_birth) || '—' }}
                    </div>
                    <div
                      v-if="p.height || p.weight || p.grip"
                      class="text-muted small mt-1"
                    >
                      <span v-if="p.height">{{ p.height }} см</span>
                      <span v-if="p.height && (p.weight || p.grip)"> · </span>
                      <span v-if="p.weight">{{ p.weight }} кг</span>
                      <span v-if="p.weight && p.grip"> · </span>
                      <span v-if="p.grip">Хват: {{ p.grip }}</span>
                    </div>
                  </div>
                </div>
              </li>
              <li v-if="!forwards.length" class="list-group-item text-muted">
                Нет игроков.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Staff tab content -->
      <div
        v-show="activeTab === 'staff'"
        id="staff-tab"
        class="card section-card tile fade-in shadow-sm mb-3"
      >
        <div class="card-body">
          <h3 class="h5 mb-3">Тренерский штаб ({{ filteredStaff.length }})</h3>
          <div v-if="error" class="alert alert-danger">{{ error }}</div>
          <div v-else-if="loading" class="text-center py-3">
            <div class="spinner-border spinner-brand" role="status"></div>
          </div>
          <ul v-else class="list-group list-group-flush">
            <li
              v-for="s in filteredStaff"
              :key="s.id"
              class="list-group-item d-flex align-items-start gap-3"
            >
              <div
                class="avatar badge bg-secondary-subtle text-dark fw-semibold"
                aria-hidden="true"
              >
                <i class="bi bi-person-workspace"></i>
              </div>
              <div class="flex-grow-1">
                <div class="fw-semibold">{{ s.full_name || '—' }}</div>
                <div class="text-muted small">
                  {{ formatDate(s.date_of_birth) || '—' }}
                </div>
              </div>
            </li>
            <li v-if="!filteredStaff.length" class="list-group-item text-muted">
              Нет тренеров.
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default { name: 'SchoolPlayersRosterView' };
</script>

<style scoped>
.jersey {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.5rem;
}

.list-group-item {
  padding-left: 1rem;
  padding-right: 1rem;
}

/* Mobile spacing handled globally */

.clickable-row {
  cursor: pointer;
}

.clickable-row:hover {
  background-color: #f8f9fa;
}

/* Search tile layout */
.search-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-end;
}

.search-form .search-control {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-width: 280px;
}

.search-form .input-group {
  width: 100%;
}

.tab-selector .nav-link {
  border-radius: 0.75rem;
}

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.5rem;
}
</style>
