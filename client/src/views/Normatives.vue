<script setup>
import { ref, onMounted, watch } from 'vue';
import { RouterLink } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';
import { formatMinutesSeconds } from '../utils/time.js';

const groups = ref([]);
const seasons = ref([]);
const filterSeason = ref('');
const loading = ref(true);
const error = ref('');
const modalRef = ref(null);
const modalResults = ref([]);
const modalTitle = ref('');
let modal;

onMounted(() => {
  modal = new Modal(modalRef.value);
  loadSeasons();
});

watch(filterSeason, load);

async function loadSeasons() {
  try {
    const data = await apiFetch('/normatives/seasons');
    seasons.value = data.seasons || [];
    const active = seasons.value.find((s) => s.active && s.has_results);
    if (active) {
      filterSeason.value = active.id;
    } else {
      const first = seasons.value.find((s) => s.has_results);
      filterSeason.value = first ? first.id : seasons.value.find((s) => s.active)?.id || '';
    }
  } catch (_e) {
    seasons.value = [];
    filterSeason.value = '';
  } finally {
    load();
  }
}

async function load() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filterSeason.value) params.set('season_id', filterSeason.value);
    const data = await apiFetch(`/normatives?${params}`);
    groups.value = data.groups || [];
    error.value = '';
  } catch (e) {
    error.value = e.message;
    groups.value = [];
  } finally {
    loading.value = false;
  }
}

