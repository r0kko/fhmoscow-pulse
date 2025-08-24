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
  const d = new Date(dateStr);
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .formatToParts(d)
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  if (parts.hour === '00' && parts.minute === '00') return '--:--';
  return `${parts.hour}:${parts.minute}`;
}
</script>

<template>
  <div class="day-tiles">
    <div
      v-for="group in groups"
      :key="group.date.getTime()"
      class="card day-tile shadow-sm tile fade-in"
    >
      <div class="card-header bg-white border-0 py-2 px-3 sticky-top">
        <h2 class="h6 mb-0 text-muted fw-semibold day-title">
          {{ formatDay(group.date) }}
        </h2>
      </div>
      <div class="tile-body">
        <div class="grid-table" role="table" aria-label="Список матчей за день">
          <div class="grid-header" role="row">
            <div class="cell col-teams" role="columnheader">Команды</div>
            <div class="cell col-tournament" role="columnheader">
              Соревнование
            </div>
            <div class="cell col-group d-none-sm" role="columnheader">
              Группа
            </div>
            <div class="cell col-tour d-none-sm" role="columnheader">Тур</div>
            <div class="cell col-time" role="columnheader">Время</div>
            <div class="cell col-stadium" role="columnheader">Стадион</div>
          </div>
          <div v-for="m in group.list" :key="m.id" class="grid-row" role="row">
            <div
              class="cell col-teams fw-semibold"
              role="cell"
              :title="`${m.team1} — ${m.team2}`"
            >
              {{ m.team1 }} — {{ m.team2 }}
            </div>
            <div
              class="cell col-tournament"
              role="cell"
              :title="m.tournament || ''"
            >
              {{ m.tournament || '—' }}
            </div>
            <div
              class="cell col-group d-none-sm"
              role="cell"
              :title="m.group || ''"
            >
              {{ m.group || '—' }}
            </div>
            <div
              class="cell col-tour d-none-sm"
              role="cell"
              :title="m.tour || ''"
            >
              {{ m.tour || '—' }}
            </div>
            <div class="cell col-time" role="cell">
              {{ formatTime(m.date) }}
            </div>
            <div class="cell col-stadium" role="cell" :title="m.stadium || ''">
              {{ m.stadium || '—' }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <p v-if="!groups.length" class="mb-0">Нет матчей.</p>
  </div>
</template>

<style scoped>
.day-tiles {
  display: grid;
  gap: 0.75rem;
}

.day-tile {
  border-radius: 0.75rem;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.tile-body {
  padding: 0.5rem 0.75rem 0.75rem;
  /* Allow long day to scroll while keeping header in view */
  max-height: 440px;
  overflow: auto;
}

/* Grid table with synchronized columns across tiles via fixed template */
.grid-table {
  display: grid;
  /* Desktop: шире Команды, меньше Время и Группа */
  grid-template-columns: 2.4fr 1.4fr 0.8fr 0.8fr 0.7fr 1.2fr;
  row-gap: 0.25rem;
}

.grid-header {
  position: sticky;
  top: 0;
  z-index: 1;
  display: contents; /* allow header cells to align with grid columns */
}

.grid-row {
  display: contents;
}

.cell {
  padding: 0.375rem 0.25rem;
  border-bottom: 1px solid #f0f2f4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grid-header .cell {
  font-size: 0.875rem;
  color: #6c757d;
  background: linear-gradient(#fff, #fff);
}

.col-teams {
  white-space: normal;
}

/* Responsive: карточный подход на мобильных */
@media (max-width: 575.98px) {
  .grid-header {
    display: none;
  }
  .grid-table {
    display: block;
  }
  .grid-row {
    display: block;
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.5rem;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  }
  .cell {
    border-bottom: 0;
    padding: 0.125rem 0;
  }
  .col-teams {
    font-weight: 600;
    margin-bottom: 0.125rem;
    white-space: normal;
  }
  /* Бейджи: турнир, группа, тур в одну линию */
  .col-tournament,
  .col-group,
  .col-tour {
    display: inline-block;
    font-size: 0.8125rem;
    color: var(--brand-color);
    background: rgba(17, 56, 103, 0.12);
    border: 1px solid rgba(17, 56, 103, 0.2);
    border-radius: 0.375rem;
    padding: 0.125rem 0.375rem;
    margin-right: 0.25rem;
  }
  .col-time,
  .col-stadium {
    display: inline-block;
    color: #6c757d;
    font-size: 0.875rem;
  }
  .col-time::after {
    content: ' · ';
    color: #adb5bd;
  }
  .d-none-sm {
    display: none;
  }
}

.day-title {
  letter-spacing: 0.1px;
}
</style>
