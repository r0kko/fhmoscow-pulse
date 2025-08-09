<script setup>
import { computed } from 'vue';
import TrainingCard from './TrainingCard.vue';

const props = defineProps({
  trainings: { type: Array, default: () => [] },
});
const emit = defineEmits(['register', 'unregister']);

const groups = computed(() => {
  const sorted = [...props.trainings].sort(
    (a, b) => new Date(a.start_at) - new Date(b.start_at)
  );
  const map = new Map();
  sorted.forEach((t) => {
    const d = new Date(t.start_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(t);
  });
  return Array.from(map.entries()).map(([date, list]) => ({ date, list }));
});

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Moscow',
  });
}
</script>

<template>
  <div class="training-calendar">
    <div v-for="group in groups" :key="group.date" class="mb-4">
      <h3 class="h6 mb-3 calendar-date">{{ formatDate(group.date) }}</h3>
      <div class="d-flex flex-column gap-3">
        <TrainingCard
          v-for="t in group.list"
          :key="t.id"
          :training="t"
          @register="emit('register', $event)"
          @unregister="emit('unregister', $event)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar-date {
  text-transform: capitalize;
}

:deep(.training-card) {
  width: 100%;
}
</style>
