<script setup>
import { ref, onMounted, watch, computed, onBeforeUnmount } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import { MOSCOW_TZ } from '../utils/time.js';

const days = ref([]);
const original = ref([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const savedAt = ref(0);
const pendingByDate = ref(new Set());
// No modals needed now; locked days are fully non-editable

const statuses = [
  {
    value: 'FREE',
    label: 'Свободен',
    btn: 'btn-outline-success',
    icon: 'bi-check-circle',
  },
  {
    value: 'PARTIAL',
    label: 'Частично',
    btn: 'btn-outline-warning',
    icon: 'bi-clock',
  },
  {
    value: 'BUSY',
    label: 'Занят',
    btn: 'btn-outline-secondary',
    icon: 'bi-slash-circle',
  },
];

function cloneDays(list) {
  return (list || []).map((d) => ({ ...d }));
}

function initDay(d) {
  // Derive UI-only partial mode from existing times
  if (d.status === 'PARTIAL') {
    if (d.to_time && !d.from_time) d.partialMode = 'BEFORE';
    else if (d.from_time && !d.to_time) d.partialMode = 'AFTER';
    else d.partialMode = 'AFTER';
  } else {
    d.partialMode = null;
  }
  // Proactive selection: do not preselect if not preset from server
  if (!d.preset) {
    d.currentStatus = null;
  } else {
    d.currentStatus = d.status;
  }
  return d;
}

function formatDay(dateStr) {
  const date = new Date(dateStr);
  const text = date.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: MOSCOW_TZ,
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function effectiveStatus(d) {
  if (d.currentStatus != null) return d.currentStatus;
  return d.preset ? d.status : null;
}

function isPartial(d) {
  return effectiveStatus(d) === 'PARTIAL';
}

function isValidPartial(d) {
  if (!isPartial(d)) return true;
  if (d.partialMode === 'BEFORE') return !!d.to_time && !d.from_time;
  if (d.partialMode === 'AFTER') return !!d.from_time && !d.to_time;
  return false;
}

const invalidCount = computed(
  () => days.value.filter((d) => !isValidPartial(d)).length
);

// Week grouping (ISO week number) using Moscow midnight for date boundaries
function toMoscowMidnight(dateStr) {
  return new Date(`${dateStr}T00:00:00+03:00`);
}

// Time helpers (Moscow timezone)
function mskStartOfDayMs(dateStr) {
  return new Date(`${dateStr}T00:00:00+03:00`).getTime();
}
function isoWeek(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}
const weekGroups = computed(() => {
  const groups = new Map();
  for (const d of days.value) {
    const dt = toMoscowMidnight(d.date);
    const week = isoWeek(dt);
    const key = `${dt.getUTCFullYear()}-${week}`;
    if (!groups.has(key)) groups.set(key, { key, week, list: [] });
    groups.get(key).list.push(d);
  }
  const arr = [...groups.values()].map((g) => {
    g.list.sort((a, b) => (a.date < b.date ? -1 : 1));
    g.start = g.list[0]?.date;
    g.end = g.list[g.list.length - 1]?.date;
    return g;
  });
  return arr.sort((a, b) => (a.start < b.start ? -1 : 1));
});

function isActive(d, status) {
  const eff = effectiveStatus(d);
  if (eff == null) return false;
  return eff === status;
}
// Lock model:
// - Full lock: past and current day (no edits at all)
// - Limited lock: only allow switching back to FREE
//   • within 72h before day start
//   • after Tue 23:59 for the rest of the current week
function isFullyLocked(d) {
  const startMs = mskStartOfDayMs(d.date);
  return Date.now() >= startMs; // past and current day
}
function isLimitedLocked(d) {
  const now = Date.now();
  const startMs = mskStartOfDayMs(d.date);
  if (now >= startMs) return false; // handled by full lock
  // 96h window
  const ninetySixH = 96 * 60 * 60 * 1000;
  return now >= startMs - ninetySixH;
}
function isPending(d) {
  return pendingByDate.value.has(d.date);
}

function formatWeekRange(group) {
  const start = group.start;
  const end = group.end;
  if (!start || !end) return '';
  const startDate = new Date(start);
  const endDate = new Date(end);
  const sameMonth = startDate.getUTCMonth() === endDate.getUTCMonth();
  const startDay = startDate.toLocaleDateString('ru-RU', {
    day: 'numeric',
    timeZone: MOSCOW_TZ,
  });
  const endDay = endDate.toLocaleDateString('ru-RU', {
    day: 'numeric',
    timeZone: MOSCOW_TZ,
  });
  const startMonth = startDate.toLocaleDateString('ru-RU', {
    month: 'long',
    timeZone: MOSCOW_TZ,
  });
  const endMonth = endDate.toLocaleDateString('ru-RU', {
    month: 'long',
    timeZone: MOSCOW_TZ,
  });
  if (sameMonth) {
    return `${startDay}–${endDay} ${endMonth}`;
  }
  return `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
}

const savedAtText = computed(() => {
  if (!savedAt.value) return '';
  try {
    return new Date(savedAt.value).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: MOSCOW_TZ,
    });
  } catch (_) {
    return '';
  }
});

const changes = computed(() => {
  const byKey = new Map(original.value.map((d) => [d.date, d]));
  const list = [];
  for (const d of days.value) {
    const prev = byKey.get(d.date) || {};
    const statusNow = d.currentStatus ?? d.status;
    const changed =
      statusNow !== prev.status ||
      (d.from_time || null) !== (prev.from_time || null) ||
      (d.to_time || null) !== (prev.to_time || null);
    if (changed) list.push(d);
  }
  return list;
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await apiFetch('/availabilities');
    days.value = cloneDays(data.days || []).map(initDay);
    original.value = cloneDays(data.days || []);
  } catch (e) {
    error.value = e?.message || 'Не удалось загрузить данные';
  } finally {
    loading.value = false;
  }
}

async function saveDay(d, opts = {}) {
  if (invalidCount.value > 0) return;
  error.value = '';
  pendingByDate.value.add(d.date);
  const payloadDay = {
    date: d.date,
    status: d.currentStatus ?? d.status,
    from_time: d.from_time ?? null,
    to_time: d.to_time ?? null,
  };
  try {
    await apiFetch('/availabilities', {
      method: 'PUT',
      body: JSON.stringify({ days: [payloadDay] }),
    });
    d.status = d.currentStatus ?? d.status;
    d.preset = true;
    const byKey = new Map(days.value.map((x) => [x.date, { ...x }]));
    original.value = cloneDays([...byKey.values()]);
    savedAt.value = Date.now();
  } catch (e) {
    error.value = e?.message || 'Не удалось сохранить изменения';
  } finally {
    pendingByDate.value.delete(d.date);
  }
}

function setStatus(d, status) {
  if (isFullyLocked(d)) return;
  if (status !== 'FREE' && isLimitedLocked(d)) return;
  d.currentStatus = status;
  if (status === 'PARTIAL') {
    if (!d.partialMode) d.partialMode = 'AFTER';
    // wait for time input
  } else {
    d.from_time = null;
    d.to_time = null;
    saveDay(d);
  }
}

function saveDayIfValid(d) {
  if (isFullyLocked(d) || isLimitedLocked(d)) return;
  if (isValidPartial(d)) saveDay(d);
}

function setPartialMode(d, mode) {
  if (isFullyLocked(d) || isLimitedLocked(d)) return;
  d.partialMode = mode;
  if (mode === 'BEFORE') {
    d.from_time = null;
  } else if (mode === 'AFTER') {
    d.to_time = null;
  }
}

watch(
  () => days.value,
  (list) => {
    for (const d of list) {
      const active = d.currentStatus ?? d.status;
      if (active !== 'PARTIAL') {
        d.from_time = null;
        d.to_time = null;
        d.partialMode = null;
      } else if (!d.partialMode) {
        d.partialMode = 'AFTER';
      } else if (d.partialMode === 'AFTER' && d.to_time) {
        // Ensure mutually exclusive values for partial
        d.to_time = null;
      } else if (d.partialMode === 'BEFORE' && d.from_time) {
        d.from_time = null;
      }
    }
  },
  { deep: true }
);

onMounted(() => {
  load();
});
onBeforeUnmount(() => {});
</script>

<template>
  <div class="py-3">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/">Главная</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">
            Моя занятость
          </li>
        </ol>
      </nav>
      <h1 class="mb-3">Моя занятость</h1>
      <div v-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>

      <div v-if="loading" class="text-center py-3">
        <div
          class="spinner-border spinner-brand"
          role="status"
          aria-label="Загрузка"
        >
          <span class="visually-hidden">Загрузка…</span>
        </div>
      </div>

      <div v-else class="training-schedule">
        <!-- Intro tile (separate card) -->
        <div class="card section-card tile fade-in shadow-sm mb-3">
          <div class="card-body">
            <h2 class="h6 mb-2">
              <i
                class="bi bi-info-circle text-brand me-2"
                aria-hidden="true"
              ></i>
              Отметьте вашу готовность работать
            </h2>
            <p class="text-muted small mb-2">
              На каждый день укажите статус. Для частичной готовности выберите
              «До» или «После» и задайте время.
            </p>
            <ul class="list-unstyled small mb-0">
              <li class="d-flex align-items-center mb-1">
                <i
                  class="bi bi-check-circle text-success me-2"
                  aria-hidden="true"
                ></i>
                <span>Свободен — готовы весь день.</span>
              </li>
              <li class="d-flex align-items-center mb-1">
                <i class="bi bi-clock text-warning me-2" aria-hidden="true"></i>
                <span>Частично — «До» или «После» + время.</span>
              </li>
              <li class="d-flex align-items-center mb-1">
                <i
                  class="bi bi-slash-circle text-secondary me-2"
                  aria-hidden="true"
                ></i>
                <span>Занят — недоступны в этот день.</span>
              </li>
              <li class="d-flex align-items-start">
                <i class="bi bi-lock me-2" aria-hidden="true"></i>
                <span>Заблокированные дни недоступны для редактирования.</span>
              </li>
              <li class="d-flex align-items-start">
                <i class="bi bi-hourglass-split me-2" aria-hidden="true"></i>
                <span
                  >За 96 часов можно только изменить занятость на "Свободен".
                  Сотрудники отдела организации судейства будут уведомлены
                  автоматически.</span
                >
              </li>
            </ul>
          </div>
        </div>

        <!-- Validation hint (shown only when useful) -->
        <div v-if="invalidCount > 0" class="d-flex mb-2 px-1">
          <div class="small text-muted">
            Укажите время для частичных дней ({{ invalidCount }})
          </div>
        </div>

        <!-- Week tiles (each week as separate card) -->
        <div class="week-grid">
          <div
            v-for="group in weekGroups"
            :key="group.key"
            class="card week-card section-card tile fade-in shadow-sm"
          >
            <div
              class="card-header d-flex align-items-center justify-content-between bg-white"
            >
              <h3 class="h6 mb-0 week-title">Неделя №{{ group.week }}</h3>
              <div class="text-muted small">{{ formatWeekRange(group) }}</div>
            </div>
            <div class="card-body pt-2">
              <div
                v-for="d in group.list"
                :key="d.date"
                class="mb-3 schedule-day"
                :class="{ locked: isFullyLocked(d) || isLimitedLocked(d) }"
              >
                <div
                  class="d-flex justify-content-between align-items-center flex-wrap gap-2"
                >
                  <div class="day-title d-flex align-items-center">
                    {{ formatDay(d.date) }}
                    <i
                      v-if="isFullyLocked(d) || isLimitedLocked(d)"
                      class="bi bi-lock ms-2 text-muted"
                      aria-hidden="true"
                      :title="
                        isFullyLocked(d)
                          ? 'Редактирование недоступно для текущего и прошедших дней'
                          : 'Доступно только возвращение к «Свободен»'
                      "
                    ></i>
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    <button
                      class="btn btn-sm btn-outline-success btn-square status-icon"
                      :class="isActive(d, 'FREE') && 'active'"
                      :disabled="isFullyLocked(d) || isPending(d)"
                      :aria-disabled="
                        isFullyLocked(d) || isPending(d) ? 'true' : 'false'
                      "
                      aria-label="Отметить как свободен"
                      title="Свободен"
                      @click="setStatus(d, 'FREE')"
                    >
                      <i class="bi bi-check-circle" aria-hidden="true"></i>
                    </button>
                    <button
                      class="btn btn-sm btn-outline-warning btn-square status-icon"
                      :class="isActive(d, 'PARTIAL') && 'active'"
                      :disabled="
                        isFullyLocked(d) || isLimitedLocked(d) || isPending(d)
                      "
                      :aria-disabled="
                        isFullyLocked(d) || isLimitedLocked(d) || isPending(d)
                          ? 'true'
                          : 'false'
                      "
                      aria-label="Отметить частичную доступность"
                      title="Частично"
                      @click="setStatus(d, 'PARTIAL')"
                    >
                      <i class="bi bi-clock" aria-hidden="true"></i>
                    </button>
                    <button
                      class="btn btn-sm btn-outline-secondary btn-square status-icon"
                      :class="isActive(d, 'BUSY') && 'active'"
                      :disabled="
                        isFullyLocked(d) || isLimitedLocked(d) || isPending(d)
                      "
                      :aria-disabled="
                        isFullyLocked(d) || isLimitedLocked(d) || isPending(d)
                          ? 'true'
                          : 'false'
                      "
                      aria-label="Отметить как занят"
                      title="Занят"
                      @click="setStatus(d, 'BUSY')"
                    >
                      <i class="bi bi-slash-circle" aria-hidden="true"></i>
                    </button>
                    <span
                      v-if="isPending(d)"
                      class="spinner-border spinner-border-sm text-brand"
                      role="status"
                      aria-hidden="true"
                    ></span>
                  </div>
                </div>

                <div
                  v-if="
                    isPartial(d) &&
                    isActive(d, 'PARTIAL') &&
                    !isFullyLocked(d) &&
                    !isLimitedLocked(d)
                  "
                  class="row g-2 align-items-end mt-2"
                >
                  <div class="col-12 mb-1">
                    <div class="d-flex flex-wrap gap-3 align-items-center">
                      <div
                        class="btn-group btn-group-sm"
                        role="group"
                        aria-label="Режим частичной доступности"
                      >
                        <input
                          :id="'mode-before-' + d.date"
                          type="radio"
                          class="btn-check"
                          :checked="d.partialMode === 'BEFORE'"
                          @change="setPartialMode(d, 'BEFORE')"
                        />
                        <label
                          class="btn btn-outline-secondary"
                          :for="'mode-before-' + d.date"
                          >До</label
                        >
                        <input
                          :id="'mode-after-' + d.date"
                          type="radio"
                          class="btn-check"
                          :checked="d.partialMode === 'AFTER'"
                          @change="setPartialMode(d, 'AFTER')"
                        />
                        <label
                          class="btn btn-outline-secondary"
                          :for="'mode-after-' + d.date"
                          >После</label
                        >
                      </div>

                      <div v-if="d.partialMode === 'AFTER'" class="ms-2">
                        <label
                          :for="'from-' + d.date"
                          class="form-label small mb-1"
                          >Время</label
                        >
                        <div class="input-group input-group-sm">
                          <span class="input-group-text"
                            ><i class="bi bi-clock" aria-hidden="true"></i
                          ></span>
                          <input
                            :id="'from-' + d.date"
                            v-model="d.from_time"
                            type="time"
                            step="300"
                            class="form-control"
                            :class="{ 'is-invalid': !isValidPartial(d) }"
                            required
                            @change="saveDayIfValid(d)"
                          />
                        </div>
                        <div class="form-text">
                          Доступны после указанного времени
                        </div>
                      </div>

                      <div v-else class="ms-2">
                        <label
                          :for="'to-' + d.date"
                          class="form-label small mb-1"
                          >Время</label
                        >
                        <div class="input-group input-group-sm">
                          <span class="input-group-text"
                            ><i class="bi bi-clock" aria-hidden="true"></i
                          ></span>
                          <input
                            :id="'to-' + d.date"
                            v-model="d.to_time"
                            type="time"
                            step="300"
                            class="form-control"
                            :class="{ 'is-invalid': !isValidPartial(d) }"
                            required
                            @change="saveDayIfValid(d)"
                          />
                        </div>
                        <div class="form-text">
                          Доступны до указанного времени
                        </div>
                      </div>

                      <!-- Presets intentionally omitted for a cleaner UI -->
                    </div>
                  </div>
                  <div v-if="!isValidPartial(d)" class="col-12">
                    <div class="invalid-feedback d-block">
                      Выберите режим и укажите время
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <!-- No confirmation modal; locked days cannot be edited -->
</template>

<style scoped>
.modal .btn-brand {
  min-width: 6rem;
}
.schedule-day {
  padding-bottom: 1rem;
  border-bottom: 1px solid #dee2e6;
}
.schedule-day:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}
.status-icon i {
  line-height: 1;
}
.btn-square {
  width: 2rem;
  height: 2rem;
  padding: 0 !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
/* Active state fill for outline buttons to improve affordance */
.btn-outline-success.active {
  background-color: #198754;
  color: #fff;
  border-color: #198754;
}
.btn-outline-warning.active {
  background-color: #ffc107;
  color: #212529;
  border-color: #ffc107;
}
.btn-outline-secondary.active {
  background-color: #6c757d;
  color: #fff;
  border-color: #6c757d;
}

/* Make disabled action buttons more visibly inactive */
.status-icon:disabled,
.status-icon[disabled] {
  opacity: 0.35 !important;
  filter: grayscale(35%);
}

.week-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}
@media (min-width: 992px) {
  /* lg */
  .week-grid {
    grid-template-columns: 1fr 1fr;
  }
}
.week-card .card-header {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #fff;
  border-bottom: 1px solid #e9ecef;
  padding: 0.75rem 1rem; /* slightly increased vertical spacing */
}
.tile-list {
  display: grid;
  gap: 0.75rem;
}
.schedule-day.locked {
  opacity: 0.55;
}
.is-locked {
  pointer-events: none;
}
.day-title {
  font-weight: 600;
  letter-spacing: 0.1px;
}
.week-title {
  font-weight: 600;
}
.week-title {
  font-size: 1.125rem;
}
@media (min-width: 576px) {
  .week-title {
    font-size: 1.25rem;
  }
}

/* Mobile-first tile and control sizing for better touch targets */
@media (max-width: 575.98px) {
  .btn-square {
    width: 2.5rem;
    height: 2.5rem;
  }
  .week-grid {
    gap: 0.5rem;
  }
  .week-card .card-body {
    padding: 0.75rem;
  }
  .schedule-day {
    padding-bottom: 0.75rem;
  }
  .input-group.input-group-sm {
    width: 100%;
  }
}
@media (min-width: 576px) {
  .week-card .card-body {
    padding: 1rem;
  }
}
</style>
