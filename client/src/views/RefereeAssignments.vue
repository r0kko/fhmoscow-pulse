<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api';
import { auth } from '../auth';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import TabSelector from '../components/TabSelector.vue';
import yandexLogo from '../assets/yandex-maps.svg';
import metroIcon from '../assets/metro.svg';
import { withHttp } from '../utils/url';
import {
  formatMskDateLong,
  formatMskTimeShort,
  MOSCOW_TZ,
  toDayKey,
} from '../utils/time';

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
const router = useRouter();
const breadcrumbs = Object.freeze([
  { label: 'Главная', to: '/' },
  { label: 'Назначения', disabled: true },
]);

const normalizedMatches = computed(() =>
  matches.value.map((match) => {
    const assignments = Array.isArray(match.assignments)
      ? match.assignments
      : [];
    const userAssignments = assignments.filter(
      (a) => a.user?.id === currentUserId.value
    );
    const hasPublished = userAssignments.some((a) => a.status === 'PUBLISHED');
    const hasConfirmed = userAssignments.some((a) => a.status === 'CONFIRMED');
    const status = hasPublished
      ? 'PUBLISHED'
      : hasConfirmed
        ? 'CONFIRMED'
        : null;
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
      todayKey == null
        ? 0
        : (toDayKey(date.toISOString(), MOSCOW_TZ) - todayKey) / DAY_MS;
    const { line1, line2 } = formatTabLines(date, offset);
    return {
      key,
      label: line1,
      subLabel: line2,
      alert: (entry.published || 0) > 0,
      alertLabel: 'Назначения не подтверждены',
    };
  });
});

const activeDayKey = computed({
  get: () => activeDate.value || '',
  set: (value) => {
    activeDate.value = value ? String(value) : '';
  },
});

const publishedCount = computed(
  () => normalizedMatches.value.filter((m) => m.status === 'PUBLISHED').length
);
const activeDayMeta = computed(() =>
  dates.value.find((entry) => entry.date === activeDate.value)
);
const dayNeedsConfirmation = computed(() => {
  if (activeDayMeta.value) return (activeDayMeta.value.published || 0) > 0;
  return publishedCount.value > 0;
});
const dayHasAssignments = computed(() => {
  if (activeDayMeta.value) return (activeDayMeta.value.total || 0) > 0;
  return normalizedMatches.value.length > 0;
});
const dayIsConfirmed = computed(
  () => dayHasAssignments.value && !dayNeedsConfirmation.value
);
const canConfirmDay = computed(
  () => dayNeedsConfirmation.value && !confirming.value
);
const confirmButtonLabel = computed(() =>
  dayIsConfirmed.value
    ? 'Назначения подтверждены'
    : 'Подтвердить назначения за день'
);

const currentUserId = computed(() => auth.user?.id || '');

const visibleGroupIds = computed(() => {
  const ids = new Set();
  normalizedMatches.value.forEach((match) => {
    (match.assignments || []).forEach((assignment) => {
      if (
        assignment.user?.id === currentUserId.value &&
        assignment.role?.group_id
      ) {
        ids.add(assignment.role.group_id);
      }
    });
  });
  if (ids.size) return ids;
  normalizedMatches.value.forEach((match) => {
    (match.assignments || []).forEach((assignment) => {
      if (assignment.role?.group_id) ids.add(assignment.role.group_id);
    });
  });
  return ids;
});

const roleColumns = computed(() => {
  const columns = new Map();
  const groupIds = visibleGroupIds.value;
  normalizedMatches.value.forEach((match) => {
    (match.assignments || []).forEach((assignment) => {
      const role = assignment.role;
      if (!role?.id || !role?.name) return;
      if (groupIds.size && !groupIds.has(role.group_id)) return;
      if (!columns.has(role.id)) {
        columns.set(role.id, {
          id: role.id,
          name: role.name,
          group_id: role.group_id,
          group_name: role.group_name || '',
        });
      }
    });
  });
  return Array.from(columns.values()).sort((a, b) => {
    const groupA = a.group_name || '';
    const groupB = b.group_name || '';
    const groupCompare = groupA.localeCompare(groupB, 'ru', {
      sensitivity: 'base',
    });
    if (groupCompare !== 0) return groupCompare;
    return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
  });
});

const assignmentsByMatchRole = computed(() => {
  const map = new Map();
  normalizedMatches.value.forEach((match) => {
    const roleMap = new Map();
    (match.assignments || []).forEach((assignment) => {
      const roleId = assignment.role?.id;
      if (!roleId) return;
      if (!roleMap.has(roleId)) roleMap.set(roleId, []);
      roleMap.get(roleId).push(assignment);
    });
    map.set(match.id, roleMap);
  });
  return map;
});

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

