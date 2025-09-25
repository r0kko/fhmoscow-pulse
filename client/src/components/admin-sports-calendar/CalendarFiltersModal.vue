<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import TabSelector from '../TabSelector.vue';
import type {
  CalendarFilterDraft,
  StatusFilterScope,
  StatusOption,
  TabItem,
} from './types';

const props = defineProps<{
  statusOptions: ReadonlyArray<StatusOption>;
  timeScopeTabs: TabItem[];
  dayWindowOptions: number[];
  defaultDayWindow: number;
  rangeSummary: string;
  formatDaysLabel: (value: number) => string;
  homeClubOptions: string[];
  awayClubOptions: string[];
  tournamentOptions: string[];
  groupOptionsModal: string[];
  stadiumOptions: string[];
  getStatusCount: (scope: StatusFilterScope) => number;
}>();

const draft = defineModel<CalendarFilterDraft>('draft', { required: true });

const emit = defineEmits<{
  toggleStatus: [StatusFilterScope];
  shiftAnchor: [number];
  resetAnchor: [];
  selectDayWindow: [number];
  addHome: [];
  removeHome: [string];
  addAway: [];
  removeAway: [string];
  addTournament: [];
  removeTournament: [string];
  addGroup: [];
  removeGroup: [string];
  addStadium: [];
  removeStadium: [string];
  resetFilters: [];
  clearDraft: [];
  apply: [];
}>();

const modalRef = ref<HTMLElement | null>(null);
let modalInstance: Modal | null = null;

function ensureModal(): void {
  if (!modalRef.value) return;
  if (modalInstance) return;
  modalInstance = new Modal(modalRef.value, { backdrop: true, focus: true });
}

function show(): void {
  ensureModal();
  modalInstance?.show();
}

function hide(): void {
  if (!modalInstance) return;
  modalInstance.hide();
}

onBeforeUnmount(() => {
  modalInstance?.dispose();
  modalInstance = null;
});

function handleShiftAnchor(multiplier: number): void {
  const delta =
    multiplier * (draft.value.dayWindow || props.defaultDayWindow || 0);
  emit('shiftAnchor', delta);
}

function handleResetAnchor(): void {
  emit('resetAnchor');
}

defineExpose({ show, hide });
</script>

