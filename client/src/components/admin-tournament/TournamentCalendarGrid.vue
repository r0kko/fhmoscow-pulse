<script setup lang="ts">
// @ts-nocheck
const props = defineProps<{
  weekdayLabels: string[];
  cells: Array<any>;
}>();

const emit = defineEmits<{
  selectDay: [string];
  moveDay: [number];
}>();

function onKeydown(event: KeyboardEvent, dayKey: string): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    emit('selectDay', dayKey);
    return;
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    emit('moveDay', -1);
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    emit('moveDay', 1);
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    emit('moveDay', -7);
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    emit('moveDay', 7);
  }
}
</script>

<template>
  <div class="calendar-weekdays mb-2" role="row">
    <span
      v-for="weekday in props.weekdayLabels"
      :key="weekday"
      class="calendar-weekday"
      role="columnheader"
      >{{ weekday }}</span
    >
  </div>
  <div class="calendar-grid" role="grid" aria-label="Календарь матчей турнира">
    <template v-for="cell in props.cells" :key="cell.key">
      <button
        v-if="cell.inMonth"
        type="button"
        class="calendar-cell"
        :class="{
          'calendar-cell--selected': cell.isSelected,
          'calendar-cell--today': cell.isToday,
          'calendar-cell--has-matches': cell.count > 0,
        }"
        :aria-label="`${cell.dayKey}: матчей ${cell.count || 0}`"
        :aria-pressed="cell.isSelected ? 'true' : 'false'"
        @click="emit('selectDay', cell.dayKey)"
        @keydown="onKeydown($event, cell.dayKey)"
      >
        <span class="calendar-day-number">{{ cell.day }}</span>
        <span v-if="cell.count" class="badge bg-light text-muted border">{{
          cell.count
        }}</span>
      </button>
      <div
        v-else
        class="calendar-cell calendar-cell--empty"
        aria-hidden="true"
      ></div>
    </template>
  </div>
</template>

<style scoped>
.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.35rem;
}

.calendar-weekday {
  text-align: center;
  font-size: 0.8rem;
  color: var(--bs-secondary-color);
  font-weight: 600;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.35rem;
}

.calendar-cell {
  min-height: 72px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: #fff;
  padding: 0.35rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
}

.calendar-cell--empty {
  visibility: hidden;
}

.calendar-cell--has-matches {
  border-color: rgba(17, 56, 103, 0.32);
}

.calendar-cell--selected {
  border-color: var(--brand-color);
  box-shadow: 0 0 0 1px rgba(17, 56, 103, 0.28);
}

.calendar-cell--today {
  background: rgba(17, 56, 103, 0.06);
}

.calendar-day-number {
  font-weight: 600;
}
</style>
