<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useToast } from '../utils/toast.js';
import { apiFetch } from '../api.js';
import PageNav from '../components/PageNav.vue';
import BrandSpinner from '../components/BrandSpinner.vue';
import { loadPageSize, savePageSize } from '../utils/pageSize.js';

const clubs = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(loadPageSize('adminClubsPageSize', 10));
const q = ref('');
const loading = ref(false);
const syncing = ref(false);
const error = ref('');
const { showToast } = useToast();

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value))
);

// global toast via useToast()

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      limit: String(pageSize.value),
    });
    // Request both teams and grounds using repeated include params
    params.append('include', 'teams');
    params.append('include', 'grounds');
    const term = q.value.trim();
    if (term) params.set('search', term);
    const res = await apiFetch(`/clubs?${params}`);
    clubs.value = res.clubs || [];
    total.value = res.total || 0;
    const pages = Math.max(1, Math.ceil(total.value / pageSize.value));
    if (page.value > pages) page.value = pages;
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки клубов';
    clubs.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

async function syncClubs() {
  syncing.value = true;
  try {
    const res = await apiFetch('/clubs/sync', { method: 'POST' });
    await load();
    const s = res.stats || {};
    showToast(
      `Синхронизировано клубов: добавлено/обновлено ${s.upserts ?? 0}, удалено ${s.softDeletedTotal ?? 0} (архив: ${s.softDeletedArchived ?? 0}, отсутствуют: ${s.softDeletedMissing ?? 0})`
    );
  } catch (e) {
    showToast(e.message || 'Ошибка синхронизации');
  } finally {
    syncing.value = false;
  }
}

onMounted(load);
watch(page, load);
watch(pageSize, (val) => {
  page.value = 1;
  savePageSize('adminClubsPageSize', val);
  load();
});

let searchTimeout;
watch(q, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    page.value = 1;
    load();
  }, 300);
});
</script>

<template>
  <div class="py-4 admin-clubs-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Клубы</li>
        </ol>
      </nav>
      <h1 class="mb-3 text-start">Клубы</h1>

      <div class="card section-card tile fade-in shadow-sm">
        <div class="card-body p-3">
          <div class="row g-2 align-items-end mb-3">
            <div class="col-12 col-sm">
              <div class="input-group">
                <span id="search-addon" class="input-group-text">
                  <i class="bi bi-search" aria-hidden="true"></i>
                </span>
                <input
                  v-model="q"
                  type="search"
                  class="form-control"
                  placeholder="Поиск по названию"
                  aria-label="Поиск клубов"
                />
              </div>
            </div>
            <div class="col-12 col-sm-auto">
              <button
                class="btn btn-outline-secondary w-100"
                :disabled="syncing"
                @click="syncClubs"
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
            <div v-if="clubs.length" class="table-responsive d-none d-sm-block">
              <table class="table admin-table table-striped align-middle mb-0">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Команды</th>
                    <th class="d-none d-lg-table-cell">Площадки</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in clubs" :key="c.id">
                    <td>{{ c.name }}</td>
                    <td>
                      <div
                        v-if="c.teams?.length"
                        class="d-flex flex-wrap gap-1"
                      >
                        <span
                          v-for="t in c.teams"
                          :key="t.id"
                          class="badge text-bg-light border"
                        >
                          {{ t.name
                          }}<span v-if="t.birth_year">
                            ({{ t.birth_year }})</span
                          >
                        </span>
                      </div>
                      <span v-else class="text-muted">—</span>
                    </td>
                    <td class="d-none d-lg-table-cell">
                      <div
                        v-if="c.grounds?.length"
                        class="d-flex flex-wrap gap-1"
                      >
                        <span
                          v-for="g in c.grounds"
                          :key="g.id"
                          class="badge text-bg-light border"
                          >{{ g.name }}</span
                        >
                      </div>
                      <span v-else class="text-muted">—</span>
                      <div class="mt-1">
                        <RouterLink
                          to="/admin/grounds"
                          class="small link-secondary text-decoration-none"
                        >
                          Управлять
                        </RouterLink>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              <PageNav
                v-if="clubs.length"
                v-model:page="page"
                v-model:page-size="pageSize"
                :total-pages="totalPages"
                :sizes="[10, 20, 50]"
              />
            </div>
            <div v-if="clubs.length" class="d-block d-sm-none">
              <div v-for="c in clubs" :key="c.id" class="card mb-2">
                <div class="card-body p-2">
                  <h3 class="h6 mb-1">{{ c.name }}</h3>
                  <div
                    v-if="c.teams?.length"
                    class="d-flex flex-wrap gap-1 small"
                  >
                    <span
                      v-for="t in c.teams"
                      :key="t.id"
                      class="badge text-bg-light border"
                    >
                      {{ t.name
                      }}<span v-if="t.birth_year"> ({{ t.birth_year }})</span>
                    </span>
                  </div>
                  <p v-else class="mb-0 small text-muted">Команд нет</p>
                  <div
                    class="d-flex align-items-start gap-1 flex-wrap small mt-1"
                  >
                    <span class="text-muted">Площадки:</span>
                    <template v-if="c.grounds?.length">
                      <span
                        v-for="g in c.grounds"
                        :key="g.id"
                        class="badge text-bg-light border"
                        >{{ g.name }}</span
                      >
                    </template>
                    <span v-else class="text-muted">—</span>
                    <RouterLink
                      to="/admin/grounds"
                      class="ms-2 link-secondary text-decoration-none"
                      >Управлять</RouterLink
                    >
                  </div>
                </div>
              </div>
              <PageNav
                v-if="clubs.length"
                v-model:page="page"
                v-model:page-size="pageSize"
                :total-pages="totalPages"
                :sizes="[10, 20, 50]"
              />
            </div>
            <div v-else class="alert alert-warning mb-0">
              Клубов не найдено.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