function formatDateTime(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function openHistory(t) {
  modalTitle.value = t.name;
  modalResults.value = t.history || [];
  modal.show();
}

function formatValue(result) {
  if (!result) return '-';
  if (result.unit?.alias === 'MIN_SEC')
    return formatMinutesSeconds(result.value);
  if (result.unit?.alias === 'SECONDS') return Number(result.value).toFixed(2);
  return result.value;
}

function zoneClass(result) {
  return result?.zone?.alias ? `zone-${result.zone.alias}` : '';
}

function zoneEmoji(result) {
  const alias = result?.zone?.alias;
  if (alias === 'GREEN') return '🟢';
  if (alias === 'YELLOW') return '🟡';
  if (alias === 'RED') return '🔴';
  return '';
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
      <div class="d-flex flex-wrap align-items-center justify-content-between mb-3 header-controls">
        <h1 class="mb-0">Нормативы</h1>
        <select v-model="filterSeason" class="form-select season-select mt-2 mt-sm-0">
          <option value="" disabled>Выберите сезон</option>
          <option
            v-for="s in seasons"
            :key="s.id"
            :value="s.id"
            :disabled="!s.has_results"
          >
            {{ s.name }}
          </option>
        </select>
      </div>
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-if="loading" class="text-center my-3">
        <div class="spinner-border" role="status"></div>
      </div>
      <div
        v-for="g in groups"
        :key="g.id"
        class="card section-card tile fade-in shadow-sm mb-3"
      >
        <div class="card-header">
          <h2 class="h6 mb-0">{{ g.name }}</h2>
        </div>
        <div class="card-body p-3">
          <div
            v-if="g.types && g.types.length"
            class="table-responsive d-none d-sm-block"
          >
            <table class="table table-sm align-middle mb-0 normatives-table">
              <thead>
                <tr>
                  <th>Норматив</th>
                  <th class="text-center">Лучший результат</th>
                  <th class="text-center text-nowrap">Дата и время</th>
                  <th class="text-center d-none d-md-table-cell">Стадион</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in g.types" :key="t.id">
                  <td>{{ t.name }}</td>
                  <td :class="['text-center', 'zone-cell', zoneClass(t.result)]">
                    {{ formatValue(t.result) }}
                  </td>
                  <td class="text-center text-nowrap">
                    {{ formatDateTime(t.result?.training?.start_at) }}
                  </td>
                  <td class="text-center d-none d-md-table-cell">
                    {{ t.result?.training?.stadium?.name || '-' }}
                  </td>
                  <td class="text-end">
                    <button
                      v-if="t.history && t.history.length"
                      class="btn btn-sm p-0 text-brand"
                      @click="openHistory(t)"
                      aria-label="Другие попытки"
                    >
                      <i class="bi bi-clock-history"></i>
                    </button>
                    <i
                      v-else
                      class="bi bi-clock-history invisible"
                      aria-label="Нет других попыток"
                    ></i>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="g.types && g.types.length" class="d-block d-sm-none">
            <div
              v-for="t in g.types"
              :key="t.id"
              class="card training-card mb-2"
            >
              <div class="card-body p-2">
                <div
                  class="d-flex justify-content-between align-items-start mb-1"
                >
                  <span class="fw-semibold">{{ t.name }}</span>
                  <button
                    v-if="t.history && t.history.length"
                    class="btn btn-link btn-sm p-0 text-brand"
                    @click="openHistory(t)"
                    aria-label="Другие попытки"
                  >
                    <i class="bi bi-clock-history"></i>
                  </button>
                  <i
                    v-else
                    class="bi bi-clock-history invisible"
                    aria-label="Нет других попыток"
                  ></i>
                </div>
                <p class="mb-1">
                  Лучший:
                  <span :class="['zone-cell', zoneClass(t.result)]">
                    {{ zoneEmoji(t.result) }} {{ formatValue(t.result) }}
                  </span>
                </p>
                <p class="mb-1 small text-center text-sm-start">
                  {{ formatDateTime(t.result?.training?.start_at) }}
                  , {{ t.result?.training?.stadium?.name || '-' }}
                </p>
              </div>
            </div>
          </div>
          <p v-else class="text-muted mb-0">Нормативы отсутствуют.</p>
        </div>
      </div>
      <div ref="modalRef" class="modal fade" tabindex="-1">
        <div class="modal-dialog modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">{{ modalTitle }}</h5>
              <button
                type="button"
                class="btn-close"
                @click="modal.hide()"
              ></button>
            </div>
            <div class="modal-body">
              <div v-if="!modalResults.length" class="text-muted">
                История пуста
              </div>
              <ul v-else class="list-group list-group-flush">
                <li
                  v-for="r in modalResults"
                  :key="r.id"
                  class="list-group-item"
                >
                  <div
                    class="d-flex justify-content-between align-items-center"
                  >
                    <span>{{ formatValue(r) }}</span>
                    <span class="small text-nowrap">
                      {{ formatDateTime(r.training?.start_at) }}
                    </span>
                  </div>
                  <div class="small text-muted">
                    {{ r.training?.stadium?.name || '-' }}
                  </div>
                </li>
              </ul>
            </div>
            <div class="modal-footer">
              <button
                type="button"
                class="btn btn-secondary"
                @click="modal.hide()"
              >
                Закрыть
              </button>
            </div>
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

.training-card {
  border-radius: 0.5rem;
  border: 1px solid #dee2e6;
}

.fade-in {
  animation: fadeIn 0.4s ease-out;
}

.normatives-table {
  width: 100%;
  table-layout: fixed;
}
.normatives-table th:first-child,
.normatives-table td:first-child {
  width: 32%;
}
.normatives-table th:nth-child(2),
.normatives-table td:nth-child(2) {
  width: 18%;
}
.normatives-table th:nth-child(3),
.normatives-table td:nth-child(3) {
  width: 25%;
}
.normatives-table th:nth-child(4),
.normatives-table td:nth-child(4) {
  width: 20%;
}
.normatives-table th:last-child,
.normatives-table td:last-child {
  width: 5%;
}

.normatives-page nav[aria-label='breadcrumb'] {
  margin-bottom: 1rem;
}

.header-controls .season-select {
  width: auto;
  min-width: 12rem;
}

@media (max-width: 575.98px) {
  .header-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .header-controls .season-select {
    width: 100%;
    margin-top: 0.5rem;
  }

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
