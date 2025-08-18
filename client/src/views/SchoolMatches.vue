<script setup>
import { ref, onMounted } from 'vue';
import { apiFetch } from '../api.js';

const matches = ref([]);
const loading = ref(false);
const error = ref('');

onMounted(load);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await apiFetch('/matches/upcoming');
    matches.value = res.matches;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function formatDate(d) {
  return new Date(d).toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  });
}
</script>

<template>
  <div class="py-4">
    <div class="container">
      <h1 class="mb-3 text-start">Управление матчами школы</h1>

      <div class="card section-card">
        <div class="card-body">
          <h2 class="card-title h5 mb-3">Ближайшие матчи</h2>
          <div v-if="loading" class="text-center my-5">
            <span class="spinner-border spinner-brand" aria-hidden="true"></span>
          </div>
          <div v-else>
            <div v-if="matches.length">
              <table class="table align-middle">
                <thead>
                  <tr>
                    <th scope="col">Дата и время</th>
                    <th scope="col">Стадион</th>
                    <th scope="col">Команды</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="m in matches" :key="m.id">
                    <td>{{ formatDate(m.date) }}</td>
                    <td>{{ m.stadium || '—' }}</td>
                    <td>{{ m.team1 }} — {{ m.team2 }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="mb-0">Нет ближайших матчей.</p>
            <div v-if="error" class="text-danger mt-2">{{ error }}</div>
          </div>
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
