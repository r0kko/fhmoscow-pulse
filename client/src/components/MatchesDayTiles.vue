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
  // When true, renders a dedicated score column (used on past matches page)
  showScoreAsColumn: { type: Boolean, default: false },
  // Mobile row style: 'card' (default) or 'divider' to separate rows with hairline dividers
  mobileStyle: { type: String, default: 'card' },
  // Sort direction for groups and items: 'asc' (default) or 'desc'
  sortDirection: { type: String, default: 'asc' },
});

const groups = computed(() => {
  const map = new Map();
  (props.items || []).forEach((m) => {
    const key = toDayKey(m.date);
    if (!map.has(key)) map.set(key, { date: new Date(key), list: [] });
    map.get(key).list.push(m);
  });
  const dir = (props.sortDirection || 'asc').toLowerCase() === 'desc' ? -1 : 1;
  return [...map.values()]
    .sort((a, b) => dir * (a.date - b.date))
    .map((g) => {
      // Always sort matches within the day in ascending order by kickoff time
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
  if (isPast) {
    // Technical result dominates over any status (perspective-aware)
    const tech = (m?.technical_winner || '').toLowerCase();
    if (tech === 'home' || tech === 'away') {
      const viewerHome = !!m?.is_home;
      const viewerAway = !!m?.is_away;
      const won =
        (viewerHome && tech === 'home') || (viewerAway && tech === 'away');
      const lost =
        (viewerHome && tech === 'away') || (viewerAway && tech === 'home');
      if (won) return { text: 'Тех. победа', cls: 'pill pill-success' };
      if (lost) return { text: 'Тех. поражение', cls: 'pill pill-danger' };
      // Unknown side for viewer: show neutral winner
      return tech === 'home'
        ? { text: 'Тех. победа', cls: 'pill pill-success' }
        : { text: 'Тех. поражение', cls: 'pill pill-danger' };
    }
    if (alias === 'CANCELLED' || alias === 'POSTPONED')
      return {
        text: m?.status?.name || '—',
        cls: statusPillClassByAlias(alias),
      };
    const outcome = computeOutcome(m, alias);
    if (outcome === 'WIN') return { text: 'Победа', cls: 'pill pill-success' };
    if (outcome === 'LOSS')
      return { text: 'Поражение', cls: 'pill pill-danger' };
    if (outcome === 'DRAW') return { text: 'Ничья', cls: 'pill pill-info' };
    return { text: m?.status?.name || '—', cls: statusPillClassByAlias(alias) };
  }
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

function computeOutcome(m, alias) {
  // Compute WIN/LOSS/DRAW from the viewer's perspective for finished games only
  if ((alias || '').toUpperCase() !== 'FINISHED') return null;
  const a = Number(m?.score_team1);
  const b = Number(m?.score_team2);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (m?.is_both_teams) return 'DRAW';
  const isHome = !!m?.is_home;
  const isAway = !!m?.is_away;
  if (a === b) return 'DRAW';
  if (isHome) return a > b ? 'WIN' : 'LOSS';
  if (isAway) return b > a ? 'WIN' : 'LOSS';
  // Unknown side: avoid misleading result
  return null;
}

function formatScore(m) {
  const ts = new Date(m?.date || '').getTime();
  const isPast = isFinite(ts) && ts < Date.now();
  const tech = (m?.technical_winner || '').toLowerCase();
  if (isPast && (tech === 'home' || tech === 'away'))
    return tech === 'home' ? '+/-' : '-/+';
  const a = m?.score_team1;
  const b = m?.score_team2;
  if (a == null || b == null) return '';
  const safeA = Number.isFinite(Number(a)) ? String(a) : '';
  const safeB = Number.isFinite(Number(b)) ? String(b) : '';
  if (!safeA || !safeB) return '';
  return `${safeA}:${safeB}`;
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
          :class="{
            'no-actions': !props.showActions,
            'with-score': props.showScoreAsColumn,
            'mobile-divider': props.mobileStyle === 'divider',
          }"
          role="table"
          aria-label="Список матчей за день"
        >
          <div class="grid-header" role="row">
            <div class="cell col-teams" role="columnheader">Матч</div>
            <div class="cell col-status" role="columnheader">Статус</div>
            <div
              v-if="props.showScoreAsColumn"
              class="cell col-score"
              role="columnheader"
            >
              Счёт
            </div>
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
            <!-- Mobile: make entire row clickable via stretched link overlay -->
            <RouterLink
              class="stretched-link d-md-none"
              :to="`${props.detailsBase}/${m.id}`"
              :aria-label="`Открыть карточку матча`"
            />
            <div class="cell col-teams" role="cell">
              <div class="teams-line" :title="`${m.team1} — ${m.team2}`">
                {{ m.team1 }} — {{ m.team2 }}
                <span
                  v-if="!props.showScoreAsColumn && formatScore(m)"
                  class="score-pill pill pill-muted ms-2"
                  >{{ formatScore(m) }}</span
                >
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
                  v-else-if="computeUiStatus(m).text === 'Тех. победа'"
                  class="bi bi-trophy-fill icon-pin me-1"
                  aria-hidden="true"
                ></i>
                <i
                  v-else-if="computeUiStatus(m).text === 'Тех. поражение'"
                  class="bi bi-emoji-frown icon-pin me-1"
                  aria-hidden="true"
                ></i>
                <i
                  v-else-if="computeUiStatus(m).text === 'Победа'"
                  class="bi bi-trophy-fill icon-pin me-1"
                  aria-hidden="true"
                ></i>
                <i
                  v-else-if="computeUiStatus(m).text === 'Ничья'"
                  class="bi bi-slash-circle icon-pin me-1"
                  aria-hidden="true"
                ></i>
                <i
                  v-else-if="computeUiStatus(m).text === 'Поражение'"
                  class="bi bi-emoji-frown icon-pin me-1"
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
            <div
              v-if="props.showScoreAsColumn"
              class="cell col-score"
              role="cell"
            >
              <template v-if="new Date(m.date).getTime() < Date.now()">
                <span
                  :class="['score-chip', formatScore(m) ? '' : 'text-muted']"
                  >{{ formatScore(m) || '—' }}</span
                >
              </template>
              <template v-else>—</template>
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
                class="btn btn-link p-0 text-primary position-relative"
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
  /* Allocate more space to teams/tournament; time is fixed-width (XX:XX) */
  grid-template-columns:
    minmax(0, 3fr)
    minmax(0, 1.4fr)
    minmax(0, 0.8fr)
    minmax(0, 1.5fr)
    minmax(0, 0.8fr);
  row-gap: 0.25rem;
}

.grid-table.no-actions {
  /* Without actions column, re-distribute space */
  grid-template-columns:
    minmax(0, 3.2fr)
    minmax(0, 1.4fr)
    minmax(0, 0.8fr)
    minmax(0, 1.6fr);
}

/* When score column is present */
.grid-table.with-score {
  /* Columns: Match | Status | Score | Time | Stadium | Actions */
  grid-template-columns:
    minmax(0, 2.7fr)
    minmax(0, 1.3fr)
    minmax(0, 0.9fr)
    minmax(0, 0.8fr)
    minmax(0, 1.5fr)
    minmax(0, 0.8fr);
}
.grid-table.with-score.no-actions {
  grid-template-columns:
    minmax(0, 3fr)
    minmax(0, 1.3fr)
    minmax(0, 0.9fr)
    minmax(0, 0.8fr)
    minmax(0, 1.6fr);
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

/* Vertically center status, score, time and stadium within the row */
.col-status,
.col-score,
.col-time,
.col-stadium {
  display: flex;
  align-items: center;
  /* ensure a comfortable touch target without affecting row auto-height */
  min-height: 2rem;
}
/* Use tabular figures for time to tighten layout */
.col-time {
  font-variant-numeric: tabular-nums;
}

/* Allow grid children to shrink so ellipsis works */
.col-teams,
.col-status,
.col-score,
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
/* Score chip */
.score-chip {
  font-weight: 600;
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
    position: relative; /* for stretched-link */
  }
  /* Divider-style rows: lighter, with hairline separators between items */
  .grid-table.mobile-divider .grid-row {
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
    padding: 0.5rem 0;
    margin-bottom: 0;
  }
  .grid-table.mobile-divider .grid-row + .grid-row {
    border-top: 1px solid var(--border-subtle);
  }
  /* Ensure actions remain clickable above stretched-link */
  .grid-table .col-actions {
    position: relative;
    z-index: 2;
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
  .col-score,
  .col-time,
  .col-stadium {
    display: inline-block;
    color: #6c757d;
    font-size: 0.875rem;
  }
  .col-status {
    margin-right: 0.5rem;
  }
  .col-score {
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