function openMatchDetails(matchId) {
  if (!matchId) return;
  router.push({ path: `/referee-assignments/matches/${matchId}` });
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

function metroLabel(metro) {
  if (!Array.isArray(metro) || !metro.length) return '';
  const normalized = metro
    .map((entry) => {
      const name = entry?.name || entry?.station || '';
      const rawDistance =
        entry?.distance_m ?? entry?.distance ?? entry?.distance_km ?? null;
      const distance = Number.isFinite(rawDistance)
        ? Number(rawDistance)
        : Number.parseFloat(rawDistance);
      return {
        name,
        distance: Number.isFinite(distance) ? distance : null,
      };
    })
    .filter((entry) => entry.name);
  if (!normalized.length) return '';
  normalized.sort((a, b) => {
    if (a.distance === null && b.distance === null) return 0;
    if (a.distance === null) return 1;
    if (b.distance === null) return -1;
    return a.distance - b.distance;
  });
  return normalized[0].name;
}

function matchTitle(match) {
  const home = match.team1?.name || '—';
  const away = match.team2?.name || '—';
  return `${home} — ${away}`;
}

function refereeLabel(user) {
  if (!user) return '—';
  const last = user.last_name || '';
  const first = user.first_name || '';
  const patronymic = user.patronymic || '';
  const initials = [first, patronymic]
    .filter(Boolean)
    .map((part) => `${part.charAt(0)}.`)
    .join(' ');
  return [last, initials].filter(Boolean).join(' ').trim() || '—';
}

function assignmentsForRole(match, roleId) {
  return assignmentsByMatchRole.value.get(match.id)?.get(roleId) ?? [];
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
  if (!value) {
    window.localStorage.removeItem(key);
    return;
  }
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
        metro_label: metroLabel(match.ground?.metro),
        yandex_url: match.ground?.yandex_url || null,
        matches: [],
        first_start: null,
        last_end: null,
        travel_gap_minutes: null,
      });
    } else {
      const entry = map.get(key);
      if (!entry.metro_label) {
        entry.metro_label = metroLabel(match.ground?.metro);
      }
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
      <Breadcrumbs :items="breadcrumbs" />
      <h1 class="mb-3">Назначения</h1>

      <section class="card section-card tile fade-in shadow-sm">
        <div class="card-body assignments-results">
          <div v-if="dayTabs.length" class="results-header">
            <TabSelector
              v-model="activeDayKey"
              :tabs="dayTabs"
              v-bind="{ ariaLabel: 'Дни назначений' }"
              :nav-fill="false"
              justify="start"
            />
          </div>

          <div v-if="error" class="alert alert-danger" role="alert">
            {{ error }}
          </div>
          <div
            v-else-if="loadingDates || loadingMatches"
            class="text-center py-3"
          >
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
              <div
                v-if="!arenaGroups.length"
                class="alert alert-light border small text-center"
                role="status"
              >
                На выбранный день назначений нет.
              </div>
              <div v-else class="arena-list">
                <div
                  v-for="arena in arenaGroups"
                  :key="arena.key"
                  class="arena-entry"
                >
                  <div
                    v-if="arena.travel_gap_minutes !== null"
                    class="travel-divider"
                  >
                    <span class="travel-label">
                      Переезд: {{ formatGap(arena.travel_gap_minutes) }}
                    </span>
                  </div>
                  <div class="arena-block">
                    <div class="arena-header">
                      <div class="arena-info">
                        <div class="arena-name">
                          {{ arena.name }}
                        </div>
                        <div v-if="arena.address" class="arena-address">
                          {{ arena.address }}
                        </div>
                        <div v-if="arena.metro_label" class="arena-metro">
                          <img
                            :src="metroIcon"
                            alt="Метро"
                            class="metro-icon"
                          />
                          <span>{{ arena.metro_label }}</span>
                        </div>
                      </div>
                      <a
                        v-if="arena.yandex_url"
                        :href="withHttp(arena.yandex_url)"
                        class="route-link arena-link"
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Открыть в Яндекс.Картах"
                      >
                        <img :src="yandexLogo" alt="Яндекс.Карты" height="18" />
                      </a>
                    </div>

                    <div class="table-responsive">
                      <table class="table table-sm assignments-table">
                        <colgroup>
                          <col class="col-time" />
                          <col class="col-match" />
                          <col
                            v-for="role in roleColumns"
                            :key="role.id"
                            class="col-role"
                          />
                        </colgroup>
                        <thead>
                          <tr>
                            <th class="col-time">Время</th>
                            <th class="col-match">Матч</th>
                            <th
                              v-for="role in roleColumns"
                              :key="role.id"
                              class="col-role"
                            >
                              {{ role.name }}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="match in arena.matches"
                            :key="match.id"
                            class="match-row"
                            role="button"
                            tabindex="0"
                            :aria-label="`Открыть матч ${matchTitle(match)}`"
                            @click="openMatchDetails(match.id)"
                            @keydown.enter="openMatchDetails(match.id)"
                            @keydown.space.prevent="openMatchDetails(match.id)"
                          >
                            <td class="col-time">
                              <div class="time-text">
                                {{ match.start_time }}
                              </div>
                            </td>
                            <td class="col-match">
                              <div class="match-teams">
                                {{ matchTitle(match) }}
                              </div>
                              <div class="match-meta text-muted">
                                {{ formatMatchMeta(match) }}
                              </div>
                            </td>
                            <td
                              v-for="role in roleColumns"
                              :key="role.id"
                              class="col-role"
                            >
                              <div class="role-cell-label d-md-none">
                                {{ role.name }}
                              </div>
                              <div class="referee-list">
                                <span
                                  v-for="assignment in assignmentsForRole(
                                    match,
                                    role.id
                                  )"
                                  :key="assignment.id"
                                  class="referee-name"
                                  :class="{
                                    'is-current-user':
                                      assignment.user?.id === currentUserId,
                                  }"
                                >
                                  {{ refereeLabel(assignment.user) }}
                                </span>
                                <span
                                  v-if="
                                    assignmentsForRole(match, role.id)
                                      .length === 0
                                  "
                                  class="text-muted"
                                >
                                  —
                                </span>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <div class="day-footer">
                  <button
                    class="btn confirm-day-btn"
                    :class="{
                      'is-pending': dayNeedsConfirmation,
                      'is-confirmed': !dayNeedsConfirmation,
                    }"
                    type="button"
                    :disabled="!canConfirmDay"
                    @click="openConfirmDay"
                  >
                    {{ confirmButtonLabel }}
                  </button>
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

