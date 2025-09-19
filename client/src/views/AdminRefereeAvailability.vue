<script setup>
import { ref, onMounted, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import PageNav from '../components/PageNav.vue';
import Modal from 'bootstrap/js/dist/modal';

const loading = ref(true);
const error = ref('');
const availableDates = ref([]);
const dates = ref([]);
const users = ref([]);
const search = ref('');
const roleOptions = [
  { value: 'REFEREE', label: 'Судья в поле' },
  { value: 'BRIGADE_REFEREE', label: 'Судья в бригаде' },
];
const selectedRoles = ref(new Set(roleOptions.map((r) => r.value)));
const selectedDates = ref(new Set());
const page = ref(1);
const pageSize = ref(25);

// Advanced filters state
const filterFree = ref(false);
const filterBusy = ref(false);
const filterPartialEnabled = ref(false);
const filterPartialMode = ref(''); // 'BEFORE' | 'AFTER' | ''
const filterPartialTime = ref(''); // HH:MM

// Filters modal state
const filtersModalRef = ref(null);
let filtersModal = null;
const modalSelectedRoles = ref(new Set());
const modalSelectedDates = ref(new Set());
const modalFilterFree = ref(false);
const modalFilterBusy = ref(false);
const modalFilterPartialEnabled = ref(false);
const modalFilterPartialMode = ref('');
const modalFilterPartialTime = ref('');

const roleFilterActive = computed(
  () => selectedRoles.value.size !== roleOptions.length
);
const dateFilterActive = computed(() => {
  if (!availableDates.value.length) return false;
  return (
    selectedDates.value.size > 0 &&
    selectedDates.value.size < availableDates.value.length
  );
});
const statusFilterActive = computed(
  () => filterFree.value || filterBusy.value || filterPartialEnabled.value
);
const activeFiltersCount = computed(() => {
  let count = 0;
  if (roleFilterActive.value) count++;
  if (dateFilterActive.value) count++;
  if (statusFilterActive.value) count++;
  return count;
});

const modalSelectedDatesSize = computed(
  () => modalSelectedDates.value.size
);
const modalStatusDisabled = computed(
  () => availableDates.value.length > 0 && modalSelectedDates.value.size === 0
);

function shortDateLabel(dateStr) {
  const d = new Date(dateStr);
  const text = d.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
  return text.replace('.', '').replace(',', '');
}
function longDateLabel(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
  });
}

function nameOf(u) {
  return [u.last_name, u.first_name, u.patronymic].filter(Boolean).join(' ');
}
function initialLetter(value) {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase();
}
function initialWithDot(value) {
  const letter = initialLetter(value);
  return letter ? `${letter}.` : '';
}
function surnameWithInitials(u) {
  const last = u.last_name || '';
  const initials = [initialWithDot(u.first_name), initialWithDot(u.patronymic)]
    .filter(Boolean)
    .join(' ');
  const formatted = [last, initials].filter(Boolean).join(' ');
  return formatted || nameOf(u) || '—';
}

function statusIcon(cell) {
  if (!cell?.preset) return 'bi-question-circle-fill text-muted';
  const s = cell?.status || 'FREE';
  if (s === 'FREE') return 'bi-check-circle-fill text-success';
  if (s === 'PARTIAL') return 'bi-clock-fill text-warning';
  return 'bi-slash-circle-fill text-secondary';
}
function statusTitle(cell) {
  if (!cell?.preset) return 'Не указано';
  const s = cell?.status || 'FREE';
  if (s === 'FREE') return 'Свободен';
  if (s === 'BUSY') return 'Занят';
  if (cell?.from_time) return `После ${formatHm(cell.from_time)}`;
  if (cell?.to_time) return `До ${formatHm(cell.to_time)}`;
  return 'Частично';
}

function formatHm(t) {
  if (!t) return '';
  const m = String(t).match(/^(\d{2}:\d{2})/);
  return m ? m[1] : String(t);
}

const hasData = computed(() => users.value.length > 0);

