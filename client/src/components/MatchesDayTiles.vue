<script setup>
import { computed } from 'vue';
import {
  toDayKey,
  formatMskDateLong,
  formatMskTimeShort,
} from '../utils/time.js';
import BaseTile from './BaseTile.vue';

const props = defineProps({
  items: { type: Array, default: () => [] },
  showActions: { type: Boolean, default: true },
  showDayHeader: { type: Boolean, default: true },
  noScroll: { type: Boolean, default: false },
  // Base path for details links, e.g., '/school-matches' or '/admin/matches'
  detailsBase: { type: String, default: '/school-matches' },
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
  // Convert Date to ISO for unified helper
  return formatMskDateLong(date.toISOString());
}

function formatTime(dateStr) {
  return formatMskTimeShort(dateStr, { placeholder: '—:—' });
}

function rowClass(m) {
  // Row background states removed per new UX (use status pill instead)
  return '';
}

// Compute UI-facing status combining schedule state and time proximity
function computeUiStatus(m) {
  const alias = (m?.status?.alias || '').toUpperCase();
  // Non-schedulable statuses always prevail over frontend states
  const schedulable = !['CANCELLED', 'FINISHED', 'LIVE', 'POSTPONED'].includes(
    alias
  );
  // Past matches: always show backend-provided status
  const ts = new Date(m?.date || '').getTime();
  const isPast = isFinite(ts) && ts < Date.now();
  if (isPast)
    return { text: m?.status?.name || '—', cls: statusPillClassByAlias(alias) };
  const agreed = Boolean(m?.agreement_accepted);
  const pending = Boolean(m?.agreement_pending);
  if (!schedulable) {
    // Keep backend statuses like POSTPONED/CANCELLED/LIVE/FINISHED as-is
    return { text: m?.status?.name || '—', cls: statusPillClassByAlias(alias) };
  }
  if (agreed) {
    // Only when time is agreed
    return { text: 'По расписанию', cls: 'pill pill-success' };
  }
  const diffMs = new Date(m?.date || '').getTime() - Date.now();
  const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
  const soon = isFinite(diffMs) && diffMs >= 0 && diffMs < tenDaysMs;
  if (pending || soon) {
    // Call-to-action either due to pending request or proximity
    return { text: 'Согласуйте время', cls: 'pill pill-warning' };
  }
  // Far away and not yet agreed
  return { text: 'Согласование времени', cls: 'pill pill-muted' };
}

function gameMetaLine(m) {
  const parts = [m.tournament, m.group, m.tour]
    .map((s) => (s || '').toString().trim())
    .filter(Boolean);
  return parts.join(' · ');
}

function isStatusReplacingSchedule(m) {
  const alias = (m?.status?.alias || '').toUpperCase();
  return alias === 'POSTPONED' || alias === 'CANCELLED';
}

function statusPillClassByAlias(alias) {
  switch (alias) {
    case 'POSTPONED':
      return 'pill pill-warning';
    case 'CANCELLED':
      return 'pill pill-danger';
    case 'LIVE':
      return 'pill pill-info';
    case 'FINISHED':
      return 'pill pill-success';
    case 'SCHEDULED':
    default:
      return 'pill pill-muted';
  }
}
</script>

<template>
  <div class="day-tiles">
    <BaseTile
      v-for="group in groups"
      :key="group.date.getTime()"
      :section="true"
      class="day-tile"
      :extra-class="['fade-in']"
    >
      <div
        v-if="props.showDayHeader"
        class="card-header bg-white border-0 py-2 px-3 sticky-top"
      >
        <h2 class="h6 mb-0 text-muted fw-semibold day-title">
          {{ formatDay(group.date) }}
        </h2>
      </div>
      <div class="tile-body py-2 px-2" :class="{ 'no-scroll': props.noScroll }">
        <div
          class="grid-table"
          :class="{ 'no-actions': !props.showActions }"
          role="table"
          aria-label="Список матчей за день"
        >
          <div class="grid-header" role="row">
            <div class="cell col-teams" role="columnheader">Матч</div>
            <div class="cell col-status" role="columnheader">Статус</div>
            <div class="cell col-time" role="columnheader">Время</div>
            <div class="cell col-stadium" role="columnheader">Стадион</div>
            <div
              v-if="props.showActions"
              class="cell col-actions text-end"
              role="columnheader"
            >
              Действия
            </div>
          </div>
          <div v-for="m in group.list" :key="m.id" class="grid-row" role="row">
            <div class="cell col-teams" role="cell">
              <div class="teams-line" :title="`${m.team1} — ${m.team2}`">
                {{ m.team1 }} — {{ m.team2 }}
              </div>
              <div
                v-if="gameMetaLine(m)"
                class="meta-line"
                :title="gameMetaLine(m)"
              >
                {{ gameMetaLine(m) }}
              </div>
            </div>
            <div class="cell col-status" role="cell">
              <span
                class="status-pill"
                :class="computeUiStatus(m).cls"
                :title="m.status?.name || computeUiStatus(m).text"
              >
                <i
                  v-if="(m.status?.alias || '').toUpperCase() === 'POSTPONED'"
                  class="bi bi-arrow-repeat icon-pin me-1"
                  aria-hidden="true"
                ></i>
                <i
                  v-else-if="
                    (m.status?.alias || '').toUpperCase() === 'CANCELLED'
                  "
                  class="bi bi-x-octagon icon-pin me-1"
                  aria-hidden="true"
                ></i>
                <i
                  v-else-if="computeUiStatus(m).text === 'По расписанию'"
                  class="bi bi-check2-circle icon-pin me-1"
                  aria-hidden="true"
                ></i>
                <i
                  v-else-if="computeUiStatus(m).text === 'Согласуйте время'"
                  class="bi bi-exclamation-circle icon-pin me-1"
                  aria-hidden="true"
                ></i>
                <i
                  v-else-if="computeUiStatus(m).text === 'Согласование времени'"
                  class="bi bi-hourglass-split icon-pin me-1"
                  aria-hidden="true"
                ></i>
                {{ computeUiStatus(m).text }}
              </span>
            </div>
            <div class="cell col-time" role="cell">
              <template v-if="isStatusReplacingSchedule(m)">—</template>
              <template v-else>
                <i class="bi bi-clock icon-muted me-1" aria-hidden="true"></i>
                {{ formatTime(m.date) }}
              </template>
            </div>
            <div class="cell col-stadium" role="cell" :title="m.stadium || ''">
              <template v-if="!isStatusReplacingSchedule(m)">
                <i class="bi bi-geo-alt icon-muted me-1" aria-hidden="true"></i>
                {{ m.stadium || '—' }}
              </template>
              <template v-else>—</template>
            </div>
            <div
              v-if="props.showActions"
              class="cell col-actions text-end"
              role="cell"
            >
              <RouterLink
                :to="`${props.detailsBase}/${m.id}`"
                class="btn btn-link p-0 text-primary"
                :title="`Открыть карточку матча`"
                aria-label="Открыть карточку матча"
              >
                <i class="bi bi-arrow-right-circle" aria-hidden="true"></i>
                <span class="visually-hidden">Открыть</span>
              </RouterLink>
            </div>
          </div>
        </div>
      </div>
    </BaseTile>
    <p v-if="!groups.length" class="mb-0">Нет матчей.</p>
  </div>
</template>

<style scoped>
.day-tiles {
  display: grid;
  gap: 1rem; /* align with gap-3 scale */
}

.day-tile {
  border-radius: var(--radius-tile);
  border: 1px solid var(--border-subtle);
  overflow: hidden;
}

.tile-body {
  padding: var(--tile-padding); /* align inner padding with section-card */
  /* Allow long day to scroll while keeping header in view */
  max-height: 440px;
  overflow: auto;
}

.tile-body.no-scroll {
  max-height: none;
  overflow: visible;
}

/* Grid table with synchronized columns across tiles via fixed template */
.grid-table {
  display: grid;
  /* Columns: Match | Status | Time | Stadium | Actions */
  grid-template-columns:
    minmax(0, 2.6fr)
    minmax(0, 1.5fr)
    minmax(0, 1.1fr)
    minmax(0, 1.6fr)
    minmax(0, 0.9fr);
  row-gap: 0.25rem;
}

.grid-table.no-actions {
  /* Without actions column, re-distribute space */
  grid-template-columns:
    minmax(0, 2.8fr)
    minmax(0, 1.5fr)
    minmax(0, 1.1fr)
    minmax(0, 2fr);
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
  white-space: normal;
}

/* Vertically center status pin, time and stadium within the row */
.col-status,
.col-time,
.col-stadium {
  display: flex;
  align-items: center;
  /* ensure a comfortable touch target without affecting row auto-height */
  min-height: 2rem;
}

/* Allow grid children to shrink so ellipsis works */
.col-teams,
.col-status,
.col-time,
.col-stadium,
.col-actions {
  min-width: 0;
}

.grid-header .cell {
  font-size: 0.875rem;
  color: #6c757d;
  background: linear-gradient(#fff, #fff);
}

.icon-muted {
  color: #6c757d;
}

/* Row background highlighting removed per new UX */

.col-teams {
  white-space: normal;
}
.teams-line {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
}
.meta-line {
  color: #6c757d;
  font-size: 0.875rem;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  font-size: 0.875rem;
  line-height: 1.2;
  min-height: 1.5rem;
}
.status-pill {
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pill .icon-pin {
  font-size: 0.9em;
  opacity: 0.9;
  flex-shrink: 0;
}
.pill .icon-pin {
  font-size: 0.9em;
  opacity: 0.9;
}
.status-pill.pill-warning {
  background: var(--bs-warning-bg-subtle, #fff3cd);
  color: var(--bs-warning-text, #664d03);
  border-color: rgba(255, 193, 7, 0.35);
}
.status-pill.pill-danger {
  background: var(--bs-danger-bg-subtle, #f8d7da);
  color: var(--bs-danger-text, #842029);
  border-color: rgba(220, 53, 69, 0.35);
}
.status-pill.pill-info {
  background: var(--bs-info-bg-subtle, #cff4fc);
  color: var(--bs-info-text, #055160);
  border-color: rgba(13, 202, 240, 0.35);
}
.status-pill.pill-success {
  background: var(--bs-success-bg-subtle, #d1e7dd);
  color: var(--bs-success-text, #0f5132);
  border-color: rgba(25, 135, 84, 0.35);
}
.status-pill.pill-muted {
  background: #f1f3f5;
  color: #495057;
}
/* time displayed inline without pill */

/* Responsive: карточный подход на мобильных */
@media (max-width: 575.98px) {
  /* Mobile: remove inner scroll within a day and disable sticky header */
  .card-header.sticky-top {
    position: static !important;
  }
  .tile-body {
    max-height: none;
    overflow: visible;
  }
  .grid-header {
    display: none;
  }
  .grid-table {
    display: block;
  }
  .grid-row {
    display: block;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.5rem;
    box-shadow: var(--shadow-tile);
    background: #fff;
  }
  /* No special state background on mobile either */
  .cell {
    border-bottom: 0;
    padding: 0.125rem 0;
  }
  .col-teams {
    font-weight: 600;
    margin-bottom: 0.125rem;
    white-space: normal;
  }
  .meta-line {
    font-size: 0.8125rem;
  }
  .col-status,
  .col-time,
  .col-stadium {
    display: inline-block;
    color: #6c757d;
    font-size: 0.875rem;
  }
  .col-status {
    margin-right: 0.5rem;
  }
  .d-none-sm {
    display: none;
  }
}

.day-title {
  letter-spacing: 0.1px;
}
</style>
