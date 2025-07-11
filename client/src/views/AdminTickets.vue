<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';

const tickets = ref([]);
const loading = ref(true);
const error = ref('');

onMounted(loadTickets);

async function loadTickets() {
  loading.value = true;
  try {
    const data = await apiFetch('/tickets');
    tickets.value = data.tickets || [];
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

async function progress(ticket) {
  ticket._changing = true;
  try {
    const { ticket: updated } = await apiFetch(`/tickets/${ticket.id}/progress`, {
      method: 'POST',
    });
    const idx = tickets.value.findIndex((t) => t.id === ticket.id);
    if (idx !== -1) tickets.value[idx] = { ...updated, _flash: true };
    setTimeout(() => {
      const t = tickets.value.find((tt) => tt.id === ticket.id);
      if (t) t._flash = false;
    }, 1000);
  } catch (e) {
    alert(e.message);
  } finally {
    ticket._changing = false;
  }
}
</script>

<template>
  <div class="container mt-4">
    <nav aria-label="breadcrumb" class="mb-3">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item">
          <RouterLink to="/admin">Администрирование</RouterLink>
        </li>
        <li class="breadcrumb-item active" aria-current="page">Обращения</li>
      </ol>
    </nav>
    <h1 class="mb-3">Обращения</h1>
    <div class="card section-card tile fade-in shadow-sm">
      <div class="card-body">
        <div v-if="error" class="alert alert-danger">{{ error }}</div>
        <div v-if="loading" class="text-center my-3">
          <div class="spinner-border" role="status"></div>
        </div>
        <div v-if="tickets.length" class="table-responsive">
          <table class="table align-middle mb-0">
            <thead>
              <tr>
                <th>Пользователь</th>
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
                <td>{{ t.type.name }}</td>
                <td>{{ t.description }}</td>
                <td>
                  <div v-for="f in t.files" :key="f.id">
                    <a :href="f.url" target="_blank" rel="noopener">{{ f.name }}</a>
                  </div>
                </td>
                <td>{{ t.status.name }}</td>
                <td class="text-end">
                  <div class="btn-group">
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-secondary dropdown-toggle"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      Статус
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                      <li>
                        <button class="dropdown-item" @click="changeStatus(t, 'CREATED')">
                          Создан
                        </button>
                      </li>
                      <li>
                        <button class="dropdown-item" @click="changeStatus(t, 'IN_PROGRESS')">
                          В работе
                        </button>
                      </li>
                      <li>
                        <button class="dropdown-item" @click="changeStatus(t, 'CONFIRMED')">
                          Подтвержден
                        </button>
                      </li>
                      <li>
                        <button class="dropdown-item" @click="changeStatus(t, 'REJECTED')">
                          Отклонен
                        </button>
                      </li>
                    </ul>
                  </div>
                  <button
                    class="btn btn-sm btn-brand ms-2"
                    @click="progress(t)"
                    :disabled="t._changing"
                  >
                    <span
                      v-if="t._changing"
                      class="spinner-border spinner-border-sm me-1"
                    ></span>
                    Далее
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
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

.flash {
  animation: flash-bg 1s ease-out;
}

@keyframes flash-bg {
  from {
    background-color: #fff3cd;
  }
  to {
    background-color: transparent;
  }
}
</style>
