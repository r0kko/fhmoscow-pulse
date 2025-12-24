<script setup>
import { ref, onMounted, watch, computed, onBeforeUnmount } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api';
import { MOSCOW_TZ } from '../utils/time';

const days = ref([]);
const original = ref([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const savedAt = ref(0);
const pendingByDate = ref(new Set());
// Confirmation modal for switching to FREE under limited lock
const confirmFree = ref({ visible: false, day: null, loading: false });

const instructionsExpanded = ref(false);
const instructionsContentId = 'availability-guidance-panel';
const reduceMotion = ref(false);
let motionMediaQuery;
let handleMotionPreferenceChange;

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

function toggleInstructions() {
  instructionsExpanded.value = !instructionsExpanded.value;
}

function setCollapseTransition(el) {
  const heightDuration = reduceMotion.value ? 0 : 220;
  const opacityDuration = reduceMotion.value ? 0 : 180;
  el.style.transition = `height ${heightDuration}ms ease, opacity ${opacityDuration}ms ease`;
  el.style.overflow = 'hidden';
}

function resetCollapseStyles(el) {
  el.style.transition = '';
  el.style.height = '';
  el.style.opacity = '';
  el.style.overflow = '';
}

function setupMotionPreference() {
  if (typeof window === 'undefined' || !window.matchMedia) return;
  motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const syncPreference = (event) => {
    reduceMotion.value = event.matches;
  };
  handleMotionPreferenceChange = syncPreference;
  reduceMotion.value = motionMediaQuery.matches;
  if (motionMediaQuery.addEventListener) {
    motionMediaQuery.addEventListener('change', syncPreference);
  } else {
    motionMediaQuery.addListener(syncPreference);
  }
}

function teardownMotionPreference() {
  if (!motionMediaQuery || !handleMotionPreferenceChange) return;
  if (motionMediaQuery.removeEventListener) {
    motionMediaQuery.removeEventListener(
      'change',
      handleMotionPreferenceChange
    );
  } else {
    motionMediaQuery.removeListener(handleMotionPreferenceChange);
  }
  motionMediaQuery = undefined;
  handleMotionPreferenceChange = undefined;
}

const collapseTransition = {
  onBeforeEnter(el) {
    setCollapseTransition(el);
    el.style.height = '0';
    el.style.opacity = '0';
  },
  onEnter(el) {
    requestAnimationFrame(() => {
      el.style.height = `${el.scrollHeight}px`;
      el.style.opacity = '1';
    });
  },
  onAfterEnter(el) {
    resetCollapseStyles(el);
  },
  onBeforeLeave(el) {
    setCollapseTransition(el);
    el.style.height = `${el.scrollHeight}px`;
    el.style.opacity = '1';
    void el.offsetHeight;
  },
  onLeave(el) {
    requestAnimationFrame(() => {
      el.style.height = '0';
      el.style.opacity = '0';
    });
  },
  onAfterLeave(el) {
    resetCollapseStyles(el);
  },
};

function cloneDays(list) {
  return (list || []).map((d) => ({ ...d }));
}

function normalizePartialMode(raw) {
  if (!raw) return null;
  const value = String(raw).trim().toUpperCase();
  if (
    value === 'BEFORE' ||
    value === 'AFTER' ||
    value === 'WINDOW' ||
    value === 'SPLIT'
  ) {
    return value;
  }
  return null;
}

function inferPartialModeFromTimes(fromTime, toTime) {
  if (fromTime && toTime) {
    const from = parseTimeSeconds(fromTime);
    const to = parseTimeSeconds(toTime);
    if (from !== null && to !== null) {
      if (from > to) return 'SPLIT';
      return 'WINDOW';
    }
    return 'WINDOW';
  }
  if (toTime && !fromTime) return 'BEFORE';
  if (fromTime && !toTime) return 'AFTER';
  return null;
}

function initDay(d) {
  const mode = normalizePartialMode(d.partial_mode);
  // Derive UI-only partial mode from existing times
  if (d.status === 'PARTIAL') {
    d.partialMode =
      mode || inferPartialModeFromTimes(d.from_time, d.to_time) || 'AFTER';
  } else {
    d.partialMode = null;
  }
  d.partial_mode = d.partialMode;
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

function isAllDigits(text) {
  if (!text) return false;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

function parseTimeSeconds(value) {
  if (!value) return null;
  const text = String(value).trim();
  const parts = text.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const [hourPart, minutePart, secondPart] = parts;
  if (!isAllDigits(hourPart) || !isAllDigits(minutePart)) return null;
  if (secondPart !== undefined && !isAllDigits(secondPart)) return null;
  if (
    hourPart.length < 1 ||
    hourPart.length > 2 ||
    minutePart.length !== 2 ||
    (secondPart !== undefined && secondPart.length !== 2)
  ) {
    return null;
  }
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  const second = secondPart ? Number(secondPart) : 0;
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(second) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }
  return hour * 3600 + minute * 60 + second;
}

function isValidPartial(d) {
  if (!isPartial(d)) return true;
  if (d.partialMode === 'BEFORE') {
    return !!d.to_time && !d.from_time && parseTimeSeconds(d.to_time) !== null;
  }
  if (d.partialMode === 'AFTER') {
    return (
      !!d.from_time && !d.to_time && parseTimeSeconds(d.from_time) !== null
    );
  }
  if (d.partialMode === 'WINDOW') {
    if (!d.from_time || !d.to_time) return false;
    const from = parseTimeSeconds(d.from_time);
    const to = parseTimeSeconds(d.to_time);
    return from !== null && to !== null && from < to;
  }
  if (d.partialMode === 'SPLIT') {
    if (!d.from_time || !d.to_time) return false;
    const from = parseTimeSeconds(d.from_time);
    const to = parseTimeSeconds(d.to_time);
    return from !== null && to !== null && to < from;
  }
  return false;
}

const invalidCount = computed(
  () => days.value.filter((d) => !isValidPartial(d)).length
);

watch(invalidCount, (current, previous) => {
  const prevVal = previous ?? 0;
  if (prevVal === 0 && current > 0 && !instructionsExpanded.value) {
    instructionsExpanded.value = true;
  }
});

// Week grouping (ISO week number + ISO week-year)
function moscowDateKey(value = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: MOSCOW_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(value)
      .reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
      }, {});
    const { year, month, day } = parts;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch (_) {
    // Fall through to ISO if Intl fails.
  }
  return new Date(value).toISOString().slice(0, 10);
}

function isoWeekData(dateStr) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (Number.isNaN(date.getTime())) return null;
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const year = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return { week, year };
}

