<script setup lang="ts">
interface RoleOption {
  value: string;
  label: string;
}

const props = defineProps<{
  modalId?: string;
  roleOptions: RoleOption[];
  availableDates: string[];
  modalSelectedRoles: Set<string>;
  modalSelectedDates: Set<string>;
  modalSelectedDatesSize: number;
  modalStatusDisabled: boolean;
  modalRoleSelectionValid: boolean;
  modalFilterFree: boolean;
  modalFilterBusy: boolean;
  modalFilterPartialEnabled: boolean;
  modalFilterPartialMode: string;
  modalFilterPartialTime: string;
  shortDateLabel: (date: string) => string;
  longDateLabel: (date: string) => string;
}>();

const emit = defineEmits<{
  toggleRole: [value: string];
  toggleDate: [value: string];
  selectAllDates: [];
  clearDates: [];
  close: [];
  partialToggle: [];
  reset: [];
  apply: [];
  'update:modalFilterFree': [value: boolean];
  'update:modalFilterBusy': [value: boolean];
  'update:modalFilterPartialEnabled': [value: boolean];
  'update:modalFilterPartialMode': [value: string];
  'update:modalFilterPartialTime': [value: string];
}>();

const modalId = props.modalId || 'filtersModal';

function extractChecked(event: Event) {
  const target = event.target as HTMLInputElement | null;
  return !!target?.checked;
}

function extractValue(event: Event) {
  const target = event.target as HTMLInputElement | null;
  return target?.value || '';
}

function onModalFilterFreeChange(event: Event) {
  emit('update:modalFilterFree', extractChecked(event));
}

function onModalFilterBusyChange(event: Event) {
  emit('update:modalFilterBusy', extractChecked(event));
}

function onModalFilterPartialEnabledChange(event: Event) {
  emit('update:modalFilterPartialEnabled', extractChecked(event));
  emit('partialToggle');
}

function onModalFilterPartialModeChange(event: Event) {
  emit('update:modalFilterPartialMode', extractValue(event));
}

function onModalFilterPartialTimeInput(event: Event) {
  emit('update:modalFilterPartialTime', extractValue(event));
}
</script>

<template>
  <div :id="modalId" class="modal fade" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog">
      <div class="modal-content">
        <form @submit.prevent="emit('apply')">
          <div class="modal-header">
            <h5 class="modal-title">Фильтры</h5>
            <button
              type="button"
              class="btn-close"
              aria-label="Закрыть"
              @click="emit('close')"
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
                    @change="emit('toggleRole', opt.value)"
                  />
                  <label
                    class="form-check-label"
                    :for="'modal-role-' + opt.value"
                  >
                    {{ opt.label }}
                  </label>
                </div>
              </div>
              <div
                v-if="!modalRoleSelectionValid"
                class="text-danger small mt-2"
              >
                Выберите хотя бы одну роль.
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
                  @click="emit('toggleDate', d)"
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
                  @click="emit('selectAllDates')"
                >
                  Выбрать все
                </button>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  :disabled="!modalSelectedDatesSize"
                  @click="emit('clearDates')"
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
                <template v-else>Нет доступных дат для фильтрации.</template>
              </div>
            </div>
            <div class="mb-0">
              <label class="form-label">Статусы (мультивыбор)</label>
              <div class="row g-2">
                <div class="col-12 col-sm-4">
                  <div class="form-check">
                    <input
                      id="st-free"
                      class="form-check-input"
                      type="checkbox"
                      :checked="modalFilterFree"
                      :disabled="modalStatusDisabled"
                      :title="modalStatusDisabled ? 'Выберите даты' : ''"
                      @change="onModalFilterFreeChange"
                    />
                    <label for="st-free" class="form-check-label"
                      >Свободен</label
                    >
                  </div>
                  <div class="form-check">
                    <input
                      id="st-busy"
                      class="form-check-input"
                      type="checkbox"
                      :checked="modalFilterBusy"
                      :disabled="modalStatusDisabled"
                      :title="modalStatusDisabled ? 'Выберите даты' : ''"
                      @change="onModalFilterBusyChange"
                    />
                    <label for="st-busy" class="form-check-label">Занят</label>
                  </div>
                </div>
                <div class="col-12 col-sm-8">
                  <div class="form-check mb-2">
                    <input
                      id="st-partial"
                      class="form-check-input"
                      type="checkbox"
                      :checked="modalFilterPartialEnabled"
                      :disabled="modalStatusDisabled"
                      :title="modalStatusDisabled ? 'Выберите даты' : ''"
                      @change="onModalFilterPartialEnabledChange"
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
                        type="radio"
                        class="btn-check"
                        value="BEFORE"
                        :checked="modalFilterPartialMode === 'BEFORE'"
                        :disabled="
                          !modalFilterPartialEnabled || modalStatusDisabled
                        "
                        @change="onModalFilterPartialModeChange"
                      />
                      <label class="btn btn-outline-secondary" for="pm-before"
                        >До</label
                      >
                      <input
                        id="pm-after"
                        type="radio"
                        class="btn-check"
                        value="AFTER"
                        :checked="modalFilterPartialMode === 'AFTER'"
                        :disabled="
                          !modalFilterPartialEnabled || modalStatusDisabled
                        "
                        @change="onModalFilterPartialModeChange"
                      />
                      <label class="btn btn-outline-secondary" for="pm-after"
                        >После</label
                      >
                      <input
                        id="pm-window"
                        type="radio"
                        class="btn-check"
                        value="WINDOW"
                        :checked="modalFilterPartialMode === 'WINDOW'"
                        :disabled="
                          !modalFilterPartialEnabled || modalStatusDisabled
                        "
                        @change="onModalFilterPartialModeChange"
                      />
                      <label class="btn btn-outline-secondary" for="pm-window"
                        >С—по</label
                      >
                      <input
                        id="pm-split"
                        type="radio"
                        class="btn-check"
                        value="SPLIT"
                        :checked="modalFilterPartialMode === 'SPLIT'"
                        :disabled="
                          !modalFilterPartialEnabled || modalStatusDisabled
                        "
                        @change="onModalFilterPartialModeChange"
                      />
                      <label class="btn btn-outline-secondary" for="pm-split"
                        >До и после</label
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
                        :value="modalFilterPartialTime"
                        type="time"
                        step="300"
                        class="form-control"
                        :disabled="
                          !modalFilterPartialEnabled || modalStatusDisabled
                        "
                        @input="onModalFilterPartialTimeInput"
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
              @click="emit('reset')"
            >
              Сбросить
            </button>
            <button
              type="submit"
              class="btn btn-brand"
              :disabled="modalStatusDisabled || !modalRoleSelectionValid"
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
@media (max-width: 479.98px) {
  .date-pill {
    flex: 1 1 calc(50% - 0.5rem);
    min-width: auto;
    text-align: left;
  }
}
</style>
