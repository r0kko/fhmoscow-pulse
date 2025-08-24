<script setup>
import { computed } from 'vue';
import { RouterLink as Link } from 'vue-router';

const props = defineProps({
  season: { type: Object, required: true },
  clubId: { type: String, required: true },
});

const labeledTeams = computed(() => {
  const list = (props.season.teams || []).filter((t) =>
    Number.isFinite(t.birth_year)
  );
  const byYear = new Map();
  for (const t of list) {
    if (!byYear.has(t.birth_year)) byYear.set(t.birth_year, []);
    byYear.get(t.birth_year).push(t);
  }
  const result = [];
  for (const [year, arr] of byYear.entries()) {
    arr.sort((a, b) =>
      (a.team_name || '').localeCompare(b.team_name || '', 'ru')
    );
    arr.forEach((t, idx) => {
      const label = idx === 0 ? String(year) : `${year} - ${idx + 1}`;
      result.push({ ...t, display_label: label });
    });
  }
  // Sort final tiles by birth_year desc then label (младшие → старшие)
  result.sort((a, b) => {
    if (a.birth_year !== b.birth_year)
      return (b.birth_year || 0) - (a.birth_year || 0);
    return (a.display_label || '').localeCompare(b.display_label || '', 'ru');
  });
  return result;
});
</script>

<template>
  <div class="row g-3">
    <div
      v-for="t in labeledTeams"
      :key="t.team_id + '-' + t.display_label"
      class="col-12 col-md-6 col-lg-3 team-tile-col"
    >
      <component
        :is="(t.player_count || 0) > 0 ? Link : 'div'"
        :to="
          (t.player_count || 0) > 0
            ? {
                path: `/school-players/season/${season.id}/year/${t.birth_year}`,
                query: { club_id: clubId, team_id: t.team_id },
              }
            : null
        "
        class="card section-card tile h-100 fade-in shadow-sm text-decoration-none text-body"
        :class="{ 'text-muted disabled-card': !(t.player_count || 0) > 0 }"
        :aria-label="`${t.display_label}, заявлено: ${t.player_count || 0}`"
        :aria-disabled="!(t.player_count || 0) > 0 ? 'true' : null"
      >
        <div class="card-body">
          <div class="card-title mb-1 fw-semibold">{{ t.display_label }}</div>
          <div
            class="card-text text-muted small mb-2 d-flex align-items-center flex-wrap gap-3"
          >
            <span class="d-inline-flex align-items-center gap-1">
              <i class="bi bi-people text-brand" aria-hidden="true"></i>
              Заявлено: {{ t.player_count || 0 }}
            </span>
            <span class="d-inline-flex align-items-center gap-1">
              <i class="bi bi-trophy text-brand" aria-hidden="true"></i>
              Турниров: {{ (t.tournaments || []).length }}
            </span>
          </div>
          <div v-if="(t.tournaments || []).length" class="tournaments-list">
            <div
              v-for="r in t.tournaments"
              :key="r.name + '-' + (r.group_name || '')"
              class="tournament-row small"
            >
              <i class="bi bi-trophy me-1 text-brand" aria-hidden="true"></i>
              <span class="tournament-name">{{ r.name }}</span>
              <span
                v-if="r.group_name"
                class="tournament-group text-muted ms-2 d-inline-flex align-items-center"
              >
                <i class="bi bi-diagram-3 me-1" aria-hidden="true"></i>
                {{ r.group_name }}
              </span>
            </div>
          </div>
          <div v-else class="text-muted small">Нет турниров</div>
        </div>
      </component>
    </div>
  </div>
</template>

<style scoped>
.team-tile-col {
  min-width: 0;
  width: 100%;
}
@media (max-width: 767.98px) {
  .team-tile-col {
    flex: 0 0 100% !important;
    max-width: 100% !important;
  }
}
.disabled-card {
  cursor: default;
  opacity: 0.65;
}
.disabled-card:hover {
  transform: none;
  box-shadow: none;
}
.tournaments-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  border-top: 1px solid #f1f3f5;
  padding-top: 0.5rem;
}
.tournament-row .tournament-name,
.tournament-row .tournament-group {
  overflow-wrap: anywhere;
}
</style>
