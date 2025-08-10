<script setup>
import { computed } from 'vue';
import { MOSCOW_TZ, toDayKey } from '../utils/time.js';

const props = defineProps({
  trainings: { type: Array, default: () => [] },
});
const emit = defineEmits(['register', 'unregister']);

const groups = computed(() => {
  const map = new Map();
  props.trainings.forEach((t) => {
    const key = toDayKey(t.start_at);
    if (!map.has(key)) map.set(key, { date: new Date(key), list: [] });
    map.get(key).list.push(t);
  });
  return [...map.values()]
    .sort((a, b) => a.date - b.date)
    .map((g) => {
      g.list.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
      return g;
    });
});

const registeredDates = computed(() => {
  const set = new Set();
  props.trainings.forEach((t) => {
    if (t.registered) set.add(toDayKey(t.start_at));
  });
  return set;
});

function formatDay(date) {
  const text = date.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: MOSCOW_TZ,
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: MOSCOW_TZ,
  });
}

function isDisabled(t) {
  const key = toDayKey(t.start_at);
  return registeredDates.value.has(key) && !t.registered;
}
</script>

<template>
  <div class="training-schedule">
    <div
      v-for="group in groups"
      :key="group.date.getTime()"
      class="mb-3 schedule-day"
    >
      <h2 class="h6 mb-3">{{ formatDay(group.date) }}</h2>
      <ul class="list-unstyled mb-0">
        <li v-for="t in group.list" :key="t.id" class="schedule-item">
          <div class="d-flex justify-content-between align-items-start">
            <div class="me-3 flex-grow-1">
              <div>
                <strong
                  >{{ formatTime(t.start_at) }}–{{
                    formatTime(t.end_at)
                  }}</strong
                >
                <span class="ms-2">{{ t.ground?.name }}</span>
              </div>
              <div class="text-muted small">{{ t.type?.name }}</div>
            </div>
            <div class="d-flex align-items-center">
              <button
                v-if="t.registered"
                class="btn btn-sm btn-secondary"
                @click="emit('unregister', t.id)"
              >
                Отменить
              </button>
              <button
                v-else
                class="btn btn-sm btn-brand"
                :disabled="isDisabled(t) || !t.registration_open"
                @click="emit('register', t.id)"
              >
                Записаться
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.schedule-day {
  padding-bottom: 1rem;
  border-bottom: 1px solid #dee2e6;
}

.schedule-day:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.schedule-item {
  margin-top: 0.5rem;
}

.schedule-item:first-child {
  margin-top: 0;
}
</style>