function orderedDatesFromSet(set) {
  if (!set?.size) return [];
  if (availableDates.value.length) {
    return availableDates.value.filter((d) => set.has(d));
  }
  return Array.from(set).sort();
}
function activeDateKeys() {
  return dates.value.length ? dates.value : availableDates.value;
}

function matchesAdvanced(u) {
  if (!statusFilterActive.value) return true;
  const keys = activeDateKeys();
  if (!keys.length) return true;

  for (const date of keys) {
    const c = u.availability?.[date];
    if (!c?.preset) continue;
    if (filterFree.value && c.status === 'FREE') return true;
    if (filterBusy.value && c.status === 'BUSY') return true;
    if (filterPartialEnabled.value && c.status === 'PARTIAL') {
      if (!filterPartialMode.value) return true;
      if (
        filterPartialMode.value === 'BEFORE' &&
        c.to_time &&
        (!filterPartialTime.value ||
          formatHm(c.to_time) === formatHm(filterPartialTime.value))
      ) {
        return true;
      }
      if (
        filterPartialMode.value === 'AFTER' &&
        c.from_time &&
        (!filterPartialTime.value ||
          formatHm(c.from_time) === formatHm(filterPartialTime.value))
      ) {
        return true;
      }
    }
  }
  return false;
}

const filteredUsers = computed(() => {
  const term = search.value.trim().toLowerCase();
  const roleSet = selectedRoles.value;
  let list = users.value;
  if (roleSet.size < roleOptions.length) {
    list = list.filter((u) => u.roles?.some((r) => roleSet.has(r)));
  }
  if (term) {
    list = list.filter((u) => nameOf(u).toLowerCase().includes(term));
  }
  return list.filter((u) => matchesAdvanced(u));
});

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredUsers.value.length / pageSize.value))
);
const pagedUsers = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filteredUsers.value.slice(start, start + pageSize.value);
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams();
    selectedRoles.value.forEach((r) => params.append('role', r));

    const selectedDateList = orderedDatesFromSet(selectedDates.value);
    const shouldSendDates =
      selectedDateList.length &&
      (!availableDates.value.length ||
        selectedDateList.length < availableDates.value.length);

    if (shouldSendDates) {
      selectedDateList.forEach((d) => params.append('date', d));
    }

    const res = await apiFetch(
      `/availabilities/admin-grid?${params.toString()}`
    );
    availableDates.value = res.availableDates || res.dates || [];
    const nextDates =
      res.dates && res.dates.length ? res.dates : availableDates.value;
    dates.value = nextDates;
    users.value = res.users || [];
    selectedDates.value = new Set(nextDates);
    page.value = 1;
  } catch (e) {
    error.value = e?.message || 'Не удалось загрузить данные';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
onMounted(() => {
  if (filtersModalRef.value) filtersModal = new Modal(filtersModalRef.value);
});

function prepareFilters() {
  modalSelectedRoles.value = new Set(selectedRoles.value);
  const baseDates =
    selectedDates.value.size > 0
      ? orderedDatesFromSet(selectedDates.value)
      : activeDateKeys();
  modalSelectedDates.value = new Set(baseDates);
  modalFilterFree.value = filterFree.value;
  modalFilterBusy.value = filterBusy.value;
  modalFilterPartialEnabled.value = filterPartialEnabled.value;
  modalFilterPartialMode.value = filterPartialMode.value;
  modalFilterPartialTime.value = filterPartialTime.value;
}
function toggleModalRole(val) {
  const next = new Set(modalSelectedRoles.value);
  if (next.has(val)) next.delete(val);
  else next.add(val);
  modalSelectedRoles.value = next;
}
function toggleModalDate(date) {
  const next = new Set(modalSelectedDates.value);
  if (next.has(date)) next.delete(date);
  else next.add(date);
  modalSelectedDates.value = next;
}
function selectAllModalDates() {
  modalSelectedDates.value = new Set(availableDates.value);
}
function clearModalDates() {
  modalSelectedDates.value = new Set();
  modalFilterFree.value = false;
  modalFilterBusy.value = false;
  modalFilterPartialEnabled.value = false;
  modalFilterPartialMode.value = '';
  modalFilterPartialTime.value = '';
}
function handleModalPartialToggle() {
  if (!modalFilterPartialEnabled.value) {
    modalFilterPartialMode.value = '';
    modalFilterPartialTime.value = '';
  }
}
function resetModalFilters() {
  modalSelectedRoles.value = new Set(roleOptions.map((r) => r.value));
  modalSelectedDates.value = new Set(availableDates.value);
  modalFilterFree.value = false;
  modalFilterBusy.value = false;
  modalFilterPartialEnabled.value = false;
  modalFilterPartialMode.value = '';
  modalFilterPartialTime.value = '';
}
function applyFilters() {
  selectedRoles.value = new Set(modalSelectedRoles.value);

  const ordered = orderedDatesFromSet(modalSelectedDates.value);
  selectedDates.value = new Set(
    ordered.length ? ordered : availableDates.value
  );

  filterFree.value = modalFilterFree.value;
  filterBusy.value = modalFilterBusy.value;
  filterPartialEnabled.value = modalFilterPartialEnabled.value;
  if (modalFilterPartialEnabled.value) {
    filterPartialMode.value = modalFilterPartialMode.value;
    filterPartialTime.value = modalFilterPartialTime.value;
  } else {
    filterPartialMode.value = '';
    filterPartialTime.value = '';
  }

  page.value = 1;
  load();
  filtersModal?.hide();
}

const filtersSummary = computed(() => {
  const items = [];
  if (roleFilterActive.value) {
    const labels = roleOptions
      .filter((opt) => selectedRoles.value.has(opt.value))
      .map((opt) => opt.label);
    if (labels.length) {
      items.push({ key: 'roles', text: `Роли: ${labels.join(', ')}` });
    }
  }
  if (dateFilterActive.value) {
    const ordered = orderedDatesFromSet(selectedDates.value);
    if (ordered.length) {
      const labels = ordered
        .slice(0, 3)
        .map((d) => shortDateLabel(d) || d);
      if (ordered.length > 3) {
        labels.push(`+${ordered.length - 3}`);
      }
      items.push({ key: 'dates', text: `Даты: ${labels.join(', ')}` });
    }
  }
  if (statusFilterActive.value) {
    const parts = [];
    if (filterFree.value) parts.push('Свободен');
    if (filterBusy.value) parts.push('Занят');
    if (filterPartialEnabled.value) {
      if (filterPartialMode.value === 'BEFORE') {
        const time = filterPartialTime.value
          ? formatHm(filterPartialTime.value)
          : '';
        parts.push(`Частично (до${time ? ` ${time}` : ''})`);
      } else if (filterPartialMode.value === 'AFTER') {
        const time = filterPartialTime.value
          ? formatHm(filterPartialTime.value)
          : '';
        parts.push(`Частично (после${time ? ` ${time}` : ''})`);
      } else {
        parts.push('Частично');
      }
    }
    if (parts.length) {
      items.push({ key: 'status', text: `Статусы: ${parts.join(', ')}` });
    }
  }
  return items;
});
</script>

<template>
  <div class="py-4">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">
            Занятость судей
          </li>
        </ol>
      </nav>
      <h1 class="mb-3">Занятость судей</h1>

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

      <div v-else class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <div class="toolbar mb-3 d-flex align-items-center gap-2">
            <div
              class="input-group input-group-sm flex-grow-1"
              style="min-width: 16rem"
            >
              <span id="search-addon" class="input-group-text"
                ><i class="bi bi-search" aria-hidden="true"></i
              ></span>
              <input
                v-model.trim="search"
                type="search"
                class="form-control"
                placeholder="Поиск по ФИО"
                aria-label="Поиск по ФИО"
                aria-describedby="search-addon"
              />
              <button
                type="button"
                class="btn btn-outline-secondary d-inline-flex align-items-center"
                data-bs-toggle="modal"
                data-bs-target="#filtersModal"
                :title="
                  activeFiltersCount
                    ? `Активные фильтры: ${activeFiltersCount}`
                    : 'Фильтры'
                "
                @click="prepareFilters"
              >
                <i class="bi bi-funnel me-1" aria-hidden="true"></i>
                <span>Фильтр</span>
                <span
                  v-if="activeFiltersCount"
                  class="badge bg-secondary ms-2"
                  >{{ activeFiltersCount }}</span
                >
              </button>
            </div>
          </div>
          <div
            v-if="filtersSummary.length"
            class="filter-summary small text-muted mb-3 d-flex flex-wrap align-items-center gap-2"
          >
            <span class="text-muted">Фильтры:</span>
            <span
              v-for="item in filtersSummary"
              :key="item.key"
              class="badge rounded-pill bg-light text-secondary"
            >
              {{ item.text }}
            </span>
          </div>
          <div v-if="!hasData" class="text-muted">
            Нет данных для отображения.
          </div>

          <div v-else class="table-responsive">
            <table
              class="table table-striped align-middle admin-table auto-cols mb-0"
            >
              <thead>
                <tr>
                  <th class="sticky-col">Судья</th>
                  <th
                    v-for="d in dates"
                    :key="d"
                    class="text-center"
                    :title="longDateLabel(d)"
                    :aria-label="longDateLabel(d)"
                  >
                    {{ shortDateLabel(d) }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in pagedUsers" :key="u.id">
                  <td
                    class="fio-col sticky-col"
                    :title="nameOf(u)"
                    :aria-label="nameOf(u)"
                  >
                    <span class="fio-full">{{ nameOf(u) }}</span>
                    <span class="fio-short" aria-hidden="true">
                      {{ surnameWithInitials(u) }}
                    </span>
                  </td>
                  <td
                    v-for="d in dates"
                    :key="u.id + '-' + d"
                    class="text-center"
                    :class="{
                      'bg-warning-subtle partial-cell':
                        u.availability[d]?.preset &&
                        u.availability[d]?.status === 'PARTIAL',
                      'bg-success-subtle':
                        u.availability[d]?.preset &&
                        u.availability[d]?.status === 'FREE',
                      'bg-danger-subtle':
                        u.availability[d]?.preset &&
                        u.availability[d]?.status === 'BUSY',
                    }"
                  >
                    <template
                      v-if="
                        u.availability[d]?.preset &&
                        u.availability[d]?.status === 'PARTIAL'
                      "
                    >
                      <span class="partial-text text-muted">
                        {{
                          u.availability[d]?.to_time
                            ? 'до ' + formatHm(u.availability[d].to_time)
                            : 'после ' + formatHm(u.availability[d]?.from_time)
                        }}
                      </span>
                    </template>
                    <template v-else>
                      <i
                        :class="'bi ' + statusIcon(u.availability[d])"
                        :title="statusTitle(u.availability[d])"
                        aria-hidden="true"
                      ></i>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <PageNav
        v-if="totalPages > 1"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total-pages="totalPages"
        :sizes="[10, 25, 50, 100]"
      />
    </div>
  </div>

  <!-- Filters Modal -->
  <div
    id="filtersModal"
    ref="filtersModalRef"
    class="modal fade"
    tabindex="-1"
    aria-hidden="true"
  >
    <div class="modal-dialog">
      <div class="modal-content">
        <form @submit.prevent="applyFilters">
          <div class="modal-header">
            <h5 class="modal-title">Фильтры</h5>
            <button
              type="button"
              class="btn-close"
              data-bs-dismiss="modal"
              aria-label="Закрыть"
            ></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Роли</label>
              <div class="d-flex flex-wrap gap-3 align-items-center">
                <div
                  v-for="opt in roleOptions"
                  :key="opt.value"
                  class="form-check"
                >
                  <input
                    :id="'modal-role-' + opt.value"
                    class="form-check-input brand-check"
                    type="checkbox"
                    :checked="modalSelectedRoles.has(opt.value)"
                    @change="toggleModalRole(opt.value)"
                  />
                  <label
                    class="form-check-label"
                    :for="'modal-role-' + opt.value"
                    >{{ opt.label }}</label
                  >
                </div>
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">Даты</label>
              <div class="date-pills" role="group" aria-label="Выбор дат">
                <button
                  v-for="d in availableDates"
                  :key="d"
                  type="button"
                  class="date-pill"
                  :class="{ 'is-selected': modalSelectedDates.has(d) }"
                  :aria-pressed="modalSelectedDates.has(d)"
                  :aria-label="longDateLabel(d)"
                  :title="longDateLabel(d)"
                  @click="toggleModalDate(d)"
                >
                  <span class="date-pill-main">{{ shortDateLabel(d) }}</span>
                  <span class="date-pill-sub">{{ longDateLabel(d) }}</span>
                </button>
              </div>
              <div class="d-flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  :disabled="
                    !availableDates.length ||
                    modalSelectedDatesSize === availableDates.length
                  "
                  @click="selectAllModalDates"
                >
                  Выбрать все
                </button>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  :disabled="!modalSelectedDatesSize"
                  @click="clearModalDates"
                >
                  Очистить
                </button>
              </div>
              <div class="form-text">
                <template v-if="availableDates.length">
                  Выбрано: {{ modalSelectedDatesSize }} из
                  {{ availableDates.length }}. Статусы применяются к отмеченным
                  датам.
                </template>
                <template v-else>
                  Нет доступных дат для фильтрации.
                </template>
              </div>
            </div>
            <div class="mb-0">
              <label class="form-label">Статусы (мультивыбор)</label>
              <div class="row g-2">
                <div class="col-12 col-sm-4">
                  <div class="form-check">
                    <input
                      id="st-free"
                      v-model="modalFilterFree"
                      class="form-check-input"
                      type="checkbox"
                      :disabled="modalStatusDisabled"
                      :title="modalStatusDisabled ? 'Выберите даты' : ''"
                    />
                    <label for="st-free" class="form-check-label"
                      >Свободен</label
                    >
                  </div>
                  <div class="form-check">
                    <input
                      id="st-busy"
                      v-model="modalFilterBusy"
                      class="form-check-input"
                      type="checkbox"
                      :disabled="modalStatusDisabled"
                      :title="modalStatusDisabled ? 'Выберите даты' : ''"
                    />
                    <label for="st-busy" class="form-check-label">Занят</label>
                  </div>
                </div>
                <div class="col-12 col-sm-8">
                  <div class="form-check mb-2">
                    <input
                      id="st-partial"
                      v-model="modalFilterPartialEnabled"
                      class="form-check-input"
                      type="checkbox"
                      :disabled="modalStatusDisabled"
                      :title="modalStatusDisabled ? 'Выберите даты' : ''"
                      @change="handleModalPartialToggle"
                    />
                    <label for="st-partial" class="form-check-label"
                      >Частично свободен</label
                    >
                  </div>
                  <div
                    v-if="modalFilterPartialEnabled && !modalStatusDisabled"
                    class="partial-options d-flex align-items-center gap-2 ms-4"
                  >
                    <div
                      class="btn-group btn-group-sm"
                      role="group"
                      aria-label="Режим частичной доступности"
                    >
                      <input
                        id="pm-before"
                        v-model="modalFilterPartialMode"
                        type="radio"
                        class="btn-check"
                        value="BEFORE"
                        :disabled="
                          !modalFilterPartialEnabled || modalStatusDisabled
                        "
                      />
                      <label class="btn btn-outline-secondary" for="pm-before"
                        >До</label
                      >
                      <input
                        id="pm-after"
                        v-model="modalFilterPartialMode"
                        type="radio"
                        class="btn-check"
                        value="AFTER"
                        :disabled="
                          !modalFilterPartialEnabled || modalStatusDisabled
                        "
                      />
                      <label class="btn btn-outline-secondary" for="pm-after"
                        >После</label
                      >
                    </div>
                    <div
                      class="input-group input-group-sm"
                      style="max-width: 12rem"
                    >
                      <span class="input-group-text"
                        ><i class="bi bi-clock" aria-hidden="true"></i
                      ></span>
                      <input
                        v-model="modalFilterPartialTime"
                        type="time"
                        step="300"
                        class="form-control"
                        :disabled="
                          !modalFilterPartialEnabled || modalStatusDisabled
                        "
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-outline-secondary"
              @click="resetModalFilters"
            >
              Сбросить
            </button>
            <button
              type="submit"
              class="btn btn-brand"
              :disabled="modalStatusDisabled"
            >
              Применить
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table thead th {
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
}
.table td,
.table th {
  vertical-align: middle;
}
.sticky-col {
  position: sticky;
  left: 0;
  background: #fff;
  z-index: 2;
  border-right: 2px solid var(--border-subtle);
  min-width: 15rem;
}
.partial-cell {
  /* keep subtle highlight without overpowering */
  /* bg-warning-subtle is applied via class; this ensures consistent padding/line-height */
}
.partial-text {
  font-size: 0.75rem; /* smaller than .small to avoid wrapping */
  line-height: 1.1;
}
.fio-col {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}
.fio-full {
  display: inline;
}
.fio-short {
  display: none;
}
.filter-summary .badge {
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.35rem 0.6rem;
}
.date-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.date-pill {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  border-radius: 999px;
  padding: 0.4rem 1rem;
  line-height: 1.2;
  font-size: 0.85rem;
  font-weight: 500;
  border: 1px solid var(--border-subtle, rgba(15, 23, 42, 0.12));
  background: var(--surface-subtle, #f8f9fb);
  color: var(--bs-gray-700, #495057);
  cursor: pointer;
  transition: all 0.15s ease;
  min-width: 6.5rem;
}
.date-pill .date-pill-main {
  font-weight: 600;
}
.date-pill .date-pill-sub {
  font-size: 0.75rem;
  color: var(--bs-gray-600, #6c757d);
}
.date-pill:hover {
  transform: translateY(-1px);
  border-color: var(--brand-primary, var(--bs-primary));
  color: var(--brand-primary, var(--bs-primary));
  background: var(--surface-elevated, #ffffff);
}
.date-pill:focus-visible {
  outline: 3px solid rgba(15, 23, 42, 0.3);
  outline-offset: 2px;
}
.date-pill.is-selected {
  background: var(--brand-primary, var(--bs-primary));
  border-color: var(--brand-primary, var(--bs-primary));
  color: #fff;
  box-shadow: 0 0.5rem 1.25rem rgba(15, 23, 42, 0.18);
}
.date-pill.is-selected .date-pill-sub {
  color: rgba(255, 255, 255, 0.85);
}
/* Keep the toolbar compact and aligned */
.toolbar .input-group > .btn {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
@media (max-width: 767.98px) {
  .fio-full {
    display: none;
  }
  .fio-short {
    display: inline;
  }
  .sticky-col {
    min-width: 11.5rem;
  }
}
@media (max-width: 479.98px) {
  .date-pill {
    flex: 1 1 calc(50% - 0.5rem);
    min-width: auto;
    text-align: left;
  }
  .sticky-col {
    min-width: 6.75rem !important;
  }
}
/* Keep selector and time on one line on small screens */
@media (max-width: 575.98px) {
  .partial-options {
    flex-wrap: nowrap !important;
    width: 100%;
  }
  .partial-options .btn-group {
    flex: 0 0 auto;
  }
  .partial-options .input-group {
    flex: 1 1 auto;
    min-width: 8rem;
  }
  .sticky-col {
    min-width: 9rem;
  }
}
/* Small screens: tighten paddings a bit */
@media (max-width: 575.98px) {
  .table thead th,
  .table tbody td {
    padding: 0.5rem 0.4rem;
  }
}
</style>
