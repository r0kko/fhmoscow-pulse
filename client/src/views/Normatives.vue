<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import { RouterLink } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import Offcanvas from 'bootstrap/js/dist/offcanvas';
import Tooltip from 'bootstrap/js/dist/tooltip';
import { apiFetch } from '../api';
import { apiUpload } from '../api';
import { formatMinutesSeconds } from '../utils/time.js';

const groups = ref([]);
const seasons = ref([]);
const filterSeason = ref('');
const loading = ref(true);
const error = ref('');
const modalRef = ref(null);
const modalResults = ref([]);
const modalTitle = ref('');
const seasonRef = ref(null);
let modal;
let seasonCanvas;

const uploadModalRef = ref(null);
let uploadModal;
const selectedType = ref(null);
const repetitions = ref('');
const repetitionsError = ref('');
const selectedFile = ref(null);
const fileError = ref('');
const uploading = ref(false);
const progress = ref(0);
const accepted = ref(false);
const MAX_FILE_SIZE = 250 * 1024 * 1024;

function applyTooltips() {
  nextTick(() => {
    document
      .querySelectorAll('[data-bs-toggle="tooltip"]')
      .forEach((el) => new Tooltip(el));
  });
}

onMounted(async () => {
  modal = new Modal(modalRef.value);
  seasonCanvas = new Offcanvas(seasonRef.value);
  uploadModal = new Modal(uploadModalRef.value);
  await loadSeasons();
});

watch(filterSeason, load);
watch(repetitions, () => {
  repetitionsError.value = '';
});

async function loadSeasons() {
  try {
    const data = await apiFetch('/normatives/seasons');
    seasons.value = data.seasons || [];
    const active = seasons.value.find((s) => s.active && s.has_results);
    if (active) {
      filterSeason.value = active.id;
    } else {
      const first = seasons.value.find((s) => s.has_results);
      filterSeason.value = first
        ? first.id
        : seasons.value.find((s) => s.active)?.id || '';
    }
  } catch (_e) {
    seasons.value = [];
    filterSeason.value = '';
  } finally {
    await load();
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
    await nextTick();
    applyTooltips();
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
    timeZone: 'Europe/Moscow',
  });
}

function formatDate(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Moscow',
  });
}

function openHistory(t) {
  modalTitle.value = t.name;
  modalResults.value = t.history || [];
  modal.show();
}

function openSeason() {
  seasonCanvas.show();
}

function openUpload(type) {
  selectedType.value = type;
  repetitions.value = '';
  repetitionsError.value = '';
  selectedFile.value = null;
  fileError.value = '';
  progress.value = 0;
  uploading.value = false;
  accepted.value = false;
  uploadModal.show();
}

function onFileChange(e) {
  fileError.value = '';
  selectedFile.value = e.target.files[0] || null;
}

