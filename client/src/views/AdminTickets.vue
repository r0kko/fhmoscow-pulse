<script setup>
import { ref, onMounted, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';

const tickets = ref([]);
const loading = ref(true);
const error = ref('');
const userFilter = ref('');
const typeFilter = ref('');
const statusFilter = ref('active');
const ticketTypes = ref([]);

onMounted(loadTickets);

watch(typeFilter, loadTickets);
watch(statusFilter, loadTickets);
let searchTimeout;
watch(userFilter, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(loadTickets, 300);
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

async function loadTickets() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (userFilter.value) params.set('user', userFilter.value);
    if (typeFilter.value) params.set('type', typeFilter.value);
    if (statusFilter.value) params.set('status', statusFilter.value);
    const query = params.toString();
    const data = await apiFetch(`/tickets${query ? `?${query}` : ''}`);
    tickets.value = data.tickets || [];
    const typesMap = {};
    tickets.value.forEach((t) => {
      if (t.type && !typesMap[t.type.alias]) {
        typesMap[t.type.alias] = t.type.name;
      }
    });
    ticketTypes.value = Object.entries(typesMap).map(([alias, name]) => ({ alias, name }));
    error.value = '';
  } catch (e) {
    tickets.value = [];
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function changeStatus(ticket, alias) {
  try {
    const { ticket: updated } = await apiFetch(`/tickets/${ticket.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status_alias: alias }),
    });
    const idx = tickets.value.findIndex((t) => t.id === ticket.id);
    if (idx !== -1) tickets.value[idx] = { ...updated, _flash: true };
    setTimeout(() => {
      const t = tickets.value.find((tt) => tt.id === ticket.id);
      if (t) t._flash = false;
    }, 1000);
  } catch (e) {
    alert(e.message);
  }
}

</script>

<template>
  <div class="container mt-4 admin-tickets-page">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item">
          <RouterLink to="/admin">Администрирование</RouterLink>
        </li>
        <li class="breadcrumb-item active" aria-current="page">Обращения</li>
      </ol>
    </nav>
    <h1>Обращения</h1>
    <div class="card section-card tile fade-in shadow-sm mb-3">
      <div class="card-body">
        <div class="row g-2 align-items-end mb-3">
          <div class="col-12 col-sm">
            <input
              type="text"
              class="form-control"
              placeholder="Пользователь"
              v-model="userFilter"
            />
          </div>
          <div class="col-6 col-sm-auto">
            <select v-model="typeFilter" class="form-select">
              <option value="">Все типы</option>
              <option v-for="t in ticketTypes" :key="t.alias" :value="t.alias">
                {{ t.name }}
              </option>
            </select>
          </div>
          <div class="col-6 col-sm-auto">
            <select v-model="statusFilter" class="form-select">
              <option value="active">Активные</option>
              <option value="completed">Завершенные</option>
            </select>
          </div>
        </div>
        <div v-if="error" class="alert alert-danger">{{ error }}</div>
        <div v-if="loading" class="text-center my-3">
          <div class="spinner-border" role="status"></div>
        </div>
        <div v-if="tickets.length" class="table-responsive d-none d-sm-block">
          <table class="table align-middle mb-0">
            <thead>
              <tr>
                <th>Пользователь</th>
                <th class="d-none d-md-table-cell">Дата</th>
                <th>Номер</th>
                <th>Тип</th>
                <th>Описание</th>
                <th>Файлы</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in tickets" :key="t.id" :class="{ flash: t._flash }">
                <td>{{ t.user.last_name }} {{ t.user.first_name }}</td>
                <td class="d-none d-md-table-cell">{{ formatDateTime(t.created_at) }}</td>
                <td>{{ t.number }}</td>
                <td>{{ t.type.name }}</td>
                <td>{{ t.description }}</td>
                <td>
                  <div v-for="f in t.files" :key="f.id">
                    <a :href="f.url" target="_blank" rel="noopener">{{
                      f.name
                    }}</a>
                  </div>
                </td>
                <td>{{ t.status.name }}</td>
                <td class="text-end">
                  <template v-if="t.status.alias === 'CREATED'">
                    <button
                      class="btn btn-sm btn-outline-secondary me-2"
                      @click="changeStatus(t, 'IN_PROGRESS')"
                    >
                      В работу
                    </button>
                  </template>
                  <template v-else-if="t.status.alias === 'IN_PROGRESS'">
                    <button
                      class="btn btn-sm btn-success me-2"
                      @click="changeStatus(t, 'CONFIRMED')"
                      title="Подтвердить"
                    >
                      <i class="bi bi-check-lg"></i>
                    </button>
                    <button
                      class="btn btn-sm btn-danger me-2"
                      @click="changeStatus(t, 'REJECTED')"
                      title="Отклонить"
                    >
                      <i class="bi bi-x-lg"></i>
                    </button>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="tickets.length" class="d-block d-sm-none">
          <div v-for="t in tickets" :key="t.id" class="card ticket-card mb-2">
            <div class="card-body p-2">
              <p class="mb-1 fw-semibold">
                {{ t.user.last_name }} {{ t.user.first_name }}
              </p>
              <p class="mb-1 text-muted small">
                № {{ t.number }} · {{ formatDateTime(t.created_at) }}
              </p>
              <p class="mb-1">{{ t.type.name }}</p>
              <p class="mb-1">{{ t.description }}</p>
              <div v-if="t.files && t.files.length" class="mb-1">
                <div v-for="f in t.files" :key="f.id">
                  <a :href="f.url" target="_blank" rel="noopener">{{ f.name }}</a>
                </div>
              </div>
              <p class="mb-1"><span class="badge bg-secondary">{{ t.status.name }}</span></p>
              <div class="mt-1 text-end">
                <template v-if="t.status.alias === 'CREATED'">
                  <button
                    class="btn btn-sm btn-outline-secondary me-2"
                    @click="changeStatus(t, 'IN_PROGRESS')"
                  >
                    В работу
                  </button>
                </template>
                <template v-else-if="t.status.alias === 'IN_PROGRESS'">
                  <button
                    class="btn btn-sm btn-success me-2"
                    @click="changeStatus(t, 'CONFIRMED')"
                    title="Подтвердить"
                  >
                    <i class="bi bi-check-lg"></i>
                  </button>
                  <button
                    class="btn btn-sm btn-danger me-2"
                    @click="changeStatus(t, 'REJECTED')"
                    title="Отклонить"
                  >
                    <i class="bi bi-x-lg"></i>
                  </button>
                </template>
              </div>
            </div>
          </div>
        </div>
        <p v-else-if="!loading" class="text-muted mb-0">Нет обращений.</p>
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

.fade-in {
  animation: fadeIn 0.4s ease-out;
}


.flash {
  animation: flash-bg 1s ease-out;
}

.ticket-card {
  border-radius: 0.5rem;
  border: 1px solid #dee2e6;
}

@media (max-width: 575.98px) {
  .admin-tickets-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
  }


  .section-card {
    margin-left: -1rem;
    margin-right: -1rem;
  }
}

@keyframes flash-bg {
  from {
    background-color: #fff3cd;
  }
  to {
    background-color: transparent;
  }
}

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
