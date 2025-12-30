<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { RouterLink } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api';
import TabSelector from '../components/TabSelector.vue';
import { formatMskDateLong, formatMskTimeShort, MOSCOW_TZ, toDayKey } from '../utils/time';

const DATE_STORAGE_KEY = 'refereeAssignmentsActiveDate';
const DAY_MS = 24 * 60 * 60 * 1000;

const dates = ref([]);
const matches = ref([]);
const loadingDates = ref(false);
const loadingMatches = ref(false);
const error = ref('');
const activeDate = ref(loadStoredDate(DATE_STORAGE_KEY));

const confirmModalRef = ref(null);
let confirmModal;
const confirming = ref(false);
const confirmError = ref('');

const normalizedMatches = computed(() =>
  matches.value.map((match) => {
    const assignments = Array.isArray(match.assignments)
      ? match.assignments
      : [];
    const hasPublished = assignments.some((a) => a.status === 'PUBLISHED');
    const hasConfirmed = assignments.some((a) => a.status === 'CONFIRMED');
    const status = hasPublished
      ? 'PUBLISHED'
      : hasConfirmed
        ? 'CONFIRMED'
        : null;
    const roleLabels = Array.from(
      new Set(
        assignments
          .map((a) => a.role?.name || '')
          .map((name) => name.trim())
          .filter(Boolean)
      )
    );
    const startTime =
      match.msk_start_time ||
      formatMskTimeShort(match.date_start, { placeholder: '—:—' });
    const startSeconds =
      mskSecondsFromIso(match.date_start) ?? parseTimeSeconds(startTime);
    const durationMinutes = Number.isFinite(match.duration_minutes)
      ? Number(match.duration_minutes)
      : null;
    const endSeconds =
      startSeconds !== null && durationMinutes && durationMinutes > 0
        ? startSeconds + durationMinutes * 60
        : parseTimeSeconds(match.msk_end_time);

    return {
      ...match,
      start_time: startTime,
      start_seconds: startSeconds,
      end_seconds: endSeconds,
      status,
      role_labels: roleLabels,
    };
  })
);

const arenaGroups = computed(() => buildArenaGroups(normalizedMatches.value));

const dayTabs = computed(() => {
  const todayKey = toDayKey(new Date().toISOString(), MOSCOW_TZ);
  return dates.value.map((entry) => {
    const date = new Date(`${entry.date}T00:00:00+03:00`);
    const key = entry.date;
    const offset =
      todayKey == null ? 0 : (toDayKey(date.toISOString(), MOSCOW_TZ) - todayKey) / DAY_MS;
    const { line1, line2 } = formatTabLines(date, offset);
    return {
      key,
      label: line1,
      subLabel: line2,
      badge: entry.total || 0,
      total: entry.total || 0,
      published: entry.published || 0,
      confirmed: entry.confirmed || 0,
    };
  });
});

const activeDayKey = computed({
  get: () => activeDate.value || '',
  set: (value) => {
    activeDate.value = value ? String(value) : '';
  },
});

const selectedDayCount = computed(() =>
  normalizedMatches.value.length
);
const publishedCount = computed(() =>
  normalizedMatches.value.filter((m) => m.status === 'PUBLISHED').length
);
const confirmedCount = computed(() =>
  normalizedMatches.value.filter((m) => m.status === 'CONFIRMED').length
);
const canConfirmDay = computed(
  () => publishedCount.value > 0 && !confirming.value
);

const pluralRules = new Intl.PluralRules('ru-RU');

function matchesLabel(value) {
  const rule = pluralRules.select(value);
  if (rule === 'one') return 'матч';
  if (rule === 'few') return 'матча';
  return 'матчей';
}

onMounted(() => {
  if (confirmModalRef.value) {
    confirmModal = new Modal(confirmModalRef.value);
  }
  void loadDates();
});

onBeforeUnmount(() => {
  if (confirmModal) confirmModal.dispose();
});

watch(
  () => activeDate.value,
  () => {
    saveStoredDate(DATE_STORAGE_KEY, activeDate.value);
    if (loadingDates.value) return;
    if (activeDate.value) void loadAssignments();
  }
);

