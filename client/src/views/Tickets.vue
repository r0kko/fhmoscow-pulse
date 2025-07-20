<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';

const tickets = ref([]);
const loading = ref(true);
const error = ref('');

function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
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
      <nav aria-label="breadcrumb" class="mb-2">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item"><RouterLink to="/">Главная</RouterLink></li>
          <li class="breadcrumb-item active" aria-current="page">Обращения</li>
        </ol>
      </nav>
      <h1 class="mb-3">Мои обращения</h1>
      <div class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <h5 class="mb-3">История</h5>
          <div v-if="error" class="alert alert-danger">{{ error }}</div>
          <div v-if="loading" class="text-center py-3">
            <div class="spinner-border" role="status"></div>
          </div>
          <div v-if="tickets.length" class="vstack gap-3">
            <div
              v-for="t in tickets"
              :key="t.id"
              class="border rounded p-3 tile"
            >
              <div class="d-flex justify-content-between align-items-start mb-2">
                <h6 class="mb-0">{{ t.type.name }}</h6>
                <span class="badge bg-secondary">{{ t.status.name }}</span>
              </div>
              <p class="text-muted small mb-1">{{ formatDateTime(t.created_at) }}</p>
              <p class="mb-2">{{ t.description || '—' }}</p>
              <div v-if="t.files && t.files.length" class="d-flex flex-wrap gap-2">
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
          <p v-else-if="!loading" class="text-muted mb-0">Нет обращений.</p>
        </div>
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
