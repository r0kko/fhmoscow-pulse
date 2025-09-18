<script setup>
import { computed } from 'vue';
import BaseTile from './BaseTile.vue';

const props = defineProps({
  season: { type: Object, required: true },
  clubId: { type: String, required: true },
  // When true, tiles link to team roster page; when false, tiles are static
  linkToRoster: { type: Boolean, default: true },
  // Base path for roster route (default: staff view)
  rosterBasePath: { type: String, default: '/school-players/season' },
  // Optional map: { [teamId]: number } — grounds count to display
  groundsCountByTeamId: { type: Object, default: null },
  // Intercept click and emit 'open' while keeping active styling
  intercept: { type: Boolean, default: false },
  // Optional set/map/array of teamIds to render as disabled (light)
  disabledTeamIds: { type: [Object, Array], default: null },
});
const emit = defineEmits(['open']);

function onOpen(team) {
  if (props.linkToRoster) return;
  if (!team?.team_id) return;
  emit('open', {
    teamId: team.team_id,
    teamName: team.team_name || '',
    teamYear: team.birth_year,
    seasonId: props.season.id,
    clubId: props.clubId,
  });
}

const labeledTeams = computed(() => {
  // Keep only teams with a valid birth year
  const list = (props.season.teams || []).filter((t) =>
    Number.isFinite(t.birth_year)
  );

  // For UX: show only the year as the main label without "-2/-3" suffixes.
  // Disambiguation between multiple teams is provided by the team name below.
  const result = list.map((t) => ({
    ...t,
    display_label: String(t.birth_year),
  }));

  // Sort tiles by birth_year desc, then by team_name for stable order
  result.sort((a, b) => {
    if (a.birth_year !== b.birth_year)
      return (b.birth_year || 0) - (a.birth_year || 0);
    return (a.team_name || '').localeCompare(b.team_name || '', 'ru');
  });

  return result;
});

function isDisabled(team) {
  if (!props.disabledTeamIds) return false;
  const key = String(team.team_id);
  const src = props.disabledTeamIds;
  if (Array.isArray(src)) return src.map(String).includes(key);
  if (src instanceof Set) return src.has(key) || src.has(Number(key));
  return Boolean(src[key]);
}
</script>

<template>
  <div class="team-tiles" role="list">
    <div
      v-for="t in labeledTeams"
      :key="t.team_id + '-' + t.display_label"
      class="team-tiles__item"
      role="listitem"
    >
      <BaseTile
        :to="
          props.linkToRoster
            ? {
                path: `${props.rosterBasePath}/${season.id}/year/${t.birth_year}`,
                query: { club_id: clubId, team_id: t.team_id },
              }
            : null
        "
        :section="true"
        :disabled="(!props.linkToRoster && !props.intercept) || isDisabled(t)"
        :aria-label="`${t.display_label}, ${t.team_name || ''}, заявлено: ${t.player_count || 0}`"
        :extra-class="[
          'h-100',
          'fade-in',
          'w-100',
          'team-tile-card',
          'text-start',
          {
            'text-muted disabled-card':
              (!props.linkToRoster && !props.intercept) || isDisabled(t),
          },
        ]"
        :role="props.linkToRoster ? 'group' : 'button'"
        @click="onOpen(t)"
        @keydown.enter="onOpen(t)"
      >
        <div class="card-body">
          <div class="card-title mb-1 fw-semibold">{{ t.display_label }}</div>
          <div v-if="t.team_name" class="card-subtitle text-muted small mb-2">
            {{ t.team_name }}
          </div>
          <div
            class="card-text team-tile-meta text-muted small mb-2 d-flex align-items-center flex-wrap gap-3"
          >
            <span class="d-inline-flex align-items-center gap-1">
              <i class="bi bi-people text-brand" aria-hidden="true"></i>
              Заявлено: {{ t.player_count || 0 }}
            </span>
            <span class="d-inline-flex align-items-center gap-1">
              <i class="bi bi-trophy text-brand" aria-hidden="true"></i>
              Турниров: {{ (t.tournaments || []).length }}
            </span>
            <span
              v-if="
                props.groundsCountByTeamId &&
                props.groundsCountByTeamId[String(t.team_id)] != null
              "
              class="d-inline-flex align-items-center gap-1"
            >
              <i class="bi bi-geo-alt text-brand" aria-hidden="true"></i>
              Площадки: {{ props.groundsCountByTeamId[String(t.team_id)] }}
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
      </BaseTile>
    </div>
  </div>
</template>

<style scoped>
.team-tiles {
  display: grid;
  grid-template-columns: 1fr;
  gap: clamp(0.75rem, 0.5rem + 1vw, 1.25rem);
}
.team-tiles__item {
  width: 100%;
  min-width: 0; /* allow long names to wrap without forcing extra width */
}
.team-tile-card {
  text-align: left;
}
.team-tile-card .card-body {
  text-align: left;
}
.team-tile-meta {
  justify-content: flex-start;
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
