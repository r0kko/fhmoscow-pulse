<script setup>

const props = defineProps({
  training: { type: Object, required: true },
});
const emit = defineEmits(['register', 'unregister']);

function formatStart(date) {
  const d = new Date(date);
  return d
    .toLocaleDateString('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })
}

function durationText(start, end) {
  const diff = (new Date(end) - new Date(start)) / 60000;
  const h = Math.floor(diff / 60);
  const m = Math.round(diff % 60);
  let out = '≈ ';
  if (h > 0) out += `${h} час${h > 1 ? 'а' : ''}`;
  if (h > 0 && m > 0) out += ' ';
  if (m > 0) out += `${m} минут`;
  return out;
}

function seatStatus(t) {
  if (typeof t.available === 'number') {
    if (t.available === 0) return 'закончились';
    if (t.available <= 5) return 'мало';
    return 'много';
  }
  return 'много';
}
</script>

<template>
  <div class="card h-100 training-card">
    <div class="card-body d-flex flex-column">
      <h5 class="card-title mb-2">{{ formatStart(training.start_at) }}</h5>
      <p class="text-muted mb-2">{{ durationText(training.start_at, training.end_at) }}</p>
      <span class="badge bg-brand align-self-start mb-2">{{ training.type?.name }}</span>
      <p class="small mb-3">Мест: {{ seatStatus(training) }}</p>
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
  width: 100%;
}
</style>
