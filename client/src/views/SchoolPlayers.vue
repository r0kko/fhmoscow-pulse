<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';
import TeamTiles from '../components/TeamTiles.vue';

const loading = ref(false);
const error = ref('');
const clubs = ref([]);
const activeClubId = ref('all');
const summary = ref([]); // single club: [{ id, name, years: [...] }]
const selectedSeasonId = ref('');
const summariesByClub = ref([]); // multi-club: [{ club: {id,name}, seasons: [...] }]
const selectedSeasonByClub = ref({}); // { [clubId]: seasonId }

const hasMultipleClubs = computed(() => clubs.value.length > 1);
const seasons = computed(() => summary.value);
const activeSeason = computed(
  () => seasons.value.find((s) => s.id === selectedSeasonId.value) || null
);

onMounted(async () => {
  await loadClubs();
  await loadSummary();
});

watch(activeClubId, async () => {
  await loadSummary();
});

async function loadClubs() {
  try {
    const res = await apiFetch('/clubs?mine=true&include=teams');
    clubs.value = (res.clubs || []).map((c) => ({
      id: c.id,
      name: c.name,
      teams: c.teams || [],
    }));
    if (!clubs.value.length) activeClubId.value = 'all';
  } catch (_) {
    clubs.value = [];
  }
}

//

function filterSeasonsForView(seasons) {
  const out = [];
  for (const s of seasons || []) {
    const teams = (s.teams || []).filter((t) => Number.isFinite(t.birth_year));
    if (teams.length) out.push({ ...s, teams });
  }
  // Sort seasons ascending by name (handles numeric-like strings)
  const coll = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });
  out.sort((a, b) => coll.compare(a.name || '', b.name || ''));
  return out;
}

async function loadSummary() {
  loading.value = true;
  error.value = '';
  try {
    if ((clubs.value || []).length) {
      const results = await Promise.all(
        clubs.value.map(async (c) => {
          const p = new URLSearchParams();
          p.set('mine', 'true');
          p.set('club_id', c.id);
          const r = await apiFetch(`/players/season-teams?${p.toString()}`);
          const seasons = Array.isArray(r.seasons) ? r.seasons : [];
          return { club: c, seasons: filterSeasonsForView(seasons) };
        })
      );
      summariesByClub.value = results;
      // init per-club selected season
      const map = {};
      for (const item of results) {
        const active = item.seasons.find((s) => s.active);
        map[item.club.id] = (active || item.seasons[0])?.id || '';
      }
      selectedSeasonByClub.value = map;
      // clear single
      summary.value = [];
    } else {
      // No clubs assigned: fallback to user's teams overview
      const p = new URLSearchParams();
      p.set('mine', 'true');
      const r = await apiFetch(`/players/season-teams?${p.toString()}`);
      const seasons = filterSeasonsForView(
        Array.isArray(r.seasons) ? r.seasons : []
      );
      summariesByClub.value = [
        { club: { id: 'mine', name: 'Мои команды' }, seasons },
      ];
      const active = seasons.find((s) => s.active);
      selectedSeasonByClub.value = { mine: (active || seasons[0])?.id || '' };
    }
  } catch (e) {
    error.value = e.message || 'Не удалось загрузить данные по сезонам';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="py-3 school-players-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/">Главная</RouterLink>
          </li>
          <li class="breadcrumb-item">Управление спортивной школой</li>
          <li class="breadcrumb-item active" aria-current="page">
            Команды и составы
          </li>
        </ol>
      </nav>
      <h1 class="mb-3">Команды и составы</h1>

      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-else-if="loading" class="text-center py-3">
        <div class="spinner-border spinner-brand" role="status"></div>
      </div>
      <template v-else>
        <div v-if="!summariesByClub.length" class="alert alert-info">
          Вам пока не назначены клубы. Обратитесь к администратору спортивной
          школы для получения доступа к разделу «Команды и составы».
        </div>
        <div
          v-for="group in summariesByClub"
          :key="group.club.id"
          class="card section-card tile fade-in shadow-sm mb-3"
        >
          <div class="card-body">
            <h2 class="h5 mb-2">{{ group.club.name }}</h2>
            <ul class="nav nav-pills tab-selector mb-3" role="tablist">
              <li v-for="s in group.seasons" :key="s.id" class="nav-item">
                <button
                  class="nav-link"
                  :class="{
                    active: selectedSeasonByClub[group.club.id] === s.id,
                  }"
                  role="tab"
                  :aria-selected="selectedSeasonByClub[group.club.id] === s.id"
                  :aria-label="`Сезон ${s.name}`"
                  @click="selectedSeasonByClub[group.club.id] = s.id"
                >
                  {{ s.name }}
                </button>
              </li>
            </ul>
            <div
              v-if="!(group.seasons && group.seasons.length)"
              class="text-muted"
            >
              Пока нет доступных команд.
            </div>
            <div>
              <template v-for="s in group.seasons" :key="s.id">
                <template v-if="selectedSeasonByClub[group.club.id] === s.id">
                  <TeamTiles :season="s" :club-id="group.club.id" />
                  <div v-if="!s.teams?.length" class="text-muted">
                    Нет данных.
                  </div>
                </template>
              </template>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
export default { name: 'SchoolPlayersView' };
</script>

<style scoped>
.section-card {
  border-radius: 1rem;
  overflow: hidden;
}

.tab-selector .nav-link {
  border-radius: 0.75rem;
}
</style>

<!-- removed duplicate script setup block -->

<style scoped>
@media (max-width: 575.98px) {
  /* Match Camps page: slight full-bleed for large cards within container */
  .school-players-page .section-card {
    margin-left: -1rem;
    margin-right: -1rem;
  }
}
</style>
