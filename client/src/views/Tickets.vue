<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api';
import PageNav from '../components/PageNav.vue';
import { loadPageSize, savePageSize } from '../utils/pageSize';

const tickets = ref([]);
const loading = ref(true);
const error = ref('');
const view = ref('active');
const search = ref('');
const archivePage = ref(1);
const pageSize = ref(loadPageSize('clientTicketsPageSize', 10));

const activeTickets = computed(() =>
  tickets.value.filter((t) =>
    ['CREATED', 'IN_PROGRESS'].includes(t.status.alias)
  )
);
const archivedTickets = computed(() =>
  tickets.value
    .filter((t) => !['CREATED', 'IN_PROGRESS'].includes(t.status.alias))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
);
const filteredArchivedTickets = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return archivedTickets.value;
  return archivedTickets.value.filter(
    (t) =>
      String(t.number).includes(q) ||
      (t.description || '').toLowerCase().includes(q)
  );
});
const totalArchivePages = computed(() =>
  Math.max(1, Math.ceil(filteredArchivedTickets.value.length / pageSize.value))
);
const paginatedArchivedTickets = computed(() => {
  const start = (archivePage.value - 1) * pageSize.value;
  return filteredArchivedTickets.value.slice(start, start + pageSize.value);
});
const currentTickets = computed(() =>
  view.value === 'active' ? activeTickets.value : paginatedArchivedTickets.value
);
const noTicketsMessage = computed(() => {
  if (view.value === 'active') return 'Нет активных обращений.';
  return search.value ? 'Ничего не найдено.' : 'Архив пуст.';
});

watch(search, () => {
  archivePage.value = 1;
});
watch(pageSize, (val) => {
  archivePage.value = 1;
  savePageSize('clientTicketsPageSize', val);
});
watch(view, (v) => {
  if (v === 'archive') {
    archivePage.value = 1;
  }
});

function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  });
}

onMounted(loadTickets);

async function loadTickets() {
  loading.value = true;
  try {
    const data = await apiFetch('/tickets/me');
    tickets.value = data.tickets || [];
    error.value = '';
  } catch (e) {
    error.value = e.message;
    tickets.value = [];
  } finally {
    loading.value = false;
  }
}

async function deleteTicket(ticket) {
  if (!confirm('Удалить обращение?')) return;
  try {
    await apiFetch(`/tickets/${ticket.id}`, { method: 'DELETE' });
    tickets.value = tickets.value.filter((t) => t.id !== ticket.id);
  } catch (e) {
    alert(e.message);
  }
}
</script>

<template>
  <div class="py-3 tickets-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/">Главная</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Обращения</li>
        </ol>
      </nav>
      <h1 class="mb-3">Мои обращения</h1>
      <div class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body">
          <ul class="nav nav-pills nav-fill mb-0 tab-selector">
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: view === 'active' }"
                @click="view = 'active'"
              >
                Активные
              </button>
            </li>
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: view === 'archive' }"
                @click="view = 'archive'"
              >
                Архив
              </button>
            </li>
          </ul>
        </div>
      </div>
      <div class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body">
          <h2 class="h5 mb-3">История</h2>
          <div v-if="view === 'archive'" class="row g-2 align-items-end mb-3">
            <div class="col-12 col-sm">
              <input
                v-model="search"
                type="text"
                class="form-control"
                placeholder="Поиск по номеру или содержимому"
              />
            </div>
          </div>
          <div v-if="error" class="alert alert-danger">{{ error }}</div>
          <div v-if="loading" class="text-center py-3">
            <div class="spinner-border" role="status"></div>
          </div>
          <div v-if="currentTickets.length" class="vstack gap-3">
            <div
              v-for="t in currentTickets"
              :key="t.id"
              class="border rounded p-3 tile"
            >
              <div
                class="d-flex justify-content-between align-items-start mb-2"
              >
                <h6 class="mb-0">{{ t.type.name }}</h6>
                <span class="badge bg-secondary">{{ t.status.name }}</span>
              </div>
              <p class="text-muted small mb-1">
                № {{ t.number }} · {{ formatDateTime(t.created_at) }}
              </p>
              <p class="mb-2">{{ t.description || '—' }}</p>
              <div
                v-if="t.files && t.files.length"
                class="d-flex flex-wrap gap-2"
              >
                <a
                  v-for="f in t.files"
                  :key="f.id"
                  :href="f.url"
                  target="_blank"
                  rel="noopener"
                  class="file-tile d-flex align-items-center gap-1 text-decoration-none text-body p-1 border rounded"
                >
                  <i class="bi bi-file-earmark" aria-hidden="true"></i>
                  <span class="text-break">{{ f.name }}</span>
                </a>
              </div>
              <p v-else class="text-muted small mb-0">Нет файлов</p>
              <button
                v-if="t.status.alias === 'CREATED'"
                class="btn btn-sm btn-outline-danger mt-2"
                @click="deleteTicket(t)"
              >
                Удалить
              </button>
            </div>
          </div>
          <p v-else-if="!loading" class="text-muted mb-0">
            {{ noTicketsMessage }}
          </p>
        </div>
        <PageNav
          v-if="view === 'archive' && totalArchivePages > 1"
          v-model:page="archivePage"
          v-model:page-size="pageSize"
          :total-pages="totalArchivePages"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-in {
  animation: fadeIn 0.4s ease-out;
}

/* Uses global .section-card and .tab-selector from brand.css */

/* Mobile paddings and section card gutters are handled globally */

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
