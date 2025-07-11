<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';

const tickets = ref([]);
const loading = ref(true);
const error = ref('');

const description = ref('');
const creating = ref(false);
const creationError = ref('');

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

async function createTicket() {
  if (creating.value) return;
  creating.value = true;
  try {
    const { ticket } = await apiFetch('/tickets', {
      method: 'POST',
      body: JSON.stringify({
        type_alias: 'MED_CERT_UPLOAD',
        description: description.value,
      }),
    });
    tickets.value.push(ticket);
    description.value = '';
    creationError.value = '';
  } catch (e) {
    creationError.value = e.message;
  } finally {
    creating.value = false;
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
      <div class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body">
          <h5 class="mb-3">Новое обращение</h5>
          <div v-if="creationError" class="alert alert-danger">{{ creationError }}</div>
          <textarea
            class="form-control mb-2"
            rows="3"
            v-model="description"
            placeholder="Описание"
          ></textarea>
          <button class="btn btn-brand" @click="createTicket" :disabled="creating">
            <span v-if="creating" class="spinner-border spinner-border-sm me-2"></span>
            Отправить
          </button>
        </div>
      </div>
      <div class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <h5 class="mb-3">История</h5>
          <div v-if="error" class="alert alert-danger">{{ error }}</div>
          <div v-if="loading" class="text-center py-3">
            <div class="spinner-border" role="status"></div>
          </div>
          <div v-if="tickets.length" class="table-responsive">
            <table class="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Тип</th>
                  <th>Описание</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in tickets" :key="t.id">
                  <td>{{ t.type.name }}</td>
                  <td>{{ t.description }}</td>
                  <td>{{ t.status.name }}</td>
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
