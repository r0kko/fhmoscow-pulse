<script setup>
import { ref, onMounted, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import PageNav from '../components/PageNav.vue';
import Modal from 'bootstrap/js/dist/modal';

const loading = ref(true);
const error = ref('');
const dates = ref([]);
const users = ref([]);
const search = ref('');
const roleOptions = [
  { value: 'REFEREE', label: 'Судья в поле' },
  { value: 'BRIGADE_REFEREE', label: 'Судья в бригаде' },
];
const selectedRoles = ref(new Set(roleOptions.map((r) => r.value)));
const page = ref(1);
const pageSize = ref(25);
// Advanced filters state
const filterDate = ref(''); // YYYY-MM-DD
const filterFree = ref(false);
const filterBusy = ref(false);
const filterPartialEnabled = ref(false);
const filterPartialMode = ref(''); // 'BEFORE' | 'AFTER' | ''
const filterPartialTime = ref(''); // HH:MM
// Filters modal state
const filtersModalRef = ref(null);
let filtersModal = null;
const modalSelectedRoles = ref(new Set());
const modalFilterDate = ref('');
const modalFilterFree = ref(false);
const modalFilterBusy = ref(false);
const modalFilterPartialEnabled = ref(false);
const modalFilterPartialMode = ref('');
const modalFilterPartialTime = ref('');

const activeFiltersCount = computed(() => {
  let count = 0;
  // roles different from default (both selected)
  if (selectedRoles.value.size !== roleOptions.length) count++;
  if (filterDate.value) count++;
  if (filterFree.value || filterBusy.value || filterPartialEnabled.value)
    count++;
  return count;
});

// Modal-only helpers
const isModalDateSelected = computed(() => !!modalFilterDate.value);

function shortDateLabel(dateStr) {
  const d = new Date(dateStr);
  const text = d.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
  return text.replace('.', '').replace(',', '');
}

function nameOf(u) {
  return [u.last_name, u.first_name, u.patronymic].filter(Boolean).join(' ');
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
  // Expect formats HH:MM or HH:MM:SS — return HH:MM
  const m = String(t).match(/^(\d{2}:\d{2})/);
  return m ? m[1] : String(t);
}

const hasData = computed(() => users.value.length > 0);

function matchesAdvanced(u) {
  const date = filterDate.value;
  const anyStatus =
    filterFree.value || filterBusy.value || filterPartialEnabled.value;
  if (!date || !anyStatus) return true;
  const c = u.availability?.[date];
  if (!c?.preset) return false;
  if (filterFree.value && c.status === 'FREE') return true;
  if (filterBusy.value && c.status === 'BUSY') return true;
  if (filterPartialEnabled.value && c.status === 'PARTIAL') {
    if (!filterPartialMode.value) return true;
    if (filterPartialMode.value === 'BEFORE') {
      if (!c.to_time) return false;
      return filterPartialTime.value
        ? formatHm(c.to_time) === formatHm(filterPartialTime.value)
        : true;
    }
    if (filterPartialMode.value === 'AFTER') {
      if (!c.from_time) return false;
      return filterPartialTime.value
        ? formatHm(c.from_time) === formatHm(filterPartialTime.value)
        : true;
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
  list = list.filter((u) => matchesAdvanced(u));
  return list;
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
    const res = await apiFetch(
      `/availabilities/admin-grid?${params.toString()}`
    );
    dates.value = res.dates || [];
    users.value = res.users || [];
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
  modalFilterDate.value = filterDate.value;
  modalFilterFree.value = filterFree.value;
  modalFilterBusy.value = filterBusy.value;
  modalFilterPartialEnabled.value = filterPartialEnabled.value;
  modalFilterPartialMode.value = filterPartialMode.value;
  modalFilterPartialTime.value = filterPartialTime.value;
}
function toggleModalRole(val) {
  const set = modalSelectedRoles.value;
  if (set.has(val)) set.delete(val);
  else set.add(val);
}
function resetModalFilters() {
  modalSelectedRoles.value = new Set(roleOptions.map((r) => r.value));
  modalFilterDate.value = '';
  modalFilterFree.value = false;
  modalFilterBusy.value = false;
  modalFilterPartialEnabled.value = false;
  modalFilterPartialMode.value = '';
  modalFilterPartialTime.value = '';
}
function applyFilters() {
  selectedRoles.value = new Set(modalSelectedRoles.value);
  filterDate.value = modalFilterDate.value;
  filterFree.value = modalFilterFree.value;
  filterBusy.value = modalFilterBusy.value;
  filterPartialEnabled.value = modalFilterPartialEnabled.value;
  filterPartialMode.value = modalFilterPartialMode.value;
  filterPartialTime.value = modalFilterPartialTime.value;
  page.value = 1;
  load();
  filtersModal?.hide();
}
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
          <div v-if="!hasData" class="text-muted">
            Нет данных для отображения.
          </div>

          <div v-else class="table-responsive">
            <table
              class="table table-striped align-middle admin-table auto-cols mb-0"
            >
              <thead>
                <tr>
                  <th class="sticky-col" style="min-width: 16rem">Судья</th>
                  <th v-for="d in dates" :key="d" class="text-center">
                    {{ shortDateLabel(d) }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in pagedUsers" :key="u.id">
                  <td class="fio-col sticky-col">
                    {{ nameOf(u) }}
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
              <label for="filter-date" class="form-label">Дата</label>
              <div class="input-group">
                <input
                  id="filter-date"
                  v-model="modalFilterDate"
                  type="date"
                  class="form-control"
                />
                <button
                  class="btn btn-outline-secondary"
                  type="button"
                  :disabled="!modalFilterDate"
                  title="Очистить дату"
                  @click="modalFilterDate = ''"
                >
                  <i class="bi bi-x-lg" aria-hidden="true"></i>
                </button>
              </div>
              <div class="form-text">
                Для фильтрации по статусу выберите дату.
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
                      :disabled="!isModalDateSelected"
                      :title="!isModalDateSelected ? 'Выберите дату' : ''"
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
                      :disabled="!isModalDateSelected"
                      :title="!isModalDateSelected ? 'Выберите дату' : ''"
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
                      :disabled="!isModalDateSelected"
                      :title="!isModalDateSelected ? 'Выберите дату' : ''"
                    />
                    <label for="st-partial" class="form-check-label"
                      >Частично свободен</label
                    >
                  </div>
                  <div
                    v-if="modalFilterPartialEnabled"
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
            <button type="submit" class="btn btn-brand">Применить</button>
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
  box-shadow: 2px 0 0 rgba(0, 0, 0, 0.05);
}
.partial-cell {
  /* keep subtle highlight without overpowering */
  /* bg-warning-subtle is applied via class; this ensures consistent padding/line-height */
}
.partial-text {
  font-size: 0.75rem; /* smaller than .small to avoid wrapping */
  line-height: 1.1;
}
/* Keep the toolbar compact and aligned */
.toolbar .input-group > .btn {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
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
}
/* Small screens: tighten paddings a bit */
@media (max-width: 575.98px) {
  .table thead th,
  .table tbody td {
    padding: 0.5rem 0.4rem;
  }
}
</style>
