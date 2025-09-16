<script setup>
import { computed } from 'vue';

const props = defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  emptyText: { type: String, default: 'Нет данных.' },
  groupByPeriod: { type: Boolean, default: false },
  doubleProtocol: { type: Boolean, default: false },
  reasonId: { type: [String, Number, null], default: null },
  minutesValue: { type: [Number, null], default: null },
});

function computePeriodOf(it) {
  const perLen = props.doubleProtocol ? 18 : 20;
  const min = Number(it?.minute ?? 0) || 0;
  const sec = Number(it?.second ?? 0) || 0;
  const total = min * 60 + sec;
  return 1 + Math.floor(total / Math.max(1, perLen * 60));
}

const filteredSorted = computed(() => {
  const arr = (Array.isArray(props.items) ? props.items : []).filter((it) => {
    if (
      props.reasonId &&
      String(it?.violation?.id || '') !== String(props.reasonId)
    )
      return false;
    return !(
      props.minutesValue != null &&
      Number(it?.minutes_value ?? NaN) !== Number(props.minutesValue)
    );
  });
  return arr.sort((a, b) => {
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
});

function reasonText(it) {
  const viol = it?.violation || null;
  if (!viol) return '';
  return viol.full_name || viol.name || '';
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

const groups = computed(() => {
  if (!props.groupByPeriod) return [];
  const perLen = props.doubleProtocol ? 18 : 20;
  const periodLabel = (p) => {
    const start = (p - 1) * perLen;
    const end = p * perLen;
    const fmt = (m) => `${String(m).padStart(2, '0')}:00`;
    return `${p}-й период (${fmt(start)}–${fmt(end)})`;
  };
  const buckets = new Map();
  for (const it of filteredSorted.value) {
    const p = Number(computePeriodOf(it) || 0) || 0;
    const arr = buckets.get(p) || [];
    arr.push(it);
    buckets.set(p, arr);
  }
  const periods = Array.from(buckets.keys()).sort((a, b) => a - b);
  return periods.map((p) => ({
    key: String(p),
    title: periodLabel(p),
    items: buckets.get(p) || [],
  }));
});
</script>

<template>
  <div>
    <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
    <div v-else-if="loading">
      <div class="skeleton-line w-75 mb-2"></div>
      <div class="skeleton-line w-50 mb-2"></div>
      <div class="skeleton-line w-25"></div>
    </div>
    <template v-else>
      <template v-if="groupByPeriod">
        <div v-for="g in groups" :key="g.key" class="mb-3">
          <div class="text-muted small fw-semibold mb-2">{{ g.title }}</div>
          <ul class="list-unstyled mb-0">
            <li
              v-for="(p, idx) in g.items"
              :key="(p.id || idx) + '-' + (p.clock || idx)"
              class="d-flex align-items-start gap-2 mb-2"
            >
              <span
                class="badge text-bg-light border fw-semibold monospace time-badge"
                >{{ p.clock }}</span
              >
              <div class="flex-grow-1">
                <div class="d-flex align-items-center flex-wrap gap-2">
                  <span class="fw-semibold">{{
                    p.player?.full_name || 'Командный штраф'
                  }}</span>
                  <span
                    v-if="durationPrime(p)"
                    class="badge rounded-pill bg-danger-subtle text-danger border"
                    :title="durationText(p)"
                    aria-label="Штрафные минуты"
                    >{{ durationPrime(p) }}</span
                  >
                </div>
                <div
                  v-if="reasonText(p) || durationText(p)"
                  class="text-muted small"
                >
                  <span v-if="reasonText(p)">{{ reasonText(p) }}</span>
                  <span v-if="reasonText(p) && durationText(p)"> • </span>
                  <span v-if="durationText(p)">{{ durationText(p) }}</span>
                </div>
              </div>
            </li>
          </ul>
        </div>
        <div
          v-if="!groups.length || !groups.some((g) => g.items.length)"
          class="text-muted small"
        >
          {{ emptyText }}
        </div>
      </template>
      <ul v-else class="list-unstyled mb-0">
        <li
          v-for="(p, idx) in filteredSorted"
          :key="(p.id || idx) + '-' + (p.clock || idx)"
          class="d-flex align-items-start gap-2 mb-2"
        >
          <span
            class="badge text-bg-light border fw-semibold monospace time-badge"
            >{{ p.clock }}</span
          >
          <div class="flex-grow-1">
            <div class="d-flex align-items-center flex-wrap gap-2">
              <span class="fw-semibold">{{
                p.player?.full_name || 'Командный штраф'
              }}</span>
              <span
                v-if="durationPrime(p)"
                class="badge rounded-pill bg-danger-subtle text-danger border"
                :title="durationText(p)"
                aria-label="Штрафные минуты"
                >{{ durationPrime(p) }}</span
              >
            </div>
            <div
              v-if="reasonText(p) || durationText(p)"
              class="text-muted small"
            >
              <span v-if="reasonText(p)">{{ reasonText(p) }}</span>
              <span v-if="reasonText(p) && durationText(p)"> • </span>
              <span v-if="durationText(p)">{{ durationText(p) }}</span>
            </div>
          </div>
        </li>
        <li v-if="!filteredSorted.length" class="text-muted small">
          {{ emptyText }}
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.monospace {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
}
.time-badge {
  min-width: 3.25rem;
  text-align: center;
}
</style>
