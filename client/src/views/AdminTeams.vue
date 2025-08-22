<script setup>
import { ref, reactive, onMounted, watch, computed } from 'vue';
import { RouterLink } from 'vue-router';
import Toast from 'bootstrap/js/dist/toast';
import PageNav from '../components/PageNav.vue';
import BrandSpinner from '../components/BrandSpinner.vue';
import TeamFiltersModal from '../components/TeamFiltersModal.vue';
import { apiFetch } from '../api.js';
import { loadPageSize, savePageSize } from '../utils/pageSize.js';

const teams = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(loadPageSize('adminTeamsPageSize', 10));
const q = ref('');
const filters = reactive({ clubId: '', birthYear: '', status: 'ACTIVE' });
const clubs = ref([]);
const loading = ref(false);
const syncing = ref(false);
const error = ref('');
const toastRef = ref(null);
const toastMessage = ref('');
let toast;

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value))
);

async function loadClubs() {
  const res = await apiFetch('/clubs?limit=1000');
  clubs.value = res.clubs || [];
}

async function loadTeams() {
  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      limit: String(pageSize.value),
    });
    const term = q.value.trim();
    if (term) params.set('search', term);
    if (filters.clubId) params.set('club_id', filters.clubId);
    if (filters.birthYear) params.set('birth_year', filters.birthYear);
    if (filters.status) params.set('status', filters.status);
    const res = await apiFetch(`/teams?${params}`);
    teams.value = res.teams || [];
    total.value = res.total || 0;
    const pages = Math.max(1, Math.ceil(total.value / pageSize.value));
    if (page.value > pages) page.value = pages;
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки команд';
    teams.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

async function sync() {
  syncing.value = true;
  try {
    const res = await apiFetch('/teams/sync', { method: 'POST' });
    await loadTeams();
    const s = res.stats?.teams || {};
    if (!toast) toast = new Toast(toastRef.value);
    toastMessage.value = `Синхронизировано команд: добавлено/обновлено ${s.upserts ?? 0}, удалено ${s.softDeletedTotal ?? 0} (архив: ${s.softDeletedArchived ?? 0}, отсутствуют: ${s.softDeletedMissing ?? 0})`;
    toast.show();
  } catch (e) {
    error.value = e.message;
  } finally {
    syncing.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadClubs(), loadTeams()]);
});
watch(page, loadTeams);
watch(pageSize, (val) => {
  page.value = 1;
  savePageSize('adminTeamsPageSize', val);
  loadTeams();
});

let searchTimeout;
watch(q, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    page.value = 1;
    loadTeams();
  }, 300);
});
function applyFilters(newFilters) {
  Object.assign(filters, newFilters);
  localStorage.setItem('adminTeamsFilters', JSON.stringify(filters));
  page.value = 1;
  loadTeams();
}

function resetFilters() {
  Object.assign(filters, { clubId: '', birthYear: '', status: 'ACTIVE' });
  localStorage.setItem('adminTeamsFilters', JSON.stringify(filters));
  page.value = 1;
  loadTeams();
}

onMounted(() => {
  try {
    const saved = localStorage.getItem('adminTeamsFilters');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(filters, { status: 'ACTIVE', ...parsed });
    }
  } catch {}
});

const activeFiltersCount = computed(() => {
  let c = 0;
  if (filters.clubId) c++;
  if (filters.birthYear) c++;
  if (filters.status && filters.status !== 'ACTIVE') c++;
  return c;
});
</script>

<template>
  <div class="py-4">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Команды</li>
        </ol>
      </nav>
      <h1 class="mb-3 text-start">Команды</h1>

      <div class="card section-card tile fade-in shadow-sm">
        <div class="card-body p-3">
          <div class="row g-2 align-items-end mb-3">
            <div class="col-12 col-sm">
              <div class="input-group">
                <span class="input-group-text"
                  ><i class="bi bi-search"></i
                ></span>
                <input
                  v-model="q"
                  type="search"
                  class="form-control"
                  placeholder="Поиск по названию"
                  aria-label="Поиск команд"
                />
              </div>
            </div>
            <div class="col-6 col-sm-auto">
              <button
                class="btn btn-outline-secondary w-100"
                type="button"
                @click="filtersModal.open()"
              >
                <i class="bi bi-funnel me-1" aria-hidden="true"></i>
                Фильтры
                <span
                  v-if="activeFiltersCount"
                  class="badge text-bg-secondary ms-2"
                >
                  {{ activeFiltersCount }}
                </span>
              </button>
            </div>
            <div class="col-12 col-sm-auto">
              <button
                class="btn btn-outline-secondary w-100"
                :disabled="syncing"
                @click="sync"
              >
                <span
                  v-if="syncing"
                  class="spinner-border spinner-border-sm me-2"
                ></span>
                Синхронизировать
              </button>
            </div>
          </div>
          <div v-if="error" class="alert alert-danger mb-2">{{ error }}</div>
          <BrandSpinner v-if="loading" label="Загрузка" />
          <div v-else>
            <div v-if="teams.length" class="table-responsive d-none d-sm-block">
              <table class="table admin-table table-striped align-middle mb-0">
                <thead>
                  <tr>
                    <th>Команда</th>
                    <th>Год</th>
                    <th>Клуб</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="t in teams" :key="t.id">
                    <td>{{ t.name }}</td>
                    <td>{{ t.birth_year || '' }}</td>
                    <td>{{ t.club?.name || '—' }}</td>
                  </tr>
                </tbody>
              </table>
              <PageNav
                v-if="teams.length"
                v-model:page="page"
                v-model:page-size="pageSize"
                :total-pages="totalPages"
                :sizes="[10, 20, 50]"
              />
            </div>
            <div v-if="teams.length" class="d-block d-sm-none">
              <div v-for="t in teams" :key="t.id" class="card mb-2">
                <div class="card-body p-2">
                  <h3 class="h6 mb-1">{{ t.name }}</h3>
                  <p v-if="t.birth_year" class="mb-1 small">
                    Год: {{ t.birth_year }}
                  </p>
                  <p class="mb-0 small">Клуб: {{ t.club?.name || '—' }}</p>
                </div>
              </div>
              <PageNav
                v-if="teams.length"
                v-model:page="page"
                v-model:page-size="pageSize"
                :total-pages="totalPages"
                :sizes="[10, 20, 50]"
              />
            </div>
            <div v-else class="alert alert-warning mb-0">
              Команды не найдены.
            </div>
          </div>
        </div>
      </div>
    </div>
    <TeamFiltersModal
      ref="filtersModal"
      :filters="filters"
      :clubs="clubs"
      @apply="applyFilters"
      @reset="resetFilters"
    />
    <div class="toast-container position-fixed bottom-0 end-0 p-3">
      <div
        ref="toastRef"
        class="toast text-bg-secondary"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div class="toast-body">{{ toastMessage }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}
</style>
