<script setup>
import { computed } from 'vue';
import { toDayKey, formatMskDateLong, formatMskTimeShort } from '../utils/time';

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
  return formatMskDateLong(date.toISOString());
}

function formatTime(dateStr) {
  return formatMskTimeShort(dateStr, { placeholder: '—:—' });
}

function rowClass(m) {
  if (m?.agreement_accepted) return 'state-accepted';
  if (m?.urgent_unagreed) return 'state-urgent';
  if (m?.agreement_pending) return 'state-pending';
  return '';
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
            :class="rowClass(m)"
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
                <i class="bi bi-clock me-1" aria-hidden="true"></i
                >{{ formatTime(m.date) }}
                <small class="text-muted ms-1">МСК</small>
                <span class="ms-3">
                  <i class="bi bi-geo-alt me-1" aria-hidden="true"></i
                  >{{ m.stadium || '—' }}
                </span>
              </div>
            </div>
            <div class="flex-shrink-0">
              <RouterLink
                :to="`/school-matches/${m.id}`"
                class="btn btn-link p-0 text-primary"
                aria-label="Открыть карточку матча"
              >
                <i class="bi bi-arrow-right-circle me-1" aria-hidden="true"></i>
                Открыть
              </RouterLink>
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

/* Row state backgrounds */
.schedule-row.state-accepted {
  background: var(--bs-success-bg-subtle, #d1e7dd);
  border-radius: var(--radius-sm);
  padding: 0.375rem 0.5rem;
}
.schedule-row.state-pending {
  background: var(--bs-warning-bg-subtle, #fff3cd);
  border-radius: var(--radius-sm);
  padding: 0.375rem 0.5rem;
}
.schedule-row.state-urgent {
  background: var(--bs-danger-bg-subtle, #f8d7da);
  border-radius: var(--radius-sm);
  padding: 0.375rem 0.5rem;
}

@media (max-width: 575.98px) {
  .schedule-row {
    flex-wrap: wrap;
  }
}
</style>
