<script setup>
import { RouterLink } from 'vue-router';

const props = defineProps({
  training: { type: Object, required: true }
});
const emit = defineEmits(['register', 'unregister']);

function formatDateTimeRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return (
    s.toLocaleDateString() +
    ' ' +
    s.toLocaleTimeString().slice(0, 5) +
    ' - ' +
    e.toLocaleDateString() +
    ' ' +
    e.toLocaleTimeString().slice(0, 5)
  );
}
</script>

<template>
  <div class="card h-100 training-card">
    <div class="card-body d-flex flex-column">
      <h5 class="card-title mb-1">{{ training.stadium?.name }}</h5>
      <p class="text-muted mb-1">{{ training.type?.name }}</p>
      <p class="mb-1"><i class="bi bi-clock me-1"></i>{{ formatDateTimeRange(training.start_at, training.end_at) }}</p>
      <p class="mb-3">Вместимость: {{ training.capacity || '—' }}</p>
      <button
        v-if="training.registered"
        class="btn btn-sm btn-secondary mt-auto"
        @click="emit('unregister', training.id)"
      >Отменить</button>
      <button
        v-else
        class="btn btn-sm btn-brand mt-auto"
        :disabled="!training.registration_open"
        @click="emit('register', training.id)"
      >Записаться</button>
    </div>
  </div>
</template>

<style scoped>
.training-card {
  width: 18rem;
  margin-left: auto;
  margin-right: auto;
}
</style>
