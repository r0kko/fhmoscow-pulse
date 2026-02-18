<script setup lang="ts">
// @ts-nocheck
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

const props = defineProps<{
  tournament: any;
  summary: {
    stages: number;
    groups: number;
    teams: number;
    matches: number;
  };
}>();

const title = computed(() => props.tournament?.name || 'Турнир');
</script>

<template>
  <div
    class="card section-card tile fade-in shadow-sm mb-3 tournament-header-card"
  >
    <div class="card-body">
      <div
        class="d-flex justify-content-between align-items-start flex-wrap gap-3"
      >
        <div>
          <h2 class="h4 mb-1">{{ title }}</h2>
          <div class="small text-muted d-flex flex-wrap gap-2">
            <span>Сезон: {{ props.tournament?.season?.name || '—' }}</span>
            <span>Год: {{ props.tournament?.birth_year || '—' }}</span>
            <span
              v-if="props.tournament?.flags?.imported"
              class="badge text-bg-secondary"
              >Импортированный</span
            >
          </div>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <RouterLink
            class="btn btn-outline-secondary btn-sm icon-action"
            to="/admin/tournaments"
            title="К списку турниров"
            aria-label="К списку турниров"
          >
            <i class="bi bi-list-ul" aria-hidden="true"></i>
          </RouterLink>
          <RouterLink
            class="btn btn-outline-secondary btn-sm icon-action"
            :to="{
              path: '/admin/sports-calendar',
              query: { tournament: props.tournament?.name || '' },
            }"
            title="К календарю игр"
            aria-label="К календарю игр"
          >
            <i class="bi bi-calendar3" aria-hidden="true"></i>
          </RouterLink>
        </div>
      </div>

      <div class="row g-2 mt-1">
        <div class="col-6 col-lg-3">
          <div class="border rounded-3 p-2 h-100 metric-card">
            <div class="small text-muted">Этапы</div>
            <div class="h5 mb-0">{{ props.summary.stages }}</div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="border rounded-3 p-2 h-100 metric-card">
            <div class="small text-muted">Группы</div>
            <div class="h5 mb-0">{{ props.summary.groups }}</div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="border rounded-3 p-2 h-100 metric-card">
            <div class="small text-muted">Команды</div>
            <div class="h5 mb-0">{{ props.summary.teams }}</div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="border rounded-3 p-2 h-100 metric-card">
            <div class="small text-muted">Матчи</div>
            <div class="h5 mb-0">{{ props.summary.matches }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tournament-header-card {
  background:
    radial-gradient(
      circle at right top,
      rgba(17, 56, 103, 0.08),
      rgba(17, 56, 103, 0) 45%
    ),
    #fff;
}

.metric-card {
  background: rgba(17, 56, 103, 0.03);
}

.icon-action {
  min-width: 2rem;
  min-height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