async function loadDates() {
  loadingDates.value = true;
  error.value = '';
  try {
    const data = await apiFetch('/referee-assignments/my/dates');
    dates.value = Array.isArray(data.dates) ? data.dates : [];
    if (!dates.value.length) {
      activeDate.value = '';
      matches.value = [];
      return;
    }
    const stored = activeDate.value;
    const hasStored = stored && dates.value.some((d) => d.date === stored);
    if (!hasStored) {
      activeDate.value = dates.value[0].date;
    }
    saveStoredDate(DATE_STORAGE_KEY, activeDate.value);
    if (activeDate.value) {
      await loadAssignments();
    }
  } catch (e) {
    error.value = e.message || 'Не удалось загрузить список дат';
  } finally {
    loadingDates.value = false;
  }
}

async function loadAssignments() {
  if (!activeDate.value) return;
  loadingMatches.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({ date: activeDate.value });
    const data = await apiFetch(`/referee-assignments/my?${params}`);
    matches.value = Array.isArray(data.matches) ? data.matches : [];
  } catch (e) {
    error.value = e.message || 'Не удалось загрузить назначения';
  } finally {
    loadingMatches.value = false;
  }
}

function openConfirmDay() {
  confirmError.value = '';
  if (!confirmModal) {
    confirmModal = new Modal(confirmModalRef.value);
  }
  confirmModal.show();
}

async function confirmDayAssignments() {
  if (!activeDate.value) return;
  confirming.value = true;
  confirmError.value = '';
  try {
    await apiFetch('/referee-assignments/my/confirm', {
      method: 'POST',
      body: JSON.stringify({ date: activeDate.value }),
    });
    confirmModal?.hide();
    await loadAssignments();
    await loadDates();
  } catch (e) {
    confirmError.value = e.message || 'Не удалось подтвердить назначения';
  } finally {
    confirming.value = false;
  }
}

function statusLabel(match) {
  if (match.status === 'CONFIRMED') return 'Подтверждено';
  if (match.status === 'PUBLISHED') return 'Опубликовано';
  return '—';
}

function statusClass(match) {
  if (match.status === 'CONFIRMED') return 'pill pill-success';
  if (match.status === 'PUBLISHED') return 'pill pill-warning';
  return 'pill pill-muted';
}

function formatGap(minutes) {
  if (!Number.isFinite(minutes)) return '';
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours && mins) return `${hours} ч ${mins} мин`;
  if (hours) return `${hours} ч`;
  return `${mins} мин`;
}

function formatMatchMeta(match) {
  const parts = [
    match.tournament?.short_name || match.tournament?.name,
    match.group?.name,
  ].filter(Boolean);
  return parts.join(' · ');
}

function matchTitle(match) {
  const home = match.team1?.name || '—';
  const away = match.team2?.name || '—';
  return `${home} — ${away}`;
}

function dayLabel(dateKey) {
  if (!dateKey) return 'Без даты';
  const date = new Date(`${dateKey}T00:00:00+03:00`);
  return formatMskDateLong(date.toISOString());
}

