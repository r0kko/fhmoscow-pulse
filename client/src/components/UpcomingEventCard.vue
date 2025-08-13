<script setup>
import { computed } from 'vue';
import { withHttp } from '../utils/url.js';

const props = defineProps({
  event: { type: Object, required: true },
});

const isTraining = computed(() => props.event.kind === 'training');
const isExam = computed(() => props.event.kind === 'exam');
const icon = computed(() => {
  if (isTraining.value) return 'bi-people-fill';
  if (isExam.value) return 'bi-heart-pulse';
  return 'bi-calendar-event';
});
const title = computed(() => {
  if (isTraining.value) return 'Тренировка';
  if (isExam.value) return 'Медосмотр';
  return 'Мероприятие';
});
const isOnline = computed(
  () => (isTraining.value || !isExam.value) && props.event.type?.online && props.event.url
);
const location = computed(() => {
  if (isOnline.value) {
    return 'Подключиться по ссылке';
  }
  const loc = isExam.value
    ? props.event.center?.address?.result
    : props.event.ground?.address?.result;
  return loc || '';
});
const href = computed(() => {
  if (isOnline.value) {
    return withHttp(props.event.url);
  }
  return isExam.value ? null : withHttp(props.event.ground?.yandex_url);
});

function formatStart(date) {
  const d = new Date(date);
  const dateStr = d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Moscow',
  });
  const timeStr = d.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  });
  return `${dateStr} в ${timeStr}`;
}
</script>

<template>
  <component
    :is="href ? 'a' : 'div'"
    :href="href"
    target="_blank"
    class="text-decoration-none text-body"
  >
    <div class="card h-100 upcoming-card">
      <div class="card-body d-flex align-items-start p-3">
        <i :class="`bi ${icon} fs-3 me-3 text-brand`" aria-hidden="true"></i>
        <div>
          <h3 class="card-title h6 mb-1">{{ title }}</h3>
          <p class="mb-1 small">
            <i class="bi bi-clock me-1" aria-hidden="true"></i>
            {{ formatStart(event.start_at) }}
          </p>
          <p class="mb-0 small">
            <i class="bi bi-geo-alt me-1" aria-hidden="true"></i>
            {{ location }}
          </p>
        </div>
      </div>
    </div>
  </component>
</template>

<style scoped>
.upcoming-card {
  width: clamp(14rem, 70vw, 18rem);
  margin: 0;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  border-radius: 0.75rem;
}

.upcoming-card .card-body {
  padding: 0.75rem;
}

.upcoming-card i {
  color: var(--brand-color);
}
</style>
