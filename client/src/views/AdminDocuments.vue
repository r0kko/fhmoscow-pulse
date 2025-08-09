<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';

const documents = ref([]);
const isLoading = ref(false);
const error = ref('');

function formatDateTime(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  });
}

onMounted(async () => {
  isLoading.value = true;
  try {
    const data = await apiFetch('/documents/admin');
    documents.value = data.documents;
  } catch (_err) {
    error.value = 'Не удалось загрузить документы';
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="container mt-4">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb mb-0">
        <li class="breadcrumb-item">
          <RouterLink to="/admin">Администрирование</RouterLink>
        </li>
        <li class="breadcrumb-item active" aria-current="page">Документы</li>
      </ol>
    </nav>
    <h1 class="mb-3">Документы</h1>
    <div class="card section-card tile fade-in shadow-sm">
      <div class="card-body">
        <div v-if="error" class="alert alert-danger mb-0" role="alert">
          {{ error }}
        </div>
        <div v-else-if="isLoading" class="text-center p-3">
          <div
            class="spinner-border text-primary"
            role="status"
            aria-label="loading"
          ></div>
        </div>
        <div v-else>
          <div class="table-responsive d-none d-sm-block">
            <table class="table mb-0">
              <thead>
                <tr>
                  <th>Документ</th>
                  <th>Получатель</th>
                  <th>Статус</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in documents" :key="d.id">
                  <td>{{ d.name }}</td>
                  <td>
                    {{ d.recipient.lastName }} {{ d.recipient.firstName }}
                    {{ d.recipient.patronymic }}
                  </td>
                  <td>{{ d.status?.name }}</td>
                  <td>{{ formatDateTime(d.createdAt) }}</td>
                </tr>
                <tr v-if="!documents.length">
                  <td colspan="4" class="text-center">Документы отсутствуют</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="documents.length" class="d-block d-sm-none">
            <div v-for="d in documents" :key="d.id" class="card mb-2">
              <div class="card-body p-2">
                <h3 class="h6 mb-1">{{ d.name }}</h3>
                <p class="mb-1 small">
                  {{ d.recipient.lastName }} {{ d.recipient.firstName }}
                  {{ d.recipient.patronymic }}
                </p>
                <p class="mb-1 small">Статус: {{ d.status?.name || '—' }}</p>
                <p class="mb-0 small">
                  Дата: {{ formatDateTime(d.createdAt) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
