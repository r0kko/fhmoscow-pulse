<script setup>
import { ref, watch, nextTick } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';

const userQuery = ref('');
const userSuggestions = ref([]);
const selectedUser = ref(null);
let userTimeout;
let selecting = false;

const tickets = ref([]);
const loading = ref(false);
const error = ref('');

const description = ref('');
const creating = ref(false);
const createError = ref('');

watch(userQuery, () => {
  clearTimeout(userTimeout);
  if (!selecting && selectedUser.value) {
    selectedUser.value = null;
    tickets.value = [];
  }
  if (!userQuery.value || userQuery.value.length < 2) {
    userSuggestions.value = [];
    return;
  }
  userTimeout = setTimeout(async () => {
    try {
      const params = new URLSearchParams({ search: userQuery.value, limit: 5 });
      const data = await apiFetch(`/users?${params}`);
      userSuggestions.value = data.users;
    } catch (_err) {
      userSuggestions.value = [];
    }
  }, 300);
});

function selectUser(u) {
  selecting = true;
  selectedUser.value = u;
  userQuery.value = `${u.last_name} ${u.first_name}`;
  userSuggestions.value = [];
  nextTick(() => {
    selecting = false;
  });
  loadTickets();
}

async function loadTickets() {
  if (!selectedUser.value) return;
  loading.value = true;
  try {
    const data = await apiFetch(`/users/${selectedUser.value.id}/tickets`);
    tickets.value = data.tickets || [];
    error.value = '';
  } catch (e) {
    error.value = e.message;
    tickets.value = [];
  } finally {
    loading.value = false;
  }
}

async function createTicket() {
  if (!selectedUser.value || creating.value) return;
  creating.value = true;
  try {
    const { ticket } = await apiFetch(
      `/users/${selectedUser.value.id}/tickets`,
      {
        method: 'POST',
        body: JSON.stringify({
          type_alias: 'MED_CERT_UPLOAD',
          description: description.value,
        }),
      }
    );
    tickets.value.push(ticket);
    description.value = '';
    createError.value = '';
  } catch (e) {
    createError.value = e.message;
  } finally {
    creating.value = false;
  }
}

async function changeStatus(ticket, alias) {
  if (!selectedUser.value) return;
  try {
    const { ticket: updated } = await apiFetch(
      `/users/${selectedUser.value.id}/tickets/${ticket.id}`,
      {
        method: 'PUT',
        body: JSON.stringify({ status_alias: alias }),
      }
    );
    const idx = tickets.value.findIndex((t) => t.id === ticket.id);
    if (idx !== -1) tickets.value[idx] = updated;
  } catch (e) {
    alert(e.message);
  }
}

async function removeTicket(ticket) {
  if (!selectedUser.value) return;
  if (!confirm('Удалить обращение?')) return;
  try {
    await apiFetch(
      `/users/${selectedUser.value.id}/tickets/${ticket.id}`,
      { method: 'DELETE' }
    );
    tickets.value = tickets.value.filter((t) => t.id !== ticket.id);
  } catch (e) {
    alert(e.message);
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
        <div class="mb-3 position-relative">
          <div class="form-floating">
            <input
              id="userSearch"
              v-model="userQuery"
              class="form-control"
              placeholder="Пользователь"
            />
            <label for="userSearch">Пользователь</label>
          </div>
          <ul
            v-if="userSuggestions.length"
            class="list-group position-absolute w-100"
            style="z-index: 1050"
          >
            <li
              v-for="u in userSuggestions"
              :key="u.id"
              class="list-group-item list-group-item-action"
              @mousedown.prevent="selectUser(u)"
            >
              {{ u.last_name }} {{ u.first_name }}
            </li>
          </ul>
        </div>
        <div v-if="selectedUser">
          <h5 class="mb-3">
            {{ selectedUser.last_name }} {{ selectedUser.first_name }}
          </h5>
          <div class="mb-3">
            <textarea
              class="form-control mb-2"
              v-model="description"
              placeholder="Описание"
              rows="3"
            ></textarea>
            <div v-if="createError" class="alert alert-danger">{{ createError }}</div>
            <button class="btn btn-brand" @click="createTicket" :disabled="creating">
              <span v-if="creating" class="spinner-border spinner-border-sm me-2"></span>
              Создать
            </button>
          </div>
          <div v-if="error" class="alert alert-danger">{{ error }}</div>
          <div v-if="loading" class="text-center my-3">
            <div class="spinner-border" role="status"></div>
          </div>
          <div v-if="tickets.length" class="table-responsive">
            <table class="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Тип</th>
                  <th>Описание</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in tickets" :key="t.id">
                  <td>{{ t.type.name }}</td>
                  <td>{{ t.description }}</td>
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
                        <li><button class="dropdown-item" @click="changeStatus(t, 'CREATED')">Создан</button></li>
                        <li><button class="dropdown-item" @click="changeStatus(t, 'IN_PROGRESS')">В работе</button></li>
                        <li><button class="dropdown-item" @click="changeStatus(t, 'CONFIRMED')">Подтвержден</button></li>
                        <li><button class="dropdown-item" @click="changeStatus(t, 'REJECTED')">Отклонен</button></li>
                      </ul>
                      <button class="btn btn-sm btn-danger ms-2" @click="removeTicket(t)">
                        <i class="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
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
