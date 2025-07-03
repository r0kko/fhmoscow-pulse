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
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
<div class="card h-100 training-card tile">
    <div class="card-body d-flex flex-column p-3">
      <h6 class="card-title mb-1">{{ formatStart(training.start_at) }}</h6>
      <p class="text-muted mb-1 small">{{ durationText(training.start_at, training.end_at) }}</p>
      <span
        class="badge badge-training-type align-self-start mb-2"
        :class="badgeClass(training.type?.alias)"
        >{{ training.type?.name }}</span
      >
      <p class="small mb-1">
        Тренер<span v-if="training.coaches && training.coaches.length > 1"
          >(-ы)</span
        >:
        <template v-if="training.coaches && training.coaches.length">
          <span v-for="(c, i) in training.coaches" :key="c.id">
            <a
              :href="`tel:+${c.phone}`"
              class="text-reset text-decoration-none"
              >{{ shortName(c) }}</a
            ><span v-if="i < training.coaches.length - 1">, </span>
          </span>
        </template>
        <span v-else>не назначен</span>
      </p>
      <p class="small mb-2">
        Инвентарь:
        <template
          v-if="training.equipment_managers && training.equipment_managers.length"
        >
          <span v-for="(m, i) in training.equipment_managers" :key="m.id">
            <a
              :href="`tel:+${m.phone}`"
              class="text-reset text-decoration-none"
              >{{ shortName(m) }}</a
            ><span v-if="i < training.equipment_managers.length - 1">, </span>
          </span>
        </template>
        <span v-else>не назначен</span>
      </p>
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
      <p class="seat-status text-muted mt-1 mb-0 text-center">
        Мест: {{ seatStatus(training) }}
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
  padding: 0.75rem;
}

.seat-status {
  font-size: 0.75rem;
}
</style>
