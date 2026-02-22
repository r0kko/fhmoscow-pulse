<script setup lang="ts">
import PageNav from './PageNav.vue';

type RefereeAvailabilityCell = {
  status?: string;
  preset?: boolean;
  from_time?: string | null;
  to_time?: string | null;
  partial_mode?: string | null;
};

type RefereeAvailabilityUser = {
  id: string;
  first_name?: string;
  last_name?: string;
  patronymic?: string;
  availability?: Record<string, RefereeAvailabilityCell>;
};

interface FiltersSummaryItem {
  key: string;
  text: string;
}

const props = defineProps<{
  loading: boolean;
  search: string;
  activeFiltersCount: number;
  filtersSummary: FiltersSummaryItem[];
  hasData: boolean;
  dates: string[];
  pagedUsers: RefereeAvailabilityUser[];
  page: number;
  pageSize: number;
  totalPages: number;
  nameOf: (u: RefereeAvailabilityUser) => string;
  surnameWithInitials: (u: RefereeAvailabilityUser) => string;
  shortDateLabel: (date: string) => string;
  longDateLabel: (date: string) => string;
  statusIcon: (cell?: RefereeAvailabilityCell | null) => string;
  statusTitle: (cell?: RefereeAvailabilityCell | null) => string;
  partialLabel: (
    cell?: RefereeAvailabilityCell | null,
    opts?: { capitalize?: boolean }
  ) => string;
}>();

const emit = defineEmits<{
  'update:search': [value: string];
  openFilters: [];
  openEditor: [];
  editUser: [user: RefereeAvailabilityUser];
  'update:page': [value: number];
  'update:pageSize': [value: number];
}>();

function handleSearchInput(event: Event) {
  const target = event.target as HTMLInputElement | null;
  emit('update:search', target?.value || '');
}

function handlePageUpdate(nextPage: number) {
  emit('update:page', nextPage);
}

function handlePageSizeUpdate(nextPageSize: number) {
  emit('update:pageSize', nextPageSize);
}
</script>

<template>
  <div class="card section-card tile fade-in shadow-sm">
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
            :value="search"
            type="search"
            class="form-control"
            placeholder="Поиск по ФИО"
            aria-label="Поиск по ФИО"
            aria-describedby="search-addon"
            @input="handleSearchInput"
          />
          <button
            type="button"
            class="btn btn-outline-secondary d-inline-flex align-items-center"
            :title="
              activeFiltersCount
                ? `Активные фильтры: ${activeFiltersCount}`
                : 'Фильтры'
            "
            @click="emit('openFilters')"
          >
            <i class="bi bi-funnel me-1" aria-hidden="true"></i>
            <span>Фильтр</span>
            <span v-if="activeFiltersCount" class="badge bg-secondary ms-2">{{
              activeFiltersCount
            }}</span>
          </button>
        </div>
        <div class="ms-auto d-flex gap-2 flex-wrap justify-content-end">
          <div
            v-if="loading"
            class="small text-muted d-inline-flex align-items-center"
            aria-live="polite"
          >
            <span
              class="spinner-border spinner-border-sm me-2"
              role="status"
              aria-hidden="true"
            ></span>
            Обновление...
          </div>
          <button
            type="button"
            class="btn btn-brand btn-sm d-inline-flex align-items-center"
            @click="emit('openEditor')"
          >
            <i class="bi bi-pencil-square me-1" aria-hidden="true"></i>
            <span>Управление занятостью</span>
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
      <div v-if="!hasData" class="text-muted">Нет данных для отображения.</div>

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
                <div class="fio-wrapper">
                  <div class="fio-name">
                    <span class="fio-full">{{ nameOf(u) }}</span>
                    <span class="fio-short">{{ surnameWithInitials(u) }}</span>
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm"
                    :title="'Редактировать занятость: ' + nameOf(u)"
                    @click.stop="emit('editUser', u)"
                  >
                    <i class="bi bi-pencil" aria-hidden="true"></i>
                    <span class="visually-hidden">Редактировать</span>
                  </button>
                </div>
              </td>
              <td
                v-for="d in dates"
                :key="u.id + '-' + d"
                class="text-center"
                :class="{
                  'bg-warning-subtle partial-cell':
                    u.availability?.[d]?.preset &&
                    u.availability?.[d]?.status === 'PARTIAL',
                  'bg-success-subtle':
                    u.availability?.[d]?.preset &&
                    u.availability?.[d]?.status === 'FREE',
                  'bg-danger-subtle':
                    u.availability?.[d]?.preset &&
                    u.availability?.[d]?.status === 'BUSY',
                }"
              >
                <template
                  v-if="
                    u.availability?.[d]?.preset &&
                    u.availability?.[d]?.status === 'PARTIAL'
                  "
                >
                  <span class="partial-text text-muted">
                    {{
                      partialLabel(u.availability?.[d], { capitalize: false })
                    }}
                  </span>
                </template>
                <template v-else>
                  <i
                    :class="'bi ' + statusIcon(u.availability?.[d])"
                    :title="statusTitle(u.availability?.[d])"
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
    :page="page"
    :page-size="pageSize"
    :total-pages="totalPages"
    :sizes="[10, 25, 50, 100]"
    @update:page="handlePageUpdate"
    @update:page-size="handlePageSizeUpdate"
  />
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
.partial-text {
  font-size: 0.75rem;
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
.fio-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
}
.fio-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.btn-ghost {
  border: 0;
  background: transparent;
  color: var(--bs-gray-500, #6c757d);
  padding: 0.15rem 0.35rem;
  line-height: 1;
}
.btn-ghost:hover,
.btn-ghost:focus-visible {
  color: var(--brand-primary, var(--bs-primary));
}
.filter-summary .badge {
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.35rem 0.6rem;
}
.toolbar {
  flex-wrap: wrap;
}
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
@media (max-width: 575.98px) {
  .sticky-col {
    min-width: 9rem;
  }
  .table thead th,
  .table tbody td {
    padding: 0.5rem 0.4rem;
  }
}
@media (max-width: 479.98px) {
  .sticky-col {
    min-width: 6.75rem !important;
  }
}
</style>