<template>
  <div
    ref="modalRef"
    class="modal fade"
    tabindex="-1"
    aria-labelledby="filtersModalLabel"
    aria-hidden="true"
  >
    <div
      class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h2 id="filtersModalLabel" class="modal-title h5">Фильтры</h2>
          <button
            type="button"
            class="btn-close"
            aria-label="Закрыть"
            @click="hide"
          ></button>
        </div>
        <div class="modal-body">
          <div class="modal-filter-group">
            <span class="modal-filter-title">Статус согласования</span>
            <div class="status-pills">
              <button
                v-for="option in props.statusOptions"
                :key="option.value"
                type="button"
                class="status-pill"
                :class="{
                  'status-pill--active': draft.statusScope === option.value,
                  'status-pill--disabled':
                    option.value !== 'all' &&
                    !props.getStatusCount(option.value),
                }"
                :aria-pressed="draft.statusScope === option.value"
                :disabled="
                  option.value !== 'all' && !props.getStatusCount(option.value)
                "
                @click="emit('toggleStatus', option.value)"
              >
                <i :class="['bi', option.icon]" aria-hidden="true"></i>
                <span>{{ option.label }}</span>
                <span class="badge text-bg-light ms-2">
                  {{ props.getStatusCount(option.value) }}
                </span>
              </button>
            </div>
          </div>

          <div class="modal-filter-group">
            <span class="modal-filter-title">Период календаря</span>
            <TabSelector
              v-model="draft.timeScope"
              :tabs="props.timeScopeTabs"
              v-bind="{ ariaLabel: 'Период' }"
              :nav-fill="false"
              justify="start"
            />
          </div>

          <div class="modal-filter-group modal-grid">
            <div class="modal-grid-item">
              <span class="modal-filter-title">Опорная дата</span>
              <div class="anchor-row">
                <input
                  id="modal-anchor-date"
                  v-model="draft.anchorDate"
                  type="date"
                  class="form-control form-control-sm"
                />
                <div
                  class="btn-group btn-group-sm"
                  role="group"
                  aria-label="Сдвиг по диапазону"
                >
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    @click="handleShiftAnchor(-1)"
                  >
                    -{{
                      props.formatDaysLabel(
                        draft.dayWindow || props.defaultDayWindow
                      )
                    }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    @click="handleShiftAnchor(1)"
                  >
                    +{{
                      props.formatDaysLabel(
                        draft.dayWindow || props.defaultDayWindow
                      )
                    }}
                  </button>
                </div>
                <button
                  type="button"
                  class="btn btn-link btn-sm text-decoration-none px-0"
                  @click="handleResetAnchor"
                >
                  Сбросить
                </button>
              </div>
            </div>
            <div class="modal-grid-item">
              <span class="modal-filter-title">Диапазон, дни</span>
              <div
                class="btn-group btn-group-sm flex-wrap"
                role="group"
                aria-label="Диапазон, дни"
              >
                <button
                  v-for="option in props.dayWindowOptions"
                  :key="option"
                  type="button"
                  class="btn"
                  :class="
                    draft.dayWindow === option
                      ? 'btn-brand'
                      : 'btn-outline-secondary'
                  "
                  :aria-pressed="draft.dayWindow === option"
                  @click="emit('selectDayWindow', option)"
                >
                  {{ props.formatDaysLabel(option) }}
                </button>
              </div>
              <small v-if="props.rangeSummary" class="text-muted d-block mt-1"
                >Текущий диапазон: {{ props.rangeSummary }}</small
              >
            </div>
          </div>

          <div class="modal-filter-group">
            <span class="modal-filter-title">Структурные фильтры</span>
            <div class="row g-3">
              <div class="col-12 col-md-6">
                <label for="f-home" class="form-label small text-muted"
                  >Клуб хозяина</label
                >
                <div class="d-flex gap-2">
                  <select
                    id="f-home"
                    v-model="draft.homeCand"
                    class="form-select"
                  >
                    <option value="">Выберите клуб</option>
                    <option
                      v-for="club in props.homeClubOptions"
                      :key="club"
                      :value="club"
                    >
                      {{ club }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    :disabled="!draft.homeCand"
                    @click="emit('addHome')"
                  >
                    <i class="bi bi-plus-lg" aria-hidden="true"></i>
                  </button>
                </div>
                <div class="mt-2 d-flex flex-wrap gap-1">
                  <span
                    v-for="value in draft.homeClubs"
                    :key="`h-${value}`"
                    class="badge bg-light text-muted border"
                    role="button"
                    tabindex="0"
                    :aria-label="`Удалить фильтр Хозяин: ${value}`"
                    @click="emit('removeHome', value)"
                    @keydown.enter.prevent="emit('removeHome', value)"
                  >
                    {{ value }}
                    <i class="bi bi-x-lg ms-1" aria-hidden="true"></i>
                  </span>
                </div>
              </div>
              <div class="col-12 col-md-6">
                <label for="f-away" class="form-label small text-muted"
                  >Клуб гостя</label
                >
                <div class="d-flex gap-2">
                  <select
                    id="f-away"
                    v-model="draft.awayCand"
                    class="form-select"
                  >
                    <option value="">Выберите клуб</option>
                    <option
                      v-for="club in props.awayClubOptions"
                      :key="club"
                      :value="club"
                    >
                      {{ club }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    :disabled="!draft.awayCand"
                    @click="emit('addAway')"
                  >
                    <i class="bi bi-plus-lg" aria-hidden="true"></i>
                  </button>
                </div>
                <div class="mt-2 d-flex flex-wrap gap-1">
                  <span
                    v-for="value in draft.awayClubs"
                    :key="`a-${value}`"
                    class="badge bg-light text-muted border"
                    role="button"
                    tabindex="0"
                    :aria-label="`Удалить фильтр Гость: ${value}`"
                    @click="emit('removeAway', value)"
                    @keydown.enter.prevent="emit('removeAway', value)"
                  >
                    {{ value }}
                    <i class="bi bi-x-lg ms-1" aria-hidden="true"></i>
                  </span>
                </div>
              </div>
              <div class="col-12 col-md-4">
                <label for="f-tournament" class="form-label small text-muted"
                  >Соревнование</label
                >
                <div class="d-flex gap-2">
                  <select
                    id="f-tournament"
                    v-model="draft.tournamentCand"
                    class="form-select"
                  >
                    <option value="">Выберите соревнование</option>
                    <option
                      v-for="value in props.tournamentOptions"
                      :key="value"
                      :value="value"
                    >
                      {{ value }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    :disabled="!draft.tournamentCand"
                    @click="emit('addTournament')"
                  >
                    <i class="bi bi-plus-lg" aria-hidden="true"></i>
                  </button>
                </div>
                <div class="mt-2 d-flex flex-wrap gap-1">
                  <span
                    v-for="value in draft.tournaments"
                    :key="`t-${value}`"
                    class="badge bg-light text-muted border"
                    role="button"
                    tabindex="0"
                    :aria-label="`Удалить фильтр Соревнование: ${value}`"
                    @click="emit('removeTournament', value)"
                    @keydown.enter.prevent="emit('removeTournament', value)"
                  >
                    {{ value }}
                    <i class="bi bi-x-lg ms-1" aria-hidden="true"></i>
                  </span>
                </div>
              </div>
              <div class="col-12 col-md-4">
                <label for="f-group" class="form-label small text-muted"
                  >Группа</label
                >
                <div class="d-flex gap-2">
                  <select
                    id="f-group"
                    v-model="draft.groupCand"
                    class="form-select"
                  >
                    <option value="">Выберите группу</option>
                    <option
                      v-for="value in props.groupOptionsModal"
                      :key="value"
                      :value="value"
                    >
                      {{ value }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    :disabled="!draft.groupCand"
                    @click="emit('addGroup')"
                  >
                    <i class="bi bi-plus-lg" aria-hidden="true"></i>
                  </button>
                </div>
                <div class="mt-2 d-flex flex-wrap gap-1">
                  <span
                    v-for="value in draft.groups"
                    :key="`g-${value}`"
                    class="badge bg-light text-muted border"
                    role="button"
                    tabindex="0"
                    :aria-label="`Удалить фильтр Группа: ${value}`"
                    @click="emit('removeGroup', value)"
                    @keydown.enter.prevent="emit('removeGroup', value)"
                  >
                    {{ value }}
                    <i class="bi bi-x-lg ms-1" aria-hidden="true"></i>
                  </span>
                </div>
              </div>
              <div class="col-12 col-md-4">
                <label for="f-stadium" class="form-label small text-muted"
                  >Стадион</label
                >
                <div class="d-flex gap-2">
                  <select
                    id="f-stadium"
                    v-model="draft.stadiumCand"
                    class="form-select"
                  >
                    <option value="">Выберите стадион</option>
                    <option
                      v-for="value in props.stadiumOptions"
                      :key="value"
                      :value="value"
                    >
                      {{ value }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    :disabled="!draft.stadiumCand"
                    @click="emit('addStadium')"
                  >
                    <i class="bi bi-plus-lg" aria-hidden="true"></i>
                  </button>
                </div>
                <div class="mt-2 d-flex flex-wrap gap-1">
                  <span
                    v-for="value in draft.stadiums"
                    :key="`s-${value}`"
                    class="badge bg-light text-muted border"
                    role="button"
                    tabindex="0"
                    :aria-label="`Удалить фильтр Стадион: ${value}`"
                    @click="emit('removeStadium', value)"
                    @keydown.enter.prevent="emit('removeStadium', value)"
                  >
                    {{ value }}
                    <i class="bi bi-x-lg ms-1" aria-hidden="true"></i>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            @click="emit('resetFilters')"
          >
            Сбросить фильтры
          </button>
          <button
            type="button"
            class="btn btn-link text-decoration-none"
            @click="emit('clearDraft')"
          >
            Очистить форму
          </button>
          <button type="button" class="btn btn-brand" @click="emit('apply')">
            Применить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.modal-filter-group:last-child {
  margin-bottom: 0;
}

.modal-filter-title {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--bs-secondary-color);
}

.status-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  background: var(--bs-body-bg);
  font-size: 0.85rem;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.status-pill--active {
  border-color: var(--bs-primary);
  background: rgba(var(--bs-primary-rgb), 0.08);
  color: var(--bs-primary);
}

.status-pill--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status-pill .badge {
  font-size: 0.7rem;
}

.modal-grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.anchor-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.anchor-row input {
  min-width: 160px;
}

.anchor-row .btn-group {
  flex-wrap: nowrap;
}

@media (max-width: 767.98px) {
  .anchor-row {
    flex-direction: column;
    align-items: stretch;
  }
  .anchor-row .btn-group,
  .anchor-row .btn-link {
    width: 100%;
    text-align: left;
  }
  .modal-grid {
    grid-template-columns: 1fr;
  }
}
</style>
