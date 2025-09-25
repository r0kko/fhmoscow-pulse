<script setup lang="ts">
import { computed } from 'vue';
import type { CalendarFilterChip } from './types';

const search = defineModel<string>('search', { required: true });

const props = defineProps<{
  loading: boolean;
  activeFiltersCount: number;
  filtersSummaryText: string;
  chips: CalendarFilterChip[];
}>();

const emit = defineEmits<{
  refresh: [];
  openFilters: [];
  removeChip: [CalendarFilterChip];
  resetFilters: [];
}>();

const hasActiveFilters = computed(() => props.activeFiltersCount > 0);

function handleRefresh(): void {
  emit('refresh');
}

function handleOpenFilters(): void {
  emit('openFilters');
}

function handleReset(): void {
  emit('resetFilters');
}

function handleRemoveChip(chip: CalendarFilterChip): void {
  emit('removeChip', chip);
}
</script>

<template>
  <div class="card-body controls-card-body d-flex flex-column gap-3">
    <div class="controls-header">
      <div class="controls-search">
        <label class="visually-hidden" for="calendar-search"
          >Поиск по матчам</label
        >
        <div class="input-group input-group-sm">
          <span class="input-group-text">
            <i class="bi bi-search" aria-hidden="true"></i>
          </span>
          <input
            id="calendar-search"
            v-model="search"
            type="search"
            class="form-control"
            placeholder="Поиск по командам, клубам, стадионам"
            autocomplete="off"
          />
        </div>
      </div>
      <div class="controls-actions">
        <button
          type="button"
          class="btn btn-outline-secondary btn-sm"
          :disabled="loading"
          @click="handleRefresh"
        >
          <span
            v-if="loading"
            class="spinner-border spinner-border-sm me-1"
            aria-hidden="true"
          ></span>
          Обновить
        </button>
        <button
          type="button"
          class="btn btn-outline-secondary btn-sm"
          @click="handleOpenFilters"
        >
          <i class="bi bi-sliders me-1" aria-hidden="true"></i>
          Фильтры
          <span
            v-if="activeFiltersCount"
            class="badge text-bg-secondary ms-1"
            >{{ activeFiltersCount }}</span
          >
        </button>
      </div>
    </div>

    <div class="controls-summary" role="status" aria-live="polite">
      <span class="summary-icon" aria-hidden="true">
        <i class="bi bi-funnel" aria-hidden="true"></i>
      </span>
      <span class="summary-text">{{ filtersSummaryText }}</span>
      <button
        v-if="hasActiveFilters"
        type="button"
        class="btn btn-link btn-sm text-decoration-none summary-reset"
        @click="handleReset"
      >
        <i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>
        Сбросить
      </button>
    </div>

    <div v-if="chips.length" class="active-chips">
      <button
        v-for="chip in chips"
        :key="chip.key"
        type="button"
        class="chip btn btn-light btn-sm border"
        :aria-label="`Удалить фильтр ${chip.label}`"
        @click="handleRemoveChip(chip)"
      >
        <i
          v-if="chip.icon"
          :class="['bi', chip.icon, 'me-1']"
          aria-hidden="true"
        ></i>
        {{ chip.label }}
        <i class="bi bi-x-lg ms-1" aria-hidden="true"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.controls-card-body {
  gap: 1.25rem;
}

.controls-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: start;
}

.controls-search {
  min-width: 0;
}

.controls-search .input-group {
  width: 100%;
}

.controls-search .form-control {
  min-height: 2.5rem;
}

.controls-search .input-group-text {
  display: inline-flex;
  align-items: center;
}

.controls-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  min-width: 0;
}

.controls-actions .btn {
  white-space: nowrap;
}

.controls-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--bs-secondary-color);
  font-size: 0.875rem;
  flex-wrap: wrap;
}

.summary-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: rgba(var(--bs-primary-rgb), 0.08);
  color: var(--brand-color);
  flex: 0 0 auto;
}

.summary-text {
  flex: 1 1 auto;
  min-width: 0;
}

.summary-reset {
  margin-left: auto;
  padding-left: 0;
  padding-right: 0;
  flex: 0 0 auto;
}

.active-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0 -0.125rem;
}

.active-chips .chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 999px;
  padding-inline: 0.75rem;
  font-size: 0.8rem;
  min-height: 2rem;
  flex: 0 0 auto;
}

@media (max-width: 991.98px) {
  .controls-header {
    grid-template-columns: minmax(0, 1fr);
  }
  .controls-actions {
    justify-content: flex-start;
  }
  .summary-reset {
    order: 3;
    margin-left: 0;
  }
}

@media (max-width: 767.98px) {
  .controls-summary {
    font-size: 0.85rem;
  }
  .summary-icon {
    width: 1.5rem;
    height: 1.5rem;
  }
}

@media (max-width: 575.98px) {
  .controls-actions {
    width: 100%;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .controls-actions .btn {
    flex: 1 1 auto;
  }
  .controls-search .form-control {
    min-height: 2.75rem;
    font-size: 1rem;
  }
  .controls-search .input-group-text {
    font-size: 1rem;
  }
  .active-chips {
    flex-wrap: nowrap;
    overflow-x: auto;
    gap: 0.375rem;
    padding-bottom: 0.25rem;
    margin-inline: -0.25rem;
    scrollbar-width: none;
  }
  .active-chips::-webkit-scrollbar {
    display: none;
  }
  .active-chips .chip {
    flex: 0 0 auto;
  }
}
</style>
