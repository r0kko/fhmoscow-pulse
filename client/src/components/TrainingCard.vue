<script setup>
import { computed } from 'vue';
import { typeBadgeClass as badgeClass } from '../utils/training.js';

function shortName(u) {
  const initials = [u.first_name, u.patronymic]
    .filter(Boolean)
    .map((n) => n.charAt(0) + '.')
    .join(' ');
  return `${u.last_name} ${initials}`.trim();
}

const props = defineProps({
  training: { type: Object, required: true },
  loading: { type: Boolean, default: false },
  showCancel: { type: Boolean, default: true },
});
const emit = defineEmits(['register', 'unregister']);

const coachList = computed(() =>
  props.training.teacher
    ? [props.training.teacher]
    : props.training.coaches || []
);
const coachLabel = computed(() =>
  props.training.teacher ? 'Преподаватель' : 'Тренер'
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
  if (typeof t.available === 'number' && t.available <= 0) {
    return '';
  }
  if (typeof t.available === 'number' && typeof t.capacity === 'number') {
    return `${t.available} / ${t.capacity} мест свободно`;
  }
  if (typeof t.available === 'number') {
    return `${t.available} мест свободно`;
  }
  return '';
}

function registrationOpenTime(start) {
  const d = new Date(start);
  d.setDate(d.getDate() - 7);
  return d;
}

function registrationCloseTime(start) {
  const d = new Date(start);
  d.setMinutes(d.getMinutes() - 45);
  return d;
}

const registrationNotStarted = computed(() => {
  return new Date() < registrationOpenTime(props.training.start_at);
});

const showRegistrationDeadline = computed(() => {
  return new Date() < registrationCloseTime(props.training.start_at);
});

function formatDeadline(start) {
  const d = registrationCloseTime(start);
  return d.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  });
}

function canCancel() {
  return (
    new Date(props.training.start_at).getTime() - Date.now() >
    48 * 60 * 60 * 1000
  );
}
</script>

<template>
  <div class="card h-100 training-card tile">
    <div class="card-body d-flex flex-column">
      <h3 class="card-title h6 mb-1">{{ formatStart(training.start_at) }}</h3>
      <p class="text-muted mb-1 small">
        {{ durationText(training.start_at, training.end_at) }}
      </p>
      <span
        class="badge badge-training-type align-self-start mb-2"
        :class="badgeClass(training.type?.alias)"
        >{{ training.type?.name }}</span
      >
      <p v-if="coachList.length" class="small mb-1">
        {{ coachLabel }}<span v-if="coachList.length > 1">ы</span>:
        <span v-for="(c, i) in coachList" :key="c.id">
          <a
            :href="`tel:+${c.phone}`"
            class="text-reset text-decoration-none"
            >{{ shortName(c) }}</a
          ><span v-if="i < coachList.length - 1">, </span>
        </span>
      </p>
      <p v-else class="small mb-1">{{ coachLabel }}: не назначен</p>
      <p
        v-if="training.equipment_managers && training.equipment_managers.length"
        class="small mb-2"
      >
        Инвентарь:
        <span v-for="(m, i) in training.equipment_managers" :key="m.id">
          <a
            :href="`tel:+${m.phone}`"
            class="text-reset text-decoration-none"
            >{{ shortName(m) }}</a
          ><span v-if="i < training.equipment_managers.length - 1">, </span>
        </span>
      </p>
      <div
        v-if="training.registered && showCancel"
        class="mt-auto d-flex align-items-center justify-content-between"
      >
        <div class="text-success small d-flex align-items-center">
          <i class="bi bi-check-circle me-1" aria-hidden="true"></i>
          <span>Вы записаны</span>
        </div>
        <button
          v-if="canCancel()"
          class="btn btn-link p-0 text-danger"
          :disabled="loading"
          @click="emit('unregister', training.id)"
        >
          <span
            v-if="loading"
            class="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
          ></span>
          <i v-else class="bi bi-x-lg" aria-hidden="true"></i>
          <span class="visually-hidden">Отменить</span>
        </button>
      </div>
      <button
        v-else
        class="btn btn-sm btn-brand mt-auto"
        :disabled="!training.registration_open || loading"
        @click="emit('register', training.id)"
      >
        <span
          v-if="loading"
          class="spinner-border spinner-border-sm me-2"
        ></span>
        <small>
          {{
            registrationNotStarted
              ? 'Регистрация не началась'
              : training.available === 0
                ? 'Мест нет'
                : 'Зарегистрироваться'
          }}
        </small>
      </button>
      <p
        v-if="seatStatus(training)"
        class="seat-status text-muted mt-1 mb-0 text-center"
      >
        {{ seatStatus(training) }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.training-card {
  width: clamp(16rem, 75vw, 20rem);
  margin: 0;
  scroll-snap-align: start;
  scroll-snap-stop: always;
}

.training-card .card-title {
  font-size: var(--fs-base);
}

.training-card .card-body {
  padding: var(--tile-padding);
}

.seat-status {
  font-size: 0.75rem;
}
</style>
