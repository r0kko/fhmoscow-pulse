<script setup>
import { computed } from 'vue';
import metroIcon from '../assets/metro.svg';

const props = defineProps({
  exam: { type: Object, required: true },
  loading: { type: Boolean, default: false },
});
const emit = defineEmits(['toggle']);

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

function metroNames(address) {
  if (!address || !Array.isArray(address.metro) || !address.metro.length) {
    return '';
  }
  return address.metro
    .slice(0, 2)
    .map((m) => m.name)
    .join(', ');
}

function seatStatus(e) {
  if (typeof e.registration_count === 'number' && typeof e.capacity === 'number') {
    return `Получено ${e.registration_count} заявок на ${e.capacity} мест`;
  }
  if (typeof e.capacity === 'number') {
    return `Всего мест: ${e.capacity}`;
  }
  return '';
}

const btnClass = computed(() => {
  if (!props.exam.registered) return 'btn-brand';
  if (props.exam.registration_status === 'pending') return 'btn-secondary';
  if (props.exam.registration_status === 'approved') return 'btn-success';
  return 'btn-danger';
});

const btnText = computed(() => {
  if (!props.exam.registered) return 'Записаться';
  if (props.exam.registration_status === 'pending') return 'На рассмотрении';
  if (props.exam.registration_status === 'approved') return 'Подтверждено';
  return 'Отклонено';
});

const disabled = computed(
  () =>
    props.exam.registration_status === 'approved' ||
    props.exam.registration_status === 'rejected' ||
    (typeof props.exam.capacity === 'number' &&
      typeof props.exam.approved_count === 'number' &&
      props.exam.approved_count >= props.exam.capacity)
);
</script>

<template>
  <div class="card h-100 exam-card tile">
    <div class="card-body d-flex flex-column p-3">
      <h6 class="card-title mb-1">{{ formatStart(exam.start_at) }}</h6>
      <p class="text-muted mb-1 small">{{ exam.center?.name }}</p>
      <p v-if="exam.center?.address" class="text-muted mb-1 small">
        {{ exam.center.address.result }}
      </p>
      <p
        v-if="metroNames(exam.center?.address)"
        class="text-muted mb-2 small d-flex align-items-center"
      >
        <img :src="metroIcon" alt="Метро" height="14" class="me-1" />
        <span>{{ metroNames(exam.center.address) }}</span>
      </p>
      <button
        class="btn btn-sm mt-auto"
        :class="btnClass"
        :disabled="disabled || loading"
        @click="emit('toggle', exam)"
      >
        <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
        <small>{{ btnText }}</small>
      </button>
      <p v-if="seatStatus(exam)" class="seat-status text-muted text-center mt-2">
        {{ seatStatus(exam) }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.exam-card {
  width: clamp(16rem, 75vw, 20rem);
  margin: 0;
  scroll-snap-align: start;
  scroll-snap-stop: always;
}
.exam-card .card-title {
  font-size: var(--fs-base);
}
.exam-card .card-body {
  padding: 0.75rem;
}
.seat-status {
  font-size: 0.75rem;
}
</style>