function loadStoredDate(key) {
  if (typeof window === 'undefined') return '';
  const value = window.localStorage.getItem(key);
  if (!value) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

function saveStoredDate(key, value) {
  if (typeof window === 'undefined') return;
  if (!value) return;
  window.localStorage.setItem(key, value);
}

function parseTimeSeconds(value) {
  if (!value) return null;
  const text = String(value).trim();
  const parts = text.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const [hourPart, minutePart, secondPart] = parts;
  if (!/^\d{1,2}$/.test(hourPart) || !/^\d{2}$/.test(minutePart)) {
    return null;
  }
  if (secondPart !== undefined && !/^\d{2}$/.test(secondPart)) return null;
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

function mskSecondsFromIso(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: MOSCOW_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .formatToParts(date)
    .reduce((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 3600 + minute * 60;
}

function buildArenaGroups(list) {
  const map = new Map();
  list.forEach((match) => {
    const key = match.ground?.id || match.ground?.name || 'unknown';
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: match.ground?.name || 'Без арены',
        address: match.ground?.address || null,
        yandex_url: match.ground?.yandex_url || null,
        matches: [],
        first_start: null,
        last_end: null,
        travel_gap_minutes: null,
      });
    }
    map.get(key).matches.push(match);
  });

  const groups = Array.from(map.values());
  groups.forEach((group) => {
    group.matches.sort((a, b) => {
      const tA = a.start_seconds ?? Number.POSITIVE_INFINITY;
      const tB = b.start_seconds ?? Number.POSITIVE_INFINITY;
      if (tA !== tB) return tA - tB;
      return matchTitle(a).localeCompare(matchTitle(b), 'ru', {
        sensitivity: 'base',
      });
    });
    const starts = group.matches
      .map((m) => m.start_seconds)
      .filter((v) => v !== null);
    const ends = group.matches
      .map((m) => m.end_seconds)
      .filter((v) => v !== null);
    group.first_start = starts.length ? Math.min(...starts) : null;
    group.last_end = ends.length ? Math.max(...ends) : null;
  });

  groups.sort((a, b) => {
    const tA = a.first_start ?? Number.POSITIVE_INFINITY;
    const tB = b.first_start ?? Number.POSITIVE_INFINITY;
    if (tA !== tB) return tA - tB;
    return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
  });

  let prev = null;
  groups.forEach((group) => {
    if (prev && prev.last_end !== null && group.first_start !== null) {
      const gap = (group.first_start - prev.last_end) / 60;
      group.travel_gap_minutes = Math.max(0, Math.round(gap));
    } else {
      group.travel_gap_minutes = null;
    }
    prev = group;
  });

  return groups;
}

function formatTabLines(date, offset) {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TZ,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
    .formatToParts(date)
    .reduce((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
  const weekday = (parts.weekday || '').replace('.', '');
  const day = parts.day || '';
  const month = parts.month || '';
  const ddmm = [day, month].filter(Boolean).join(' ');
  const normalizedOffset = Math.round(offset);
  if (normalizedOffset === 0) return { line1: ddmm, line2: 'Сегодня' };
  if (normalizedOffset === 1) return { line1: ddmm, line2: 'Завтра' };
  if (normalizedOffset === -1) return { line1: ddmm, line2: 'Вчера' };
  if (normalizedOffset === -2) return { line1: ddmm, line2: 'Позавчера' };
  return { line1: ddmm, line2: weekday };
}

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
            Назначения
          </li>
        </ol>
      </nav>
      <h1 class="mb-3">Назначения</h1>

      <section class="card section-card tile fade-in shadow-sm">
        <div class="card-body assignments-results">
          <div class="results-header">
            <TabSelector
              v-model="activeDayKey"
              :tabs="dayTabs"
              v-bind="{ ariaLabel: 'Дни назначений' }"
              :nav-fill="false"
              justify="start"
            />
            <div class="day-actions">
              <div class="text-muted small">
                Всего: {{ selectedDayCount }} {{ matchesLabel(selectedDayCount) }}
              </div>
              <div class="status-chips">
                <span class="badge bg-warning-subtle text-warning">
                  Опубликовано: {{ publishedCount }}
                </span>
                <span class="badge bg-success-subtle text-success">
                  Подтверждено: {{ confirmedCount }}
                </span>
              </div>
              <button
                class="btn btn-sm btn-primary"
                type="button"
                :disabled="!canConfirmDay"
                @click="openConfirmDay"
              >
                Подтвердить назначения за день
              </button>
            </div>
          </div>

          <div v-if="error" class="alert alert-danger" role="alert">
            {{ error }}
          </div>
          <div v-else-if="loadingDates || loadingMatches" class="text-center py-3">
            <div
              class="spinner-border spinner-brand"
              role="status"
              aria-label="Загрузка"
            >
              <span class="visually-hidden">Загрузка…</span>
            </div>
          </div>
          <template v-else>
            <div
              v-if="!dayTabs.length"
              class="alert alert-light border small mb-0"
              role="status"
            >
              Назначений пока нет.
            </div>
            <template v-else>
              <div v-if="!arenaGroups.length" class="text-muted small text-center">
                На выбранный день назначений нет.
              </div>
              <div v-else class="arena-list">
                <div
                  v-for="arena in arenaGroups"
                  :key="arena.key"
                  class="arena-block"
                >
                  <div class="arena-header">
                    <div>
                      <div class="arena-name">
                        {{ arena.name }}
                      </div>
                      <div v-if="arena.address" class="arena-address">
                        {{ arena.address }}
                      </div>
                    </div>
                    <div class="arena-meta">
                      <a
                        v-if="arena.yandex_url"
                        :href="arena.yandex_url"
                        class="link-secondary small"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Маршрут
                      </a>
                      <span class="badge bg-light text-dark">
                        {{ arena.matches.length }}
                        {{ matchesLabel(arena.matches.length) }}
                      </span>
                      <span
                        v-if="arena.travel_gap_minutes !== null"
                        class="badge bg-info-subtle text-info"
                      >
                        Переезд: {{ formatGap(arena.travel_gap_minutes) }}
                      </span>
                    </div>
                  </div>

                  <div class="table-responsive">
                    <table class="table table-sm assignments-table">
                      <thead>
                        <tr>
                          <th class="col-time">Время</th>
                          <th class="col-match">Матч</th>
                          <th class="col-role">Амплуа</th>
                          <th class="col-status">Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="match in arena.matches"
                          :key="match.id"
                          class="match-row"
                        >
                          <td class="col-time">
                            <div class="time-text">{{ match.start_time }}</div>
                          </td>
                          <td class="col-match">
                            <div class="match-teams">
                              {{ matchTitle(match) }}
                            </div>
                            <div class="match-meta text-muted">
                              {{ formatMatchMeta(match) }}
                            </div>
                          </td>
                          <td class="col-role">
                            <div
                              v-if="match.role_labels.length"
                              class="role-list"
                            >
                              <div
                                v-for="role in match.role_labels"
                                :key="role"
                                class="role-item"
                              >
                                {{ role }}
                              </div>
                            </div>
                            <span v-else class="text-muted">—</span>
                          </td>
                          <td class="col-status">
                            <span :class="statusClass(match)">
                              {{ statusLabel(match) }}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </template>
          </template>
        </div>
      </section>
    </div>
  </div>

  <div
    ref="confirmModalRef"
    class="modal fade"
    tabindex="-1"
    aria-labelledby="refereeConfirmDayModalLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 id="refereeConfirmDayModalLabel" class="modal-title">
            Подтверждение назначений
          </h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
          ></button>
        </div>
        <div class="modal-body">
          <div class="confirm-summary">
            <div class="confirm-date">
              {{ dayLabel(activeDate) }}
            </div>
            <div class="text-muted small">
              Опубликовано: {{ publishedCount }} · Подтверждено:
              {{ confirmedCount }}
            </div>
          </div>
          <div v-if="confirmError" class="text-danger small mt-2">
            {{ confirmError }}
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            data-bs-dismiss="modal"
            :disabled="confirming"
          >
            Отмена
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="confirming"
            @click="confirmDayAssignments"
          >
            <span
              v-if="confirming"
              class="spinner-border spinner-border-sm me-2"
            ></span>
            Подтвердить все
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.assignments-results {
  display: grid;
  gap: 1rem;
}

.results-header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}

.day-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.status-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.arena-list {
  display: grid;
  gap: 1.25rem;
}

.arena-block {
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 0.75rem 0.9rem;
  background: #f8f9fa;
}

.arena-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.6rem;
}

.arena-name {
  font-weight: 600;
  font-size: 0.98rem;
}

.arena-address {
  font-size: 0.85rem;
  color: #6c757d;
  margin-top: 0.1rem;
}

.arena-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.assignments-table {
  margin-bottom: 0;
  font-size: 0.9rem;
}

.assignments-table thead th {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #6c757d;
  border-bottom: 1px solid #e9ecef;
}

.match-row td {
  vertical-align: middle;
  padding-top: 0.35rem;
  padding-bottom: 0.35rem;
}

.col-time {
  width: 80px;
}

.col-status {
  width: 140px;
}

.time-text {
  font-weight: 600;
  font-size: 0.92rem;
}

.match-teams {
  font-weight: 600;
  font-size: 0.92rem;
}

.match-meta {
  font-size: 0.8rem;
}

.role-list {
  display: grid;
  gap: 0.15rem;
}

.role-item {
  font-size: 0.85rem;
}

.confirm-summary {
  display: grid;
  gap: 0.25rem;
}

.confirm-date {
  font-weight: 600;
}

@media (max-width: 767.98px) {
  .arena-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .assignments-table {
    font-size: 0.86rem;
  }
}
</style>
