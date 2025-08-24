<script setup>
import { computed } from 'vue';
import { MOSCOW_TZ, toDayKey } from '../utils/time.js';

const props = defineProps({
  items: { type: Array, default: () => [] },
});

const groups = computed(() => {
  const map = new Map();
  (props.items || []).forEach((m) => {
    const key = toDayKey(m.date);
    if (!map.has(key)) map.set(key, { date: new Date(key), list: [] });
    map.get(key).list.push(m);
  });
  return [...map.values()]
    .sort((a, b) => a.date - b.date)
    .map((g) => {
      g.list.sort((a, b) => new Date(a.date) - new Date(b.date));
      return g;
    });
});

function formatDay(date) {
  const text = date.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: MOSCOW_TZ,
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: MOSCOW_TZ,
  });
}
</script>

<template>
  <div class="match-schedule">
    <div
      v-for="group in groups"
      :key="group.date.getTime()"
      class="mb-3 schedule-day"
    >
      <h2 class="h6 mb-3">{{ formatDay(group.date) }}</h2>
      <ul class="list-unstyled mb-0">
        <li v-for="m in group.list" :key="m.id" class="schedule-item">
          <div
            class="d-flex justify-content-between align-items-start schedule-row"
          >
            <div class="me-3 flex-grow-1 schedule-details">
              <div
                class="d-flex align-items-center gap-2 flex-wrap mb-1 meta-row"
              >
                <span v-if="m.tournament" class="badge badge-brand-soft">{{
                  m.tournament
                }}</span>
                <span v-if="m.group" class="badge bg-light text-muted border"
                  >Группа: {{ m.group }}</span
                >
                <span v-if="m.tour" class="badge bg-light text-muted border"
                  >Тур: {{ m.tour }}</span
                >
              </div>
              <div class="teams" :title="`${m.team1} — ${m.team2}`">
                <strong>{{ m.team1 }} — {{ m.team2 }}</strong>
              </div>
              <div class="text-muted small" aria-label="Время и место">
                {{ formatTime(m.date)
                }}<span class="ms-2">{{ m.stadium || '—' }}</span>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>
    <p v-if="!groups.length" class="mb-0">Нет матчей.</p>
  </div>
</template>

<style scoped>
.teams {
  white-space: normal;
  word-break: break-word;
}

/* Reuse schedule-day styles consistent with TrainingCalendar */
.schedule-day {
  padding-bottom: 1rem;
  border-bottom: 1px solid #dee2e6;
}

.schedule-day:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.schedule-item {
  margin-top: 0.5rem;
}

.schedule-item:first-child {
  margin-top: 0;
}

.schedule-details {
  min-width: 0;
}

.badge-brand-soft {
  color: var(--brand-color);
  background: rgba(17, 56, 103, 0.12);
  border: 1px solid rgba(17, 56, 103, 0.2);
}

@media (max-width: 575.98px) {
  .schedule-row {
    flex-wrap: wrap;
  }
}
</style>
