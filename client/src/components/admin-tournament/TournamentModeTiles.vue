<script setup lang="ts">
import { computed } from 'vue';

import BaseTile from '../BaseTile.vue';
import { auth } from '../../auth';
import { ADMINISTRATOR_ROLES, hasRole } from '../../utils/roles';

const props = defineProps<{
  activeMode: 'structure' | 'schedule' | 'settings' | 'payments';
  tournamentId: string;
}>();

const tiles = [
  {
    key: 'structure',
    title: 'Структура',
    subtitle: 'Этапы, группы, команды',
    icon: 'bi-diagram-3',
  },
  {
    key: 'schedule',
    title: 'Расписание',
    subtitle: 'Календарь и управление матчами',
    icon: 'bi-calendar3',
  },
  {
    key: 'settings',
    title: 'Настройки',
    subtitle: 'Параметры турнира и судейства',
    icon: 'bi-sliders2',
  },
  {
    key: 'payments',
    title: 'Оплата судей',
    subtitle: 'Нормы оплаты и начисления',
    icon: 'bi-cash-stack',
  },
] as const;

const visibleTiles = computed(() =>
  tiles.filter((tile) => {
    if (tile.key !== 'payments') return true;
    return hasRole(auth.roles, ADMINISTRATOR_ROLES);
  })
);

function tileTo(mode: string) {
  return `/admin/tournaments/${props.tournamentId}/${mode}`;
}
</script>

<template>
  <div class="row g-2 mb-3">
    <div
      v-for="tile in visibleTiles"
      :key="tile.key"
      class="col-12 col-md-6 col-xl-4"
    >
      <BaseTile
        :to="tileTo(tile.key)"
        v-bind="{ ariaLabel: `Открыть раздел ${tile.title}` }"
        :extra-class="[
          'h-100 mode-tile',
          props.activeMode === tile.key ? 'mode-tile--active' : '',
        ]"
      >
        <div class="card-body">
          <div class="d-flex align-items-start justify-content-between">
            <div>
              <div class="fw-semibold">{{ tile.title }}</div>
              <div class="small text-muted mt-1">{{ tile.subtitle }}</div>
            </div>
            <i :class="`bi ${tile.icon} fs-4 text-brand`"></i>
          </div>
        </div>
      </BaseTile>
    </div>
  </div>
</template>

<style scoped>
.mode-tile {
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.mode-tile .card-body {
  min-height: 110px;
}

.mode-tile--active {
  border-color: var(--brand-color) !important;
  background: rgba(17, 56, 103, 0.06);
}

.mode-tile--active .text-muted {
  color: rgba(17, 56, 103, 0.92) !important;
}
</style>
