<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';

const trainings = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = 10;
const loading = ref(true);
const error = ref('');

function formatDateTimeRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return (
    s.toLocaleDateString() +
    ' ' +
    s.toLocaleTimeString().slice(0, 5) +
    ' - ' +
    e.toLocaleDateString() +
    ' ' +
    e.toLocaleTimeString().slice(0, 5)
  );
}

async function load() {
  loading.value = true;
  try {
    const data = await apiFetch(
      `/camp-trainings/available?page=${page.value}&limit=${pageSize}`
    );
    trainings.value = data.trainings || [];
    total.value = data.total || 0;
    error.value = '';
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function register(id) {
  try {
    await apiFetch(`/camp-trainings/${id}/register`, { method: 'POST' });
    await load();
  } catch (e) {
    error.value = e.message;
  }
}

async function unregister(id) {
  try {
    await apiFetch(`/camp-trainings/${id}/register`, { method: 'DELETE' });
    await load();
  } catch (e) {
    error.value = e.message;
  }
}

onMounted(load);
</script>

<template>
  <div class="container my-4">
    <nav aria-label="breadcrumb" class="mb-3">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item"><RouterLink to="/">Главная</RouterLink></li>
        <li class="breadcrumb-item active" aria-current="page">Сборы</li>
      </ol>
    </nav>
    <h1 class="mb-4">Запись на сборы</h1>
    <div v-if="loading" class="text-center my-5">
      <div class="spinner-border" role="status" aria-label="Загрузка">
        <span class="visually-hidden">Загрузка…</span>
      </div>
    </div>
    <div v-else>
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-if="trainings.length" class="table-responsive">
        <table class="table table-striped align-middle mb-0">
          <thead>
            <tr>
              <th>Тип</th>
              <th>Стадион</th>
              <th>Дата и время</th>
              <th class="text-center">Вместимость</th>
              <th class="text-center">Действие</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in trainings" :key="t.id">
              <td>{{ t.type?.name }}</td>
              <td>{{ t.stadium?.name }}</td>
              <td>{{ formatDateTimeRange(t.start_at, t.end_at) }}</td>
              <td class="text-center">{{ t.capacity || '—' }}</td>
              <td class="text-center">
                <button
                  v-if="t.registered"
                  class="btn btn-sm btn-secondary"
                  @click="unregister(t.id)"
                >
                  Отменить
                </button>
                <button
                  v-else
                  class="btn btn-sm btn-brand"
                  :disabled="!t.registration_open"
                  @click="register(t.id)"
                >
                  Записаться
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="text-muted">Нет доступных тренировок</p>
      <nav class="mt-3" v-if="Math.ceil(total / pageSize) > 1">
        <ul class="pagination justify-content-center">
          <li class="page-item" :class="{ disabled: page === 1 }">
            <button class="page-link" @click="page--; load()" :disabled="page === 1">Пред</button>
          </li>
          <li
            class="page-item"
            v-for="p in Math.max(1, Math.ceil(total / pageSize))"
            :key="p"
            :class="{ active: page === p }"
          >
            <button class="page-link" @click="page = p; load()">{{ p }}</button>
          </li>
          <li
            class="page-item"
            :class="{ disabled: page === Math.max(1, Math.ceil(total / pageSize)) }"
          >
            <button
              class="page-link"
              @click="page++; load()"
              :disabled="page === Math.max(1, Math.ceil(total / pageSize))"
            >
              След
            </button>
          </li>
        </ul>
      </nav>
    </div>
  </div>
</template>

<style scoped>
</style>