// Time helpers (Moscow timezone)
function mskStartOfDayMs(dateStr) {
  return new Date(`${dateStr}T00:00:00+03:00`).getTime();
}
const weekGroups = computed(() => {
  const groups = new Map();
  for (const d of days.value) {
    const info = isoWeekData(d.date);
    if (!info) continue;
    const key = `${info.year}-${info.week}`;
    if (!groups.has(key))
      groups.set(key, { key, week: info.week, year: info.year, list: [] });
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

// Keep at most two weeks visible following the product policy:
// - Until the next week is present, show previous + current
// - Once next week is available, hide the past week and show current + next
const visibleWeekGroups = computed(() => {
  const all = weekGroups.value;
  if (all.length <= 2) return all;

  // Determine the current ISO week key in Moscow time
  const todayKey = moscowDateKey(new Date());
  const current = isoWeekData(todayKey);
  if (!current) return all.slice(-2);
  const curKey = `${current.year}-${current.week}`;

  const idx = all.findIndex((g) => g.key === curKey);
  if (idx === -1) {
    // Fallback to the last two groups if current is not found
    return all.slice(-2);
  }
  // If there is a next week in data, show current + next
  if (idx + 1 < all.length) {
    return all.slice(idx, idx + 2);
  }
  // Otherwise, show previous + current (guard idx > 0)
  if (idx > 0) {
    return all.slice(idx - 1, idx + 1);
  }
  // As a final fallback, clamp to the first two
  return all.slice(0, 2);
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

async function saveDay(d) {
  if (invalidCount.value > 0) return;
  error.value = '';
  pendingByDate.value.add(d.date);
  const payloadDay = {
    date: d.date,
    status: d.currentStatus ?? d.status,
    from_time: d.from_time ?? null,
    to_time: d.to_time ?? null,
    partial_mode: d.partialMode ?? null,
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
    if (!d.partialMode) {
      d.partialMode =
        inferPartialModeFromTimes(d.from_time, d.to_time) || 'AFTER';
    }
    d.partial_mode = d.partialMode;
    // wait for time input
  } else {
    d.from_time = null;
    d.to_time = null;
    d.partial_mode = null;
    saveDay(d);
  }
}

function saveDayIfValid(d) {
  if (isFullyLocked(d) || isLimitedLocked(d)) return;
  if (isValidPartial(d)) saveDay(d);
}

function onClickFree(d) {
  if (isFullyLocked(d)) return;
  if (isActive(d, 'FREE')) return; // nothing to do
  if (isLimitedLocked(d)) {
    confirmFree.value = { visible: true, day: d, loading: false };
    return;
  }
  setStatus(d, 'FREE');
}

async function confirmSwitchToFree() {
  const d = confirmFree.value.day;
  if (!d) {
    confirmFree.value.visible = false;
    return;
  }
  confirmFree.value.loading = true;
  try {
    setStatus(d, 'FREE');
    confirmFree.value.visible = false;
  } finally {
    confirmFree.value.loading = false;
  }
}

function cancelConfirmFree() {
  confirmFree.value.visible = false;
  confirmFree.value.day = null;
}

function setPartialMode(d, mode) {
  if (isFullyLocked(d) || isLimitedLocked(d)) return;
  d.partialMode = mode;
  d.partial_mode = mode;
  if (mode === 'BEFORE') {
    d.from_time = null;
  } else if (mode === 'AFTER') {
    d.to_time = null;
  } else if (mode === 'WINDOW' || mode === 'SPLIT') {
    // Keep existing bounds for the range.
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
        d.partial_mode = null;
      } else if (!d.partialMode) {
        d.partialMode =
          inferPartialModeFromTimes(d.from_time, d.to_time) || 'AFTER';
        d.partial_mode = d.partialMode;
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
  setupMotionPreference();
});
onBeforeUnmount(() => {
  teardownMotionPreference();
});
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
        <div
          class="card section-card tile fade-in shadow-sm mb-3 instructions-card"
          :class="{ 'is-open': instructionsExpanded }"
        >
          <div class="card-header bg-white border-0 p-0">
            <button
              type="button"
              class="instructions-toggle"
              :aria-controls="instructionsContentId"
              :aria-expanded="instructionsExpanded ? 'true' : 'false'"
              @click="toggleInstructions"
            >
              <span class="d-flex align-items-center">
                <i
                  class="bi bi-info-circle text-brand me-2"
                  aria-hidden="true"
                ></i>
                <span class="toggle-title" role="heading" aria-level="2">
                  Отметьте вашу готовность работать
                </span>
              </span>
              <i class="bi bi-chevron-down toggle-icon" aria-hidden="true"></i>
            </button>
          </div>
          <Transition v-bind="collapseTransition">
            <div
              v-show="instructionsExpanded"
              :id="instructionsContentId"
              class="card-body pt-0 instructions-body"
            >
              <p class="text-muted small mb-3">
                На каждый день укажите статус. Для частичной готовности выберите
                «До», «После», «С—по» или «До и после» и задайте время.
              </p>
              <ul class="list-unstyled small mb-0">
                <li class="d-flex align-items-center mb-2">
                  <i
                    class="bi bi-check-circle text-success me-2"
                    aria-hidden="true"
                  ></i>
                  <span>Свободен — готовы весь день.</span>
                </li>
                <li class="d-flex align-items-center mb-2">
                  <i
                    class="bi bi-clock text-warning me-2"
                    aria-hidden="true"
                  ></i>
                  <span>
                    Частично — «До», «После», «С—по» или «До и после» + время.
                  </span>
                </li>
                <li class="d-flex align-items-center mb-2">
                  <i
                    class="bi bi-slash-circle text-secondary me-2"
                    aria-hidden="true"
                  ></i>
                  <span>Занят — недоступны в этот день.</span>
                </li>
                <li class="d-flex align-items-start mb-2">
                  <i class="bi bi-lock me-2" aria-hidden="true"></i>
                  <span
                    >Заблокированные дни недоступны для редактирования.</span
                  >
                </li>
                <li class="d-flex align-items-start">
                  <i class="bi bi-hourglass-split me-2" aria-hidden="true"></i>
                  <span>
                    За 96 часов можно только изменить занятость на «Свободен».
                    Сотрудники отдела организации судейства будут уведомлены
                    автоматически.
                  </span>
                </li>
              </ul>
            </div>
          </Transition>
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
            v-for="group in visibleWeekGroups"
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
                      @click="onClickFree(d)"
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
                        <input
                          :id="'mode-window-' + d.date"
                          type="radio"
                          class="btn-check"
                          :checked="d.partialMode === 'WINDOW'"
                          @change="setPartialMode(d, 'WINDOW')"
                        />
                        <label
                          class="btn btn-outline-secondary"
                          :for="'mode-window-' + d.date"
                          >С—по</label
                        >
                        <input
                          :id="'mode-split-' + d.date"
                          type="radio"
                          class="btn-check"
                          :checked="d.partialMode === 'SPLIT'"
                          @change="setPartialMode(d, 'SPLIT')"
                        />
                        <label
                          class="btn btn-outline-secondary"
                          :for="'mode-split-' + d.date"
                          >До и после</label
                        >
                      </div>

                      <div v-if="d.partialMode === 'AFTER'" class="ms-2">
                        <label
                          :for="'from-' + d.date"
                          class="form-label small mb-1"
                          >Время (после)</label
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

                      <div v-else-if="d.partialMode === 'BEFORE'" class="ms-2">
                        <label
                          :for="'to-' + d.date"
                          class="form-label small mb-1"
                          >Время (до)</label
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
                      <div
                        v-else-if="d.partialMode === 'WINDOW'"
                        class="ms-2 d-flex flex-wrap align-items-end gap-2"
                      >
                        <div>
                          <label
                            :for="'from-window-' + d.date"
                            class="form-label small mb-1"
                            >Время (с)</label
                          >
                          <div class="input-group input-group-sm">
                            <span class="input-group-text"
                              ><i class="bi bi-clock" aria-hidden="true"></i
                            ></span>
                            <input
                              :id="'from-window-' + d.date"
                              v-model="d.from_time"
                              type="time"
                              step="300"
                              class="form-control"
                              :class="{ 'is-invalid': !isValidPartial(d) }"
                              required
                              @change="saveDayIfValid(d)"
                            />
                          </div>
                        </div>
                        <div>
                          <label
                            :for="'to-window-' + d.date"
                            class="form-label small mb-1"
                            >Время (по)</label
                          >
                          <div class="input-group input-group-sm">
                            <span class="input-group-text"
                              ><i class="bi bi-clock" aria-hidden="true"></i
                            ></span>
                            <input
                              :id="'to-window-' + d.date"
                              v-model="d.to_time"
                              type="time"
                              step="300"
                              class="form-control"
                              :class="{ 'is-invalid': !isValidPartial(d) }"
                              required
                              @change="saveDayIfValid(d)"
                            />
                          </div>
                        </div>
                        <div class="form-text">
                          Доступны в указанном интервале (время «с» раньше «по»)
                        </div>
                      </div>
                      <div
                        v-else
                        class="ms-2 d-flex flex-wrap align-items-end gap-2"
                      >
                        <div>
                          <label
                            :for="'to-split-' + d.date"
                            class="form-label small mb-1"
                            >Время (до)</label
                          >
                          <div class="input-group input-group-sm">
                            <span class="input-group-text"
                              ><i class="bi bi-clock" aria-hidden="true"></i
                            ></span>
                            <input
                              :id="'to-split-' + d.date"
                              v-model="d.to_time"
                              type="time"
                              step="300"
                              class="form-control"
                              :class="{ 'is-invalid': !isValidPartial(d) }"
                              required
                              @change="saveDayIfValid(d)"
                            />
                          </div>
                        </div>
                        <div>
                          <label
                            :for="'from-split-' + d.date"
                            class="form-label small mb-1"
                            >Время (после)</label
                          >
                          <div class="input-group input-group-sm">
                            <span class="input-group-text"
                              ><i class="bi bi-clock" aria-hidden="true"></i
                            ></span>
                            <input
                              :id="'from-split-' + d.date"
                              v-model="d.from_time"
                              type="time"
                              step="300"
                              class="form-control"
                              :class="{ 'is-invalid': !isValidPartial(d) }"
                              required
                              @change="saveDayIfValid(d)"
                            />
                          </div>
                        </div>
                        <div class="form-text">
                          Доступны до указанного времени и после (время «до»
                          раньше «после»)
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
  <!-- Confirmation modal for switching to FREE under limited lock -->
  <div v-if="confirmFree.visible">
    <div class="modal d-block" tabindex="-1" role="dialog" aria-modal="true">
      <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Подтвердите изменение статуса</h5>
            <button
              type="button"
              class="btn-close"
              aria-label="Закрыть"
              :disabled="confirmFree.loading"
              @click="cancelConfirmFree"
            ></button>
          </div>
          <div class="modal-body">
            <p class="mb-2">
              День находится в периоде ограничения (за 96 часов до начала
              суток). Изменение возможно только на «Свободен».
            </p>
            <p class="mb-0">
              Продолжить и установить статус «Свободен» для дня
              <strong>{{
                confirmFree.day && formatDay(confirmFree.day.date)
              }}</strong
              >?
            </p>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-outline-secondary"
              :disabled="confirmFree.loading"
              @click="cancelConfirmFree"
            >
              Отмена
            </button>
            <button
              type="button"
              class="btn btn-brand"
              :disabled="confirmFree.loading"
              @click="confirmSwitchToFree"
            >
              <span
                v-if="confirmFree.loading"
                class="spinner-border spinner-border-sm me-2"
                role="status"
                aria-hidden="true"
              ></span>
              Подтвердить
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop fade show"></div>
  </div>
</template>

<style scoped>
.modal .btn-brand {
  min-width: 6rem;
}
.instructions-card .card-header {
  background: #fff;
  padding: 0;
}
.instructions-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: transparent;
  border: 0;
  color: inherit;
  text-align: left;
  font-weight: 600;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.instructions-toggle:hover {
  background-color: rgba(13, 110, 253, 0.04);
}
.instructions-toggle:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.35);
}
.instructions-card.is-open .instructions-toggle {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom: 1px solid #e9ecef;
}
.toggle-title {
  font-size: 1rem;
}
@media (min-width: 576px) {
  .toggle-title {
    font-size: 1.05rem;
  }
}
.instructions-body {
  padding: 1rem 1.25rem 1.25rem;
}
.instructions-body li {
  line-height: 1.4;
}
.instructions-card .toggle-icon {
  transition: transform 0.2s ease;
  font-size: 1.25rem;
}
.instructions-card.is-open .toggle-icon {
  transform: rotate(180deg);
}
@media (prefers-reduced-motion: reduce) {
  .instructions-toggle {
    transition: none;
  }
  .instructions-card .toggle-icon {
    transition: none;
  }
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
