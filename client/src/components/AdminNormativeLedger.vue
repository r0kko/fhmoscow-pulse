<script setup>
import { ref, onMounted } from 'vue';
import { apiFetch } from '../api.js';

const ledger = ref({ judges: [], groups: [] });
const isLoading = ref(false);
const error = ref('');

async function load() {
  isLoading.value = true;
  try {
    const data = await apiFetch('/normative-ledger');
    ledger.value = data.ledger;
    error.value = '';
  } catch (err) {
    error.value = 'Не удалось загрузить данные';
  } finally {
    isLoading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="card section-card tile fade-in shadow-sm mb-3">
    <div class="card-body p-2">
      <div v-if="error" class="alert alert-danger mb-0">{{ error }}</div>
      <div v-else-if="isLoading" class="text-center py-3">Загрузка...</div>
      <div v-else class="table-responsive">
        <table class="table table-bordered align-middle mb-0">
          <thead>
            <tr>
              <th rowspan="2">Судья</th>
              <template v-for="g in ledger.groups" :key="g.id">
                <th :colspan="g.types.length" class="text-center">{{ g.name }}</th>
              </template>
            </tr>
            <tr>
              <template v-for="g in ledger.groups" :key="g.id">
                <template v-for="t in g.types" :key="t.id">
                  <th class="text-center">{{ t.name }}</th>
                </template>
              </template>
            </tr>
          </thead>
          <tbody>
            <tr v-for="j in ledger.judges" :key="j.user.id">
              <td>
                {{ j.user.last_name }} {{ j.user.first_name }} {{ j.user.patronymic || '' }}
              </td>
              <template v-for="g in ledger.groups" :key="g.id">
                <template v-for="t in g.types" :key="t.id">
                  <td class="text-center">
                    {{ j.results[t.id]?.value ?? '' }}
                  </td>
                </template>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-bordered {
  min-width: 600px;
}
.fade-in {
  animation: fadeIn 0.4s ease-out;
}
.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
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
