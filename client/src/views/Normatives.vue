<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import { formatMinutesSeconds } from '../utils/time.js';

const groups = ref([]);
const loading = ref(true);
const error = ref('');

onMounted(load);

async function load() {
  loading.value = true;
  try {
    const data = await apiFetch('/normatives');
    groups.value = data.groups || [];
    error.value = '';
  } catch (e) {
    error.value = e.message;
    groups.value = [];
  } finally {
    loading.value = false;
  }
}

function formatValue(result) {
  if (!result) return '-';
  if (result.unit?.alias === 'MIN_SEC') return formatMinutesSeconds(result.value);
  if (result.unit?.alias === 'SECONDS') return Number(result.value).toFixed(2);
  return result.value;
}
</script>

<template>
  <div class="py-3 normatives-page">
    <div class="container">
      <nav aria-label="breadcrumb" class="mb-2">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/">Главная</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Нормативы</li>
        </ol>
      </nav>
      <h1 class="mb-3">Нормативы</h1>
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-if="loading" class="text-center my-3">
        <div class="spinner-border" role="status"></div>
      </div>
      <div v-for="g in groups" :key="g.id" class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-header">
          <h2 class="h6 mb-0">{{ g.name }}</h2>
        </div>
        <div class="card-body p-3">
          <div v-if="g.types && g.types.length" class="table-responsive">
            <table class="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Норматив</th>
                  <th class="text-nowrap">Мой результат</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in g.types" :key="t.id">
                  <td>{{ t.name }}</td>
                  <td>{{ formatValue(t.result) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-muted mb-0">Нормативы отсутствуют.</p>
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

.fade-in {
  animation: fadeIn 0.4s ease-out;
}

.normatives-page nav[aria-label='breadcrumb'] {
  margin-bottom: 1rem;
}

@media (max-width: 575.98px) {
  .normatives-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
  }

  .normatives-page nav[aria-label='breadcrumb'] {
    margin-bottom: 0.25rem !important;
  }

  .section-card {
    margin-left: -1rem;
    margin-right: -1rem;
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
