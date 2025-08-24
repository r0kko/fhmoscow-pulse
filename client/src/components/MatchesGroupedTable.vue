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
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in group.list" :key="m.id">
              <td class="fw-semibold">{{ m.team1 }} — {{ m.team2 }}</td>
              <td>{{ m.tournament || '—' }}</td>
              <td>{{ m.group || '—' }}</td>
              <td>{{ m.tour || '—' }}</td>
              <td>{{ formatTime(m.date) }}</td>
              <td>{{ m.stadium || '—' }}</td>
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
</style>
