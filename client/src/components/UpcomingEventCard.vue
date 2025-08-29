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
  () =>
    (isTraining.value || !isExam.value) &&
    props.event.type?.online &&
    props.event.url
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

const startDate = computed(() => new Date(props.event.start_at));
const dayNum = computed(() => startDate.value.getDate());
const monthShort = computed(() =>
  startDate.value
    .toLocaleDateString('ru-RU', {
      month: 'short',
      timeZone: 'Europe/Moscow',
    })
    .replace('.', '')
);
const timeShort = computed(() =>
  startDate.value.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  })
);

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
    :aria-label="`${title} — ${formatStart(event.start_at)}${location ? ', ' + location : ''}`"
  >
    <div class="card h-100 upcoming-card">
      <div class="card-body">
        <div class="d-flex align-items-start">
          <div class="date-pill me-3" aria-hidden="true">
            <div class="day">{{ dayNum }}</div>
            <div class="month text-uppercase">{{ monthShort }}</div>
          </div>
          <div class="flex-grow-1 content-col">
            <div
              class="d-flex align-items-start justify-content-between gap-2 mb-1 header-row"
            >
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <i :class="`bi ${icon} text-brand`" aria-hidden="true"></i>
                <span class="badge badge-brand-soft">{{ title }}</span>
                <span v-if="isOnline" class="badge bg-light text-muted border">
                  Онлайн
                </span>
              </div>
              <div class="text-muted small time" aria-hidden="true">
                {{ timeShort }}
              </div>
            </div>
            <div
              v-if="location"
              class="small text-body-secondary address"
              :title="location"
            >
              <i class="bi bi-geo-alt me-1" aria-hidden="true"></i>
              <span class="align-middle">{{ location }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </component>
</template>

<style scoped>
.upcoming-card {
  width: clamp(16rem, 85vw, 20rem);
  margin: 0;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  border-radius: var(--radius-tile);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-tile);
}

.upcoming-card .card-body {
  padding: var(--tile-padding);
}

.content-col {
  min-width: 0; /* allow header/address to wrap properly */
}

.address {
  white-space: normal;
  word-break: break-word;
}

@media (min-width: 576px) {
  .upcoming-card {
    width: 22rem;
  }
}

/* subtle focus ring for accessibility */
:focus-visible .upcoming-card,
.upcoming-card:focus-visible {
  outline: 2px solid rgba(17, 56, 103, 0.35);
  outline-offset: 2px;
}

.date-pill {
  width: 2.5rem;
  min-width: 2.5rem;
  height: 3rem;
  border-radius: var(--radius-sm);
  background: #f4f6f8;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.date-pill .day {
  font-weight: 700;
  font-size: 1.125rem;
}
.date-pill .month {
  font-size: 0.75rem;
  color: #6c757d;
}
.header-row .time {
  flex-shrink: 0;
  white-space: nowrap;
}

.badge-brand-soft {
  color: var(--brand-color);
  background: rgba(17, 56, 103, 0.12);
  border: 1px solid rgba(17, 56, 103, 0.2);
}

/* text-brand is defined globally in brand.css */
</style>
