<script setup>
import { computed } from 'vue';
import metroIcon from '../assets/metro.svg';
import { pluralize } from '../utils/plural.js';

const props = defineProps({
  exam: { type: Object, required: true },
  loading: { type: Boolean, default: false },
  activeExamId: { type: String, default: null },
});
const emit = defineEmits(['toggle']);

const hasOtherActive = computed(
  () => props.activeExamId && props.activeExamId !== props.exam.id
);

const pendingTooltip = computed(() =>
  props.exam.registration_status === 'PENDING'
    ? 'Нажмите, чтобы отменить заявку'
    : null
);

function formatStart(date) {
  const d = new Date(date);
  const text = d.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
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
    const appWord = pluralize(e.registration_count, ['заявка', 'заявки', 'заявок']);
    const seatWord = pluralize(e.capacity, ['место', 'места', 'мест']);
    const receivedWord = pluralize(e.registration_count, ['Получена', 'Получено', 'Получено']);
    return `${receivedWord} ${e.registration_count} ${appWord} на ${e.capacity} ${seatWord}`;
  }
  if (typeof e.capacity === 'number') {
    const seatWord = pluralize(e.capacity, ['место', 'места', 'мест']);
    return `Всего ${e.capacity} ${seatWord}`;
  }
  return '';
}

const approvedFull = computed(
  () =>
    typeof props.exam.capacity === 'number' &&
    typeof props.exam.approved_count === 'number' &&
    props.exam.approved_count >= props.exam.capacity
);

const btnClass = computed(() => {
  if (hasOtherActive.value) return 'btn-secondary';
  if (!props.exam.registered) {
    if (approvedFull.value) return 'btn-secondary';
    return 'btn-brand';
  }
  if (props.exam.registration_status === 'PENDING') return 'btn-secondary';
  if (props.exam.registration_status === 'APPROVED') return 'btn-success';
  if (props.exam.registration_status === 'COMPLETED') return 'btn-primary';
  return 'btn-danger';
});

const btnText = computed(() => {
  if (hasOtherActive.value) return 'Есть активная заявка';
  if (!props.exam.registered)
    return approvedFull.value ? 'Мест нет' : 'Оставить заявку';
  if (props.exam.registration_status === 'PENDING') return 'На рассмотрении';
  if (props.exam.registration_status === 'APPROVED') return 'Подтверждена';
  if (props.exam.registration_status === 'COMPLETED') return 'Завершена';
  return 'Отменена';
});

const btnIcon = computed(() => {
  if (hasOtherActive.value) return 'bi-hourglass';
  if (!props.exam.registered) {
    if (approvedFull.value) return 'bi-slash-circle';
    return 'bi-plus-lg';
  }
  if (props.exam.registration_status === 'PENDING') return 'bi-hourglass';
  if (props.exam.registration_status === 'APPROVED') return 'bi-check-lg';
  if (props.exam.registration_status === 'COMPLETED') return 'bi-check2-all';
  return 'bi-x-lg';
});

const disabled = computed(
  () =>
    hasOtherActive.value ||
    props.exam.registration_status === 'APPROVED' ||
    props.exam.registration_status === 'COMPLETED' ||
    props.exam.registration_status === 'CANCELED' ||
    approvedFull.value
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
        class="btn btn-sm mt-auto d-flex align-items-center justify-content-center gap-1"
        :class="btnClass"
        :disabled="disabled || loading"
        @click="emit('toggle', exam)"
        :data-bs-toggle="pendingTooltip ? 'tooltip' : null"
        :title="pendingTooltip"
      >
        <span v-if="loading" class="spinner-border spinner-border-sm"></span>
        <template v-else>
          <i :class="'bi ' + btnIcon"></i>
          <small>{{ btnText }}</small>
        </template>
      </button>
      <p v-if="seatStatus(exam)" class="seat-status text-muted text-center mt-1 mb-0">
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
