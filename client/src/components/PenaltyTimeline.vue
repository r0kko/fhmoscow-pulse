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
    <div class="row mb-2 small text-muted">
      <div class="col text-end pe-4">{{ homeLabel }}</div>
      <div class="col ps-4">{{ awayLabel }}</div>
    </div>
    <div v-for="g in groups" :key="g.period" class="mb-4">
      <div class="text-muted small fw-semibold mb-2">
        {{ periodTitle(g.period) }}
      </div>
      <div class="timeline">
        <div
          v-for="(ev, idx) in g.events"
          :key="(ev.id || idx) + '-' + (ev.clock || idx)"
          class="timeline-row"
        >
          <div class="side left">
            <div v-if="ev.side === 'home'" class="event-item text-end">
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
            <span class="time-pill monospace" :title="`Время по протоколу`">{{ ev.clock }}</span>
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
.timeline-row { display: grid; grid-template-columns: 1fr 110px 1fr; align-items: center; gap: 0.5rem; margin: 0.5rem 0; }
.divider { position: relative; display: flex; align-items: center; justify-content: center; height: 100%; min-height: 2.25rem; }
.divider::before { content: ''; position: absolute; left: 50%; top: -0.75rem; bottom: -0.75rem; width: 2px; background: var(--bs-border-color); transform: translateX(-50%); }
.time-pill { background: var(--bs-light, #f8f9fa); border: 1px solid var(--bs-border-color); border-radius: 999px; padding: 0.125rem 0.5rem; font-size: 0.75rem; color: var(--bs-secondary-color); position: relative; z-index: 1; }
.event-item { padding: 0.25rem 0; }
.side.left {
  text-align: right;
}
.side.right {
  text-align: left;
}
@media (max-width: 575.98px) {
  .timeline-row { grid-template-columns: 1fr 90px 1fr; }
}
</style>