.arena-list {
  display: grid;
  gap: 1.25rem;
}

.arena-entry {
  display: grid;
  gap: 0.5rem;
}

.arena-block {
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 0.75rem 0.9rem;
  background: #f8f9fa;
}

.travel-divider {
  position: relative;
  text-align: center;
  color: #6c757d;
  font-size: 0.78rem;
  margin: 0.2rem 0 0.35rem;
}

.travel-divider::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  border-top: 1px dashed #cfd4da;
  z-index: 1;
}

.travel-label {
  position: relative;
  z-index: 2;
  padding: 0 0.6rem;
  background: var(--bs-body-bg, #fff);
}

.arena-header {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.6rem;
}

.arena-info {
  min-width: 0;
  padding-right: 2.6rem;
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

.arena-metro {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.25rem;
  font-size: 0.78rem;
  color: #6c757d;
}

.metro-icon {
  width: 14px;
  height: 14px;
  display: inline-block;
}

.arena-link {
  position: absolute;
  top: 0;
  right: 0;
}

.route-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid #e9ecef;
  background: #fff;
}

.assignments-table {
  margin-bottom: 0;
  font-size: 0.9rem;
  --bs-table-bg: transparent;
  --bs-table-striped-bg: transparent;
  background: transparent;
  table-layout: fixed;
  width: 100%;
}

.assignments-table thead th {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #6c757d;
  border-bottom: 1px solid #dee2e6;
  background: transparent;
}

.match-row td {
  vertical-align: middle;
  padding-top: 0.35rem;
  padding-bottom: 0.35rem;
  background: transparent;
}

.match-row {
  cursor: pointer;
}

.match-row:hover {
  background-color: rgba(17, 56, 103, 0.04);
}

.match-row:hover td {
  background-color: rgba(17, 56, 103, 0.04);
}

.match-row:focus-visible {
  outline: 2px solid var(--brand-color, #113867);
  outline-offset: 2px;
}

.col-time {
  width: 80px;
}

col.col-time {
  width: 80px;
}

col.col-role {
  width: 180px;
}

.time-text {
  font-weight: 600;
  font-size: 0.92rem;
}

.match-teams {
  font-weight: 600;
  font-size: 0.92rem;
  line-height: 1.2;
  word-break: break-word;
  hyphens: auto;
}

.match-meta {
  font-size: 0.8rem;
  line-height: 1.2;
  word-break: break-word;
  hyphens: auto;
}

.referee-list {
  display: grid;
  gap: 0.25rem;
}

.referee-name {
  display: inline-flex;
  align-items: center;
  font-size: 0.82rem;
  font-weight: 500;
  color: #212529;
}

.referee-name.is-current-user {
  color: var(--brand-color, #113867);
  font-weight: 700;
}

.role-cell-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #6c757d;
  margin-bottom: 0.2rem;
}

.confirm-summary {
  display: grid;
  gap: 0.25rem;
}

.confirm-date {
  font-weight: 600;
}

.day-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 0.5rem;
}

.confirm-day-btn {
  font-weight: 600;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.confirm-day-btn.is-pending {
  background-color: var(--bs-danger, #dc3545);
  border-color: var(--bs-danger, #dc3545);
  color: #fff;
}

.confirm-day-btn.is-confirmed {
  background-color: #d1e7dd;
  border-color: #c3e0d2;
  color: #1b4d2b;
}

.confirm-day-btn:disabled {
  opacity: 1;
}

.confirm-day-btn.is-confirmed:disabled {
  background-color: #d1e7dd;
  border-color: #c3e0d2;
  color: #1b4d2b;
}

.confirm-day-btn.is-pending:disabled {
  background-color: var(--bs-danger, #dc3545);
  border-color: var(--bs-danger, #dc3545);
  color: #fff;
}

@media (max-width: 1199.98px) {
  .arena-block {
    padding: 0.65rem 0.75rem;
  }
  .arena-name {
    font-size: 0.92rem;
  }
  .arena-address {
    font-size: 0.8rem;
  }
  .assignments-table {
    font-size: 0.85rem;
  }
  .col-time,
  col.col-time {
    width: 72px;
  }
  col.col-role {
    width: 150px;
  }
  .time-text,
  .match-teams {
    font-size: 0.88rem;
  }
  .match-meta {
    font-size: 0.75rem;
  }
  .referee-name {
    font-size: 0.78rem;
  }
}

@media (max-width: 767.98px) {
  .arena-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  .table-responsive {
    overflow-x: visible;
  }
  .assignments-table {
    font-size: 0.84rem;
    table-layout: auto;
  }
  col.col-time,
  col.col-match,
  col.col-role {
    width: auto;
  }
  .assignments-table thead {
    display: none;
  }
  .assignments-table tbody tr {
    display: grid;
    grid-template-columns: minmax(60px, 74px) 1fr;
    gap: 0.4rem 0.75rem;
    border: 1px solid #e5e9f0;
    border-radius: 10px;
    padding: 0.6rem 0.7rem;
    margin-bottom: 0.5rem;
    background: #fff;
    box-shadow: 0 1px 2px rgba(17, 56, 103, 0.06);
  }
  .assignments-table tbody td {
    padding: 0;
    min-width: 0;
    border: none;
  }
  .assignments-table tbody td.col-time {
    grid-column: 1;
    grid-row: 1;
    align-self: start;
  }
  .assignments-table tbody td.col-match {
    grid-column: 2;
    grid-row: 1;
    min-width: 0;
  }
  .assignments-table tbody td.col-role {
    grid-column: 1 / -1;
    border-top: none;
    padding-top: 0.2rem;
  }
  .time-text {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 3.2rem;
    background: #e8eef6;
    color: var(--brand-color, #113867);
    border-radius: 0.4rem;
    padding: 0.15rem 0.35rem;
  }
  .match-teams {
    font-size: 0.88rem;
  }
  .match-meta {
    font-size: 0.74rem;
  }
  .referee-list {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.2rem 0.6rem;
  }
  .referee-name,
  .text-muted {
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .role-cell-label {
    font-size: 0.68rem;
  }
  .day-footer {
    justify-content: stretch;
  }
  .day-footer .btn {
    width: 100%;
  }
}

@media (max-width: 575.98px) {
  .assignments-results {
    gap: 0.75rem;
  }
  .arena-entry {
    gap: 0.4rem;
  }
  .travel-divider {
    margin: 0.15rem 0 0.25rem;
    font-size: 0.72rem;
  }
  .arena-block {
    padding: 0.55rem 0.6rem;
  }
  .arena-info {
    padding-right: 2.2rem;
  }
  .arena-name {
    font-size: 0.9rem;
  }
  .arena-address {
    font-size: 0.78rem;
  }
  .assignments-table tbody tr {
    grid-template-columns: 1fr;
    gap: 0.35rem;
  }
  .assignments-table tbody tr + tr {
    margin-top: 0.15rem;
  }
  .assignments-table tbody td.col-time,
  .assignments-table tbody td.col-match {
    grid-column: 1;
    grid-row: auto;
  }
  .assignments-table tbody td.col-match {
    margin-bottom: 0.15rem;
  }
  .match-teams {
    font-size: 0.85rem;
  }
  .match-meta {
    font-size: 0.72rem;
  }
  .referee-list {
    grid-template-columns: 1fr;
  }
  .role-cell-label {
    margin-bottom: 0.15rem;
  }
}
</style>
