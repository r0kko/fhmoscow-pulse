<script setup>
import { computed } from 'vue';
import { MOSCOW_TZ } from '../utils/time';

const props = defineProps({
  items: { type: Array, default: () => [] },
  isHome: { type: Boolean, default: false },
  isAway: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  actionsDisabled: { type: Boolean, default: false },
});

defineEmits(['approve', 'decline', 'withdraw']);

function canAct(a) {
  if (!a || a.MatchAgreementStatus?.alias !== 'PENDING') return false;
  const type = a.MatchAgreementType?.alias;
  if (type === 'HOME_PROPOSAL') return props.isAway;
  if (type === 'AWAY_COUNTER') return props.isHome;
  return false;
}

function badgeClass(alias) {
  switch (alias) {
    case 'PENDING':
      return 'bg-warning text-dark';
    case 'ACCEPTED':
      return 'bg-success';
    case 'DECLINED':
      return 'bg-danger';
    case 'WITHDRAWN':
      return 'bg-secondary-subtle text-secondary border';
    case 'SUPERSEDED':
    default:
      return 'bg-light text-muted border';
  }
}

function formatTimeMsk(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: MOSCOW_TZ,
  });
}

const timeline = computed(() => {
  const list = Array.isArray(props.items) ? props.items : [];
  return list.slice().sort((a, b) => {
    const at = new Date(a.createdAt || a.created_at || 0).getTime();
    const bt = new Date(b.createdAt || b.created_at || 0).getTime();
    const as = Number.isNaN(at) ? 0 : at;
    const bs = Number.isNaN(bt) ? 0 : bt;
    return as - bs;
  });
});

function formatEventDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: MOSCOW_TZ,
  });
}
</script>

<template>
  <ol class="timeline list-unstyled mb-0" aria-live="polite">
    <li v-for="a in timeline" :key="a.id" class="timeline-item">
      <div class="timeline-marker" aria-hidden="true"></div>
      <div class="timeline-content">
        <div
          class="d-flex justify-content-between align-items-start gap-2 flex-wrap"
        >
          <div>
            <div class="mb-1">
              <span class="badge bg-secondary me-2">{{
                a.MatchAgreementType?.name
              }}</span>
              <span
                class="badge"
                :class="badgeClass(a.MatchAgreementStatus?.alias)"
                >{{ a.MatchAgreementStatus?.name }}</span
              >
            </div>
            <div class="small text-muted d-flex flex-column gap-1">
              <div>
                <i class="bi bi-calendar2-check me-1" aria-hidden="true"></i>
                Создано:
                <time
                  :datetime="a.createdAt || a.created_at"
                  :title="a.createdAt || a.created_at"
                >
                  {{ formatEventDate(a.createdAt || a.created_at) }}
                </time>
              </div>
              <div>
                <i class="bi bi-clock me-1" aria-hidden="true"></i>
                Назначено:
                <time :datetime="a.date_start" :title="a.date_start">
                  {{ formatTimeMsk(a.date_start) }}
                </time>
              </div>
              <div>
                <i class="bi bi-geo-alt me-1" aria-hidden="true"></i>
                {{ a.Ground?.name || '—' }}
              </div>
              <div v-if="a.Author">
                <i class="bi bi-person me-1" aria-hidden="true"></i>
                Автор: {{ a.Author.last_name || '' }}
                {{ a.Author.first_name || '' }}
                {{ a.Author.patronymic || '' }}
              </div>
            </div>
          </div>
          <div
            v-if="!actionsDisabled && canAct(a)"
            class="d-flex gap-2"
            :aria-busy="submitting ? 'true' : 'false'"
          >
            <button
              class="btn btn-sm btn-brand"
              :disabled="submitting || actionsDisabled"
              :aria-disabled="submitting ? 'true' : 'false'"
              :aria-label="`Согласовать: ${formatTimeMsk(a.date_start)} — ${a.Ground?.name || 'стадион не указан'}`"
              @click="$emit('approve', a.id)"
            >
              <span
                v-if="submitting"
                class="spinner-border spinner-border-sm me-1"
              ></span>
              Согласовать
            </button>
            <button
              class="btn btn-sm btn-outline-danger"
              :disabled="submitting || actionsDisabled"
              :aria-disabled="submitting ? 'true' : 'false'"
              :aria-label="`Отклонить: ${formatTimeMsk(a.date_start)} — ${a.Ground?.name || 'стадион не указан'}`"
              @click="$emit('decline', a.id)"
            >
              Отклонить
            </button>
          </div>
          <div
            v-else-if="
              !actionsDisabled &&
              a.MatchAgreementStatus?.alias === 'PENDING' &&
              ((a.MatchAgreementType?.alias === 'HOME_PROPOSAL' && isHome) ||
                (a.MatchAgreementType?.alias === 'AWAY_COUNTER' && isAway))
            "
          >
            <button
              class="btn btn-sm btn-outline-brand"
              :disabled="submitting || actionsDisabled"
              :aria-disabled="submitting ? 'true' : 'false'"
              :aria-label="`Отозвать: ${formatTimeMsk(a.date_start)} — ${a.Ground?.name || 'стадион не указан'}`"
              @click="$emit('withdraw', a.id)"
            >
              <span
                v-if="submitting"
                class="spinner-border spinner-border-sm me-1"
              ></span>
              Отозвать
            </button>
          </div>
        </div>
      </div>
    </li>
    <li v-if="!timeline.length" class="text-muted small" role="status">
      Предложений пока нет.
    </li>
  </ol>
</template>

<style scoped>
.timeline {
  position: relative;
  padding-left: 1rem;
}
.timeline::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 0.25rem;
  bottom: 0.25rem;
  width: 2px;
  background: #e9ecef;
}
.timeline-item {
  position: relative;
  margin-bottom: 1rem;
}
.timeline-marker {
  position: absolute;
  left: 0;
  top: 0.2rem;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--brand-color, #113867);
}
.timeline-content {
  margin-left: 1.5rem;
}
</style>
