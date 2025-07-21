<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { apiFetch } from '../api.js';
import { formatMinutesSeconds } from '../utils/time.js';

const ledger = ref({ judges: [], groups: [] });
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(
  parseInt(localStorage.getItem('normativeLedgerPageSize') || '15', 10)
);
const isLoading = ref(false);
const error = ref('');

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value))
);

async function load() {
  isLoading.value = true;
  try {
    const params = new URLSearchParams({
      page: currentPage.value,
      limit: pageSize.value,
    });
    const data = await apiFetch(`/normative-ledger?${params}`);
    ledger.value = data.ledger;
    total.value = data.total;
    const pages = Math.max(1, Math.ceil(total.value / pageSize.value));
    if (currentPage.value > pages) {
      currentPage.value = pages;
    }
    error.value = '';
  } catch (err) {
    error.value = 'Не удалось загрузить данные';
    ledger.value = { judges: [], groups: [] };
  } finally {
    isLoading.value = false;
  }
}

function formatValue(type, result) {
  if (!result) return '';
  if (type.unit_alias === 'MIN_SEC') {
    return formatMinutesSeconds(result.value);
  }
  return result.value;
}

onMounted(load);

watch(currentPage, load);

watch(pageSize, (val) => {
  localStorage.setItem('normativeLedgerPageSize', val);
  currentPage.value = 1;
  load();
});
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
                    {{ formatValue(t, j.results[t.id]) }}
                  </td>
                </template>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <nav
    class="mt-3 d-flex align-items-center justify-content-between"
    v-if="ledger.judges.length"
  >
    <select v-model.number="pageSize" class="form-select form-select-sm w-auto">
      <option :value="15">15</option>
      <option :value="30">30</option>
      <option :value="50">50</option>
    </select>
    <ul class="pagination mb-0">
      <li class="page-item" :class="{ disabled: currentPage === 1 }">
        <button
          class="page-link"
          @click="currentPage--"
          :disabled="currentPage === 1"
        >
          Пред
        </button>
      </li>
      <li
        class="page-item"
        v-for="p in totalPages"
        :key="p"
        :class="{ active: currentPage === p }"
      >
        <button class="page-link" @click="currentPage = p">{{ p }}</button>
      </li>
      <li class="page-item" :class="{ disabled: currentPage === totalPages }">
        <button
          class="page-link"
          @click="currentPage++"
          :disabled="currentPage === totalPages"
        >
          След
        </button>
      </li>
    </ul>
  </nav>
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