async function submitOnline() {
  fileError.value = '';
  repetitionsError.value = '';
  if (repetitions.value === '') {
    repetitionsError.value = 'Укажите количество повторений';
    return;
  }
  const value = Number(repetitions.value);
  if (Number.isNaN(value) || value < 0) {
    repetitionsError.value = 'Некорректное значение';
    return;
  }
  const file = selectedFile.value;
  if (!file) {
    fileError.value = 'Файл не выбран';
    return;
  }
  if (!file.type.startsWith('video/')) {
    fileError.value = 'Неверный формат файла';
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    fileError.value = 'Файл превышает 250 МБ';
    return;
  }
  if (!accepted.value) {
    fileError.value = 'Необходимо согласие с правилами';
    return;
  }
  uploading.value = true;
  const form = new FormData();
  form.append('type_id', selectedType.value.id);
  form.append('value', repetitions.value);
  form.append('accepted', accepted.value ? 'true' : 'false');
  form.append('file', file);
  try {
    await apiUpload('/normative-tickets', form, {
      onProgress: (p) => {
        progress.value = Math.round(p * 100);
      },
    });
    uploadModal.hide();
    await load();
  } catch (e) {
    fileError.value = e.message;
  } finally {
    uploading.value = false;
  }
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

function thresholdText(t, zone) {
  const value = t.thresholds?.[zone];
  if (value == null) return null;
  const sign = t.value_type_alias === 'MORE_BETTER' ? '≥' : '≤';
  return `${sign} ${formatValue({ value, unit: t.unit })}`;
}
</script>

<template>
  <div class="py-3 normatives-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/">Главная</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Нормативы</li>
        </ol>
      </nav>
      <div
        class="d-flex flex-wrap align-items-center justify-content-between mb-3 header-controls"
      >
        <h1 class="mb-0 text-start">Нормативы</h1>
        <button
          class="btn btn-outline-secondary d-sm-none"
          aria-label="Выбрать сезон"
          @click="openSeason"
        >
          <i class="bi bi-funnel"></i>
        </button>
        <select
          v-model="filterSeason"
          class="form-select season-select mt-2 mt-sm-0 d-none d-sm-block"
        >
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
        <div class="card-body">
          <div
            v-if="g.types && g.types.length"
            class="table-responsive d-none d-sm-block"
          >
            <table class="table table-sm align-middle mb-0 normatives-table">
              <thead>
                <tr>
                  <th>Норматив</th>
                  <th class="text-center">Лучший результат</th>
                  <th class="text-center text-nowrap">Дата</th>
                  <th class="text-center d-none d-md-table-cell">Стадион</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in g.types" :key="t.id">
                  <td>
                    {{ t.name }}
                    <div v-if="t.thresholds" class="small mt-1 thresholds">
                      <span
                        v-if="t.thresholds.YELLOW"
                        class="badge bg-warning-subtle text-warning-emphasis me-1"
                        >{{ thresholdText(t, 'YELLOW') }}</span
                      >
                      <span
                        v-if="t.thresholds.GREEN"
                        class="badge bg-success-subtle text-success-emphasis"
                        >{{ thresholdText(t, 'GREEN') }}</span
                      >
                    </div>
                  </td>
                  <td
                    :class="['text-center', 'zone-cell', zoneClass(t.result)]"
                  >
                    {{ formatValue(t.result) }}
                  </td>
                  <td class="text-center">
                    {{
                      t.result?.retake
                        ? 'Перезачет'
                        : t.result?.online
                          ? 'Онлайн'
                          : formatDateTime(t.result?.training?.start_at)
                    }}
                  </td>
                  <td class="text-center d-none d-md-table-cell">
                    {{
                      t.result?.training?.Ground?.name ||
                      t.result?.training?.ground?.name ||
                      '-'
                    }}
                  </td>
                  <td class="text-end">
                    <div class="actions-cell">
                      <button
                        v-if="t.history && t.history.length"
                        class="btn btn-sm p-0 text-brand"
                        aria-label="Другие попытки"
                        @click="openHistory(t)"
                      >
                        <i class="bi bi-clock-history"></i>
                      </button>
                      <i
                        v-else
                        class="bi bi-clock-history invisible"
                        aria-label="Нет других попыток"
                      ></i>
                      <RouterLink
                        v-if="t.active_ticket"
                        to="/tickets"
                        class="btn btn-outline-brand btn-sm d-inline-flex align-items-center text-nowrap"
                        aria-label="Перейти к обращению"
                      >
                        <i class="bi bi-hourglass" aria-hidden="true"></i>
                        <span class="ms-1 d-none d-md-inline">Проверка</span>
                      </RouterLink>
                      <button
                        v-else-if="t.can_upload"
                        class="btn btn-outline-brand btn-sm d-inline-flex align-items-center text-nowrap"
                        aria-label="Загрузить видео"
                        @click="openUpload(t)"
                      >
                        <i class="bi bi-upload" aria-hidden="true"></i>
                        <span class="ms-1 d-none d-md-inline">Загрузить</span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="g.types && g.types.length" class="d-block d-sm-none">
            <div
              v-for="t in g.types"
              :key="t.id"
              :class="['card', 'training-card', zoneClass(t.result), 'mb-2']"
            >
              <div class="card-body p-2">
                <div
                  class="d-flex justify-content-between align-items-start mb-1"
                >
                  <span class="fw-semibold">{{ t.name }}</span>
                  <button
                    v-if="t.history && t.history.length"
                    class="btn btn-link btn-sm p-0 text-brand"
                    aria-label="Другие попытки"
                    @click="openHistory(t)"
                  >
                    <i class="bi bi-clock-history"></i>
                  </button>
                  <i
                    v-else
                    class="bi bi-clock-history invisible"
                    aria-label="Нет других попыток"
                  ></i>
                  <RouterLink
                    v-if="t.active_ticket"
                    to="/tickets"
                    class="btn btn-outline-brand btn-sm ms-2 d-inline-flex align-items-center"
                    aria-label="Перейти к обращению"
                  >
                    <i class="bi bi-hourglass" aria-hidden="true"></i>
                    <span class="ms-1">Проверка</span>
                  </RouterLink>
                  <button
                    v-else-if="t.can_upload"
                    class="btn btn-outline-brand btn-sm ms-2 d-inline-flex align-items-center"
                    aria-label="Загрузить видео"
                    @click="openUpload(t)"
                  >
                    <i class="bi bi-upload" aria-hidden="true"></i>
                    <span class="ms-1">Загрузить</span>
                  </button>
                </div>
                <p class="mb-1">
                  Лучший результат:
                  <span class="fw-semibold">{{ formatValue(t.result) }}</span>
                </p>
                <p class="mb-1 small text-start">
                  {{
                    t.result?.retake
                      ? 'Перезачет'
                      : t.result?.online
                        ? 'Онлайн'
                        : `${formatDateTime(t.result?.training?.start_at)}, ${
                            t.result?.training?.Ground?.name ||
                            t.result?.training?.ground?.name ||
                            '-'
                          }`
                  }}
                </p>
                <p v-if="t.thresholds" class="mb-0 small thresholds">
                  <span
                    v-if="t.thresholds.YELLOW"
                    class="badge bg-warning-subtle text-warning-emphasis me-1"
                    >{{ thresholdText(t, 'YELLOW') }}</span
                  >
                  <span
                    v-if="t.thresholds.GREEN"
                    class="badge bg-success-subtle text-success-emphasis"
                    >{{ thresholdText(t, 'GREEN') }}</span
                  >
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
                      {{
                        r.retake
                          ? 'Перезачет'
                          : r.online
                            ? 'Онлайн'
                            : formatDateTime(r.training?.start_at)
                      }}
                    </span>
                  </div>
                  <div class="small text-muted">
                    {{
                      r.training?.Ground?.name ||
                      r.training?.ground?.name ||
                      '-'
                    }}
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
      <div ref="uploadModalRef" class="modal fade" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Сдать онлайн</h5>
              <button
                type="button"
                class="btn-close"
                @click="uploadModal.hide()"
              ></button>
            </div>
            <div class="modal-body">
              <ul class="small mb-3">
                <li>
                  Сдача норматива должна быть записана на видео в горизонтальном
                  формате, разрешение не менее 1920х1080, частота кадров не
                  менее 30 fps.
                </li>
                <li>Любой монтаж видеозаписи не допускается</li>
                <li>
                  В начале видео обязательно должно быть видно Ваше лицо крупным
                  планом, оно должно оставаться в кадре до окончания записи.
                </li>
                <li>
                  Если норматив предполагает нагрузку в зависимости от
                  собственного веса - необходимо обязательно провести съемку (в
                  рамках этой же записи) собственного взвешивания, а также
                  снаряженного инвентаря для проверки рабочего веса.
                </li>
              </ul>
              <div class="form-check mb-3">
                <input
                  id="acceptRules"
                  v-model="accepted"
                  class="form-check-input"
                  type="checkbox"
                />
                <label class="form-check-label" for="acceptRules"
                  >С правилами ознакомлен</label
                >
              </div>
              <div class="mb-3">
                <input
                  type="file"
                  class="form-control"
                  accept="video/*"
                  :disabled="!accepted"
                  @change="onFileChange"
                />
                <div class="form-text">Видео до 100&nbsp;МБ</div>
                <div v-if="fileError" class="text-danger small mt-1">
                  {{ fileError }}
                </div>
              </div>
              <div class="form-floating mb-3">
                <input
                  id="repCnt"
                  v-model="repetitions"
                  type="number"
                  min="0"
                  class="form-control"
                  placeholder="Повторения"
                  :disabled="!accepted"
                  :class="{ 'is-invalid': repetitionsError }"
                />
                <label for="repCnt">Количество повторений</label>
                <div v-if="repetitionsError" class="text-danger small mt-1">
                  {{ repetitionsError }}
                </div>
              </div>
              <div v-if="uploading" class="progress mb-3">
                <div
                  class="progress-bar bg-brand"
                  :style="{ width: progress + '%' }"
                ></div>
              </div>
            </div>
            <div class="modal-footer">
              <button
                type="button"
                class="btn btn-secondary"
                @click="uploadModal.hide()"
              >
                Отмена
              </button>
              <button
                type="button"
                class="btn btn-brand"
                :disabled="uploading || !accepted"
                @click="submitOnline"
              >
                <span
                  v-if="uploading"
                  class="spinner-border spinner-border-sm me-2"
                ></span>
                Отправить
              </button>
            </div>
          </div>
        </div>
      </div>
      <div ref="seasonRef" class="offcanvas offcanvas-bottom" tabindex="-1">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title">Выберите сезон</h5>
          <button
            type="button"
            class="btn-close"
            @click="seasonCanvas.hide()"
          ></button>
        </div>
        <div class="offcanvas-body">
          <select v-model="filterSeason" class="form-select">
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
      </div>
    </div>
  </div>
</template>

<style scoped>
.training-card {
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
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
  width: 28%;
}
.normatives-table th:nth-child(2),
.normatives-table td:nth-child(2) {
  width: 12%;
}
.normatives-table th:nth-child(3),
.normatives-table td:nth-child(3) {
  width: 18%;
}
.normatives-table th:nth-child(4),
.normatives-table td:nth-child(4) {
  width: 27%;
}
.normatives-table th:last-child,
.normatives-table td:last-child {
  width: 15%;
}
/* Let action buttons wrap to a second line if needed */
.normatives-table td:last-child {
  white-space: normal;
}
/* Prevent long normative names from forcing overflow */
.normatives-table td:first-child {
  word-break: break-word;
  overflow-wrap: anywhere;
}

/* Compact, wrapping actions block inside last column */
.actions-cell {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  justify-content: flex-end;
}

.header-controls .season-select {
  width: auto;
  min-width: 12rem;
}

.thresholds {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.thresholds .badge {
  font-size: 0.75rem;
}

@media (max-width: 575.98px) {
  .header-controls {
    align-items: center;
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
