<script setup>
import { computed } from 'vue';
import {
  toDayKey,
  formatMskDateLong,
  formatMskTimeShort,
} from '../utils/time.js';

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

function statusClass(m) {
  const alias = m?.status?.alias;
  switch (alias) {
    case 'LIVE':
      return 'text-bg-success';
    case 'POSTPONED':
      return 'text-bg-warning';
    case 'CANCELLED':
      return 'text-bg-danger';
    case 'FINISHED':
      return 'text-bg-secondary';
    case 'SCHEDULED':
    default:
      return 'text-bg-info';
  }
}
</script>

<template>
  <div class="match-schedule">
    <div
      v-for="group in groups"
      :key="group.date.getTime()"
      class="mb-3 schedule-day"
    >
      <h2 class="h6 mb-2">{{ formatDay(group.date) }}</h2>
      <div class="table-responsive">
        <table class="table align-middle table-sm">
          <thead>
            <tr>
              <th scope="col">Команды</th>
              <th scope="col">Соревнование</th>
              <th scope="col">Группа</th>
              <th scope="col">Тур</th>
              <th scope="col">Время</th>
              <th scope="col">Стадион</th>
              <th scope="col" class="text-end">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in group.list" :key="m.id" :class="rowClass(m)">
              <td class="fw-semibold">{{ m.team1 }} — {{ m.team2 }}</td>
              <td>{{ m.tournament || '—' }}</td>
              <td>{{ m.group || '—' }}</td>
              <td>{{ m.tour || '—' }}</td>
              <td>
                <span>{{ formatTime(m.date) }}</span>
                <span
                  v-if="m.status?.name"
                  class="badge align-middle ms-2"
                  :class="statusClass(m)"
                >
                  {{ m.status.name }}
                </span>
              </td>
              <td>{{ m.stadium || '—' }}</td>
              <td class="text-end">
                <RouterLink
                  :to="`/school-matches/${m.id}`"
                  class="btn btn-sm btn-outline-primary"
                >
                  Открыть
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <p v-if="!groups.length" class="mb-0">Нет матчей.</p>
  </div>
</template>

<style scoped>
.schedule-day {
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #dee2e6;
}

.schedule-day:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

/* Ensure long names wrap nicely on smaller screens */
td,
th {
  white-space: nowrap;
}
td:nth-child(1),
td:nth-child(2) {
  white-space: normal;
}

/* Apply subtle backgrounds across table row cells */
tbody tr.state-accepted > * {
  background-color: var(--bs-success-bg-subtle, #d1e7dd) !important;
}
tbody tr.state-pending > * {
  background-color: var(--bs-warning-bg-subtle, #fff3cd) !important;
}
tbody tr.state-urgent > * {
  background-color: var(--bs-danger-bg-subtle, #f8d7da) !important;
}
</style>
