<script setup lang="ts">
import { computed } from 'vue';
import type { UpcomingCardEvent } from '@/types/upcoming';
import { withHttp } from '../utils/url';

const props = defineProps<{ event: UpcomingCardEvent }>();

const icon = computed(() => {
  switch (props.event.type) {
    case 'training':
      return 'bi-people-fill';
    case 'exam':
      return 'bi-heart-pulse';
    default:
      return 'bi-calendar-event';
  }
});

const isExam = computed(() => props.event.type === 'exam');
const isOnline = computed(() => props.event.isOnline === true);

const href = computed(() => {
  if (isExam.value || !props.event.link) return null;
  return withHttp(props.event.link);
});

const startDate = computed(() => new Date(props.event.startAt));
const isValidDate = computed(() => Number.isFinite(startDate.value.getTime()));

const dayNum = computed(() =>
  isValidDate.value
    ? startDate.value.getDate().toString().padStart(2, '0')
    : '—'
);

const monthShort = computed(() => {
  if (!isValidDate.value) return '—';
  return startDate.value
    .toLocaleDateString('ru-RU', {
      month: 'short',
      timeZone: 'Europe/Moscow',
    })
    .replace('.', '');
});

const timeShort = computed(() => {
  if (!isValidDate.value) return '—:—';
  return startDate.value.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  });
});

function formatStart(date: string): string {
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return 'Неизвестная дата';
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
    :aria-label="`${event.title} — ${formatStart(event.startAt)}${
      event.description ? ', ' + event.description : ''
    }`"
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
                <span class="badge badge-brand-soft">{{ event.title }}</span>
                <span v-if="isOnline" class="badge bg-light text-muted border">
                  Онлайн
                </span>
              </div>
              <div class="text-muted small time" aria-hidden="true">
                {{ timeShort }}
              </div>
            </div>
            <div
              v-if="event.description"
              class="small text-body-secondary address"
              :title="event.description"
            >
              <i
                v-if="!isExam"
                class="bi bi-geo-alt me-1"
                aria-hidden="true"
              ></i>
              <span class="align-middle">{{ event.description }}</span>
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
