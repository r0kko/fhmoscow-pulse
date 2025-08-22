<script setup>
import { ref, onMounted } from 'vue';
import Toast from 'bootstrap/js/dist/toast';
import { apiFetch } from '../api.js';

const clubs = ref([]);
const filtered = ref([]);
const q = ref('');
const loading = ref(false);
const syncing = ref(false);
const error = ref('');
const toastRef = ref(null);
const toastMessage = ref('');
let toast;

function showToast(message) {
  toastMessage.value = message;
  if (!toast) toast = new Toast(toastRef.value);
  toast.show();
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await apiFetch('/clubs');
    clubs.value = res.clubs || [];
    applyFilter();
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки клубов';
  } finally {
    loading.value = false;
  }
}

function applyFilter() {
  const term = q.value.trim().toLowerCase();
  filtered.value = !term
    ? clubs.value
    : clubs.value.filter((c) => (c.name || '').toLowerCase().includes(term));
}

async function syncClubs() {
  syncing.value = true;
  error.value = '';
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
</script>

<template>
  <div class="py-4 admin-clubs-page">
    <div class="container">
      <h1 class="mb-3 text-start">Клубы</h1>

      <div class="card section-card tile fade-in shadow-sm">
        <div class="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center">
          <h2 class="h5 mb-0">Список клубов</h2>
          <div class="d-flex gap-2 align-items-center flex-wrap">
            <div class="input-group input-group-sm" style="min-width: 260px">
              <span class="input-group-text" id="search-addon">
                <i class="bi bi-search" aria-hidden="true"></i>
              </span>
              <input
                v-model="q"
                type="text"
                class="form-control"
                placeholder="Поиск по названию"
                @input="applyFilter"
                aria-label="Поиск клубов"
              />
            </div>
            <button class="btn btn-outline-secondary btn-sm" :disabled="syncing" @click="syncClubs">
              <span v-if="syncing" class="spinner-border spinner-border-sm me-2"></span>
              Синхронизировать
            </button>
          </div>
        </div>

        <div class="card-body p-3">
          <div v-if="error" class="alert alert-danger mb-2">{{ error }}</div>
          <div v-if="loading" class="text-center my-4">
            <span class="spinner-border spinner-brand" aria-hidden="true"></span>
          </div>
          <div v-else>
            <div v-if="filtered.length" class="table-responsive">
              <table class="table admin-table table-striped align-middle mb-0">
                <thead>
                  <tr>
                    <th>Название</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in filtered" :key="c.id">
                    <td>{{ c.name }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="alert alert-warning mb-0">Клубов не найдено.</div>
          </div>
        </div>
      </div>
    </div>

    <div class="toast-container position-fixed bottom-0 end-0 p-3">
      <div ref="toastRef" class="toast text-bg-secondary" role="status" aria-live="polite" aria-atomic="true">
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
