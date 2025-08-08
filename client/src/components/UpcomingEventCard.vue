<script setup>
import { computed } from 'vue';
import { withHttp } from '../utils/url.js';

const props = defineProps({
  event: { type: Object, required: true },
});

const isTraining = computed(() => props.event.kind === 'training');
const icon = computed(() =>
  isTraining.value ? 'bi-people-fill' : 'bi-heart-pulse'
);
const title = computed(() => (isTraining.value ? 'Тренировка' : 'Медосмотр'));
const location = computed(() => {
  const loc = isTraining.value
    ? props.event.ground?.address?.result
    : props.event.center?.address?.result;
  return loc || '';
});
const href = computed(() => {
  return isTraining.value ? withHttp(props.event.ground?.yandex_url) : null;
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
          <h6 class="card-title mb-1">{{ title }}</h6>
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
