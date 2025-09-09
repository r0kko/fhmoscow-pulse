<script setup>
import { computed } from 'vue';

const props = defineProps({
  items: { type: Array, default: () => [] },
  doubleProtocol: { type: Boolean, default: false },
  homeLabel: { type: String, default: 'Хозяева' },
  awayLabel: { type: String, default: 'Гости' },
});

function computePeriodOf(it) {
  const perLen = props.doubleProtocol ? 18 : 20;
  const min = Number(it?.minute ?? 0) || 0;
  const sec = Number(it?.second ?? 0) || 0;
  const total = min * 60 + sec;
  return 1 + Math.floor(total / Math.max(1, perLen * 60));
}

function durationText(it) {
  if (it?.minutes_value != null) return `${it.minutes_value} мин`;
  return it?.minutes?.name || '';
}
function durationPrime(it) {
  if (it?.minutes_value != null) return `${it.minutes_value}’`;
  const name = it?.minutes?.name || '';
  const m = String(name).match(/\d+/);
  return m ? `${m[0]}’` : '';
}
function reasonText(it) {
  const v = it?.violation || null;
  return v?.full_name || v?.name || '';
}

const groups = computed(() => {
  const arr = Array.isArray(props.items) ? props.items.slice() : [];
  arr.sort((a, b) => {
    const ap = computePeriodOf(a);
    const bp = computePeriodOf(b);
    if (ap !== bp) return ap - bp;
    const am = a.minute ?? 0;
    const bm = b.minute ?? 0;
    if (am !== bm) return am - bm;
    const as = a.second ?? 0;
    const bs = b.second ?? 0;
    if (as !== bs) return as - bs;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
  const byPeriod = new Map();
  for (const it of arr) {
    const p = computePeriodOf(it);
    const group = byPeriod.get(p) || { period: p, events: [] };
    group.events.push(it);
    byPeriod.set(p, group);
  }
  return Array.from(byPeriod.values()).sort((a, b) => a.period - b.period);
});

const periodTitle = (p) => {
  const perLen = props.doubleProtocol ? 18 : 20;
  const start = (p - 1) * perLen;
  const end = p * perLen;
  const fmt = (m) => `${String(m).padStart(2, '0')}:00`;
  return `${p}-й период (${fmt(start)}–${fmt(end)})`;
};
</script>

<template>
  <div class="penalty-timeline">
    <div class="row mb-2 small text-muted d-none d-sm-flex">
      <div class="col text-end pe-4">{{ homeLabel }}</div>
      <div class="col ps-4">{{ awayLabel }}</div>
    </div>
    <div v-for="g in groups" :key="g.period" class="mb-4">
      <div class="text-muted small fw-semibold mb-2">
        {{ periodTitle(g.period) }}
      </div>
      <div class="timeline" role="list" aria-label="Штрафы по периодам">
        <div
          v-for="(ev, idx) in g.events"
          :key="(ev.id || idx) + '-' + (ev.clock || idx)"
          class="timeline-row"
          role="listitem"
          :aria-label="
            `Штраф: ${ev.clock || ''}, ` +
            (ev.side === 'home'
              ? homeLabel || 'Хозяева'
              : ev.side === 'away'
                ? awayLabel || 'Гости'
                : 'Без стороны') +
            (ev.player?.full_name
              ? ', игрок ' + ev.player.full_name
              : ev.team_penalty
                ? ', командный штраф'
                : '') +
            (ev.violation?.full_name
              ? ', причина: ' + ev.violation.full_name
              : '') +
            (ev.minutes_value
              ? ', длительность ' + ev.minutes_value + ' минут'
              : '')
          "
        >
          <div class="side left">
            <div v-if="ev.side === 'home'" class="event-item text-end">
              <div class="side-label d-sm-none text-muted small">
                {{ homeLabel }}
              </div>
              <span
                v-if="durationPrime(ev)"
                class="badge rounded-pill bg-danger-subtle text-danger border me-2"
                :title="durationText(ev)"
                >{{ durationPrime(ev) }}</span
              >
              <span class="fw-semibold">
                <i
                  v-if="ev.team_penalty"
                  class="bi bi-people-fill text-danger me-1"
                  aria-hidden="true"
                ></i>
                {{ ev.player?.full_name || 'Командный штраф' }}
              </span>
              <div v-if="reasonText(ev)" class="text-muted small">
                {{ reasonText(ev) }}
              </div>
            </div>
          </div>
          <div class="divider">
            <span class="time-pill monospace" :title="`Время по протоколу`">{{
              ev.clock
            }}</span>
            <div v-if="!ev.side" class="event-item text-center mt-2">
              <span class="fw-semibold">
                <i
                  v-if="ev.team_penalty"
                  class="bi bi-people-fill text-danger me-1"
                  aria-hidden="true"
                ></i>
                {{ ev.player?.full_name || 'Командный штраф' }}
              </span>
              <span
                v-if="durationPrime(ev)"
                class="badge rounded-pill bg-danger-subtle text-danger border ms-2"
                :title="durationText(ev)"
                >{{ durationPrime(ev) }}</span
              >
              <div v-if="reasonText(ev)" class="text-muted small">
                {{ reasonText(ev) }}
              </div>
            </div>
          </div>
          <div class="side right">
            <div v-if="ev.side === 'away'" class="event-item text-start">
              <div class="side-label d-sm-none text-muted small">
                {{ awayLabel }}
              </div>
              <span class="fw-semibold">
                <i
                  v-if="ev.team_penalty"
                  class="bi bi-people-fill text-danger me-1"
                  aria-hidden="true"
                ></i>
                {{ ev.player?.full_name || 'Командный штраф' }}
              </span>
              <span
                v-if="durationPrime(ev)"
                class="badge rounded-pill bg-danger-subtle text-danger border ms-2"
                :title="durationText(ev)"
                >{{ durationPrime(ev) }}</span
              >
              <div v-if="reasonText(ev)" class="text-muted small">
                {{ reasonText(ev) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="!groups.length" class="text-muted small">Нет штрафов.</div>
  </div>
</template>

<style scoped>
.monospace {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
}
.timeline {
  position: relative;
}
.timeline-row {
  display: grid;
  grid-template-columns: 1fr var(--timeline-mid-width, 110px) 1fr;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0;
}
.divider {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 2.25rem;
}
.divider::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -0.75rem;
  bottom: -0.75rem;
  width: 2px;
  background: var(--bs-border-color);
  transform: translateX(-50%);
}
.time-pill {
  background: var(--bs-light, #f8f9fa);
  border: 1px solid var(--bs-border-color);
  border-radius: 999px;
  padding: 0.125rem 0.5rem;
  font-size: 0.8125rem;
  color: var(--bs-secondary-color);
  position: relative;
  z-index: 1;
}
.event-item {
  padding: 0.25rem 0;
  word-break: break-word;
}
.side.left {
  text-align: right;
}
.side.right {
  text-align: left;
}
/* XS/mobile refinements */
@media (max-width: 575.98px) {
  .timeline-row {
    --timeline-mid-width: clamp(82px, 22vw, 96px);
  }
  .time-pill {
    font-size: 0.875rem;
    padding: 0.125rem 0.6rem;
  }
  .side-label {
    margin-bottom: 0.125rem;
  }
}
</style>
