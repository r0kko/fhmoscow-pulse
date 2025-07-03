<script setup>

const props = defineProps({
  training: { type: Object, required: true },
  loading: { type: Boolean, default: false },
  showCancel: { type: Boolean, default: true },
});
const emit = defineEmits(['register', 'unregister']);

function formatStart(date) {
  const d = new Date(date);
  const text = d.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function badgeClass(alias) {
  if (!alias) return 'bg-secondary';
  switch (alias) {
    case 'ICE':
      return 'bg-brand';
    case 'BASIC_FIT':
      return 'bg-success';
    case 'THEORY':
    default:
      return 'bg-secondary';
  }
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
<div class="card h-100 training-card tile">
    <div class="card-body d-flex flex-column p-3">
      <h6 class="card-title mb-1">{{ formatStart(training.start_at) }}</h6>
      <p class="text-muted mb-1 small">{{ durationText(training.start_at, training.end_at) }}</p>
      <span
        class="badge align-self-start mb-2"
        :class="badgeClass(training.type?.alias)"
        >{{ training.type?.name }}</span
      >
      <p class="small mb-2">Мест: {{ seatStatus(training) }}</p>
      <button
        v-if="training.registered && showCancel"
        class="btn btn-sm btn-secondary mt-auto"
        @click="emit('unregister', training.id)"
      >Отменить</button>
      <button
        v-else
        class="btn btn-sm btn-brand mt-auto"
        :disabled="!training.registration_open || loading"
        @click="emit('register', training.id)"
      >
        <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
        Записаться
      </button>
    </div>
  </div>
</template>

<style scoped>
.training-card {
  max-width: 20rem;
  margin: 0;
}

.training-card .card-title {
  font-size: 1rem;
}

.training-card .card-body {
  padding: 0.75rem;
}
</style>
