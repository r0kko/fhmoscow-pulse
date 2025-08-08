<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { apiFetch } from '../api.js';
import Pagination from './Pagination.vue';
import { formatMinutesSeconds } from '../utils/time.js';

const ledger = ref({ judges: [], groups: [] });
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(
  parseInt(localStorage.getItem('normativeLedgerPageSize') || '15', 10)
);
const search = ref('');
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
      search: search.value,
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

let searchTimeout;
watch(search, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentPage.value = 1;
    load();
  }, 300);
});
</script>

<template>
  <div class="card section-card tile fade-in shadow-sm mb-3">
    <div class="card-body p-2">
      <div class="row g-2 align-items-end mb-3">
        <div class="col">
          <input
            v-model="search"
            type="text"
            class="form-control"
            placeholder="ФИО судьи"
          />
        </div>
      </div>
      <div v-if="error" class="alert alert-danger mb-0">{{ error }}</div>
      <div v-else-if="isLoading" class="text-center py-3">Загрузка...</div>
      <div v-else>
        <div class="table-responsive d-none d-sm-block">
          <table
            class="table table-bordered align-middle mb-0 admin-table auto-cols ledger-table"
          >
            <thead>
              <tr>
                <th rowspan="2">Судья</th>
                <template v-for="g in ledger.groups" :key="g.id">
                  <th :colspan="g.types.length" class="text-center">
                    {{ g.name }}
                  </th>
                </template>
              </tr>
              <tr>
                <template v-for="g in ledger.groups" :key="g.id">
                  <template v-for="t in g.types" :key="t.id">
                    <th class="text-center ledger-col">{{ t.name }}</th>
                  </template>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr v-for="j in ledger.judges" :key="j.user.id">
                <td>
                  {{ j.user.last_name }} {{ j.user.first_name }}
                  {{ j.user.patronymic || '' }}
                </td>
                <template v-for="g in ledger.groups" :key="g.id">
                  <template v-for="t in g.types" :key="t.id">
                    <td
                      :class="[
                        'text-center',
                        'zone-cell',
                        j.results[t.id]?.zone?.alias
                          ? `zone-${j.results[t.id].zone.alias}`
                          : '',
                      ]"
                      class="ledger-col"
                    >
                      {{ formatValue(t, j.results[t.id]) }}
                    </td>
                  </template>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="ledger.judges.length" class="d-block d-sm-none">
          <div
            v-for="j in ledger.judges"
            :key="j.user.id"
            class="card training-card mb-2"
          >
            <div class="card-body p-2">
              <h6 class="mb-2">
                {{ j.user.last_name }} {{ j.user.first_name }}
                {{ j.user.patronymic || '' }}
              </h6>
              <div v-for="g in ledger.groups" :key="g.id" class="mb-2">
                <strong class="d-block mb-1">{{ g.name }}</strong>
                <div
                  v-for="t in g.types"
                  :key="t.id"
                  class="d-flex justify-content-between small"
                >
                  <span class="me-2">{{ t.name }}</span>
                  <span
                    :class="[
                      'zone-cell',
                      j.results[t.id]?.zone?.alias
                        ? `zone-${j.results[t.id].zone.alias}`
                        : '',
                    ]"
                  >
                    {{ formatValue(t, j.results[t.id]) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <nav
    v-if="ledger.judges.length"
    class="mt-3 d-flex align-items-center justify-content-between"
  >
    <select v-model.number="pageSize" class="form-select form-select-sm w-auto">
      <option :value="15">15</option>
      <option :value="30">30</option>
      <option :value="50">50</option>
    </select>
    <Pagination v-model="currentPage" :total-pages="totalPages" />
  </nav>
</template>

<style scoped>
.table-bordered {
  min-width: max-content;
}
.ledger-col {
  width: 6rem;
  max-width: 10rem;
  white-space: normal;
  word-wrap: break-word;
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
