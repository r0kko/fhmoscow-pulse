<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import { apiFetch } from '../api.js';
import TeamTiles from '../components/TeamTiles.vue';
import TabSelector from '../components/TabSelector.vue';

const loading = ref(false);
const error = ref('');
const clubs = ref([]);
const activeClubId = ref('all');
const summary = ref([]); // single club: [{ id, name, years: [...] }]
const selectedSeasonId = ref('');
const summariesByClub = ref([]); // multi-club: [{ club: {id,name}, seasons: [...] }]
const selectedSeasonByClub = ref({}); // { [clubId]: seasonId }
const canSee = ref(true);
const disabledByKey = ref({}); // { `${clubId}__${seasonId}`: Set(teamId) }

const hasMultipleClubs = computed(() => clubs.value.length > 1);
const router = useRouter();
const seasons = computed(() => summary.value);
const activeSeason = computed(
  () => seasons.value.find((s) => s.id === selectedSeasonId.value) || null
);

onMounted(async () => {
  await checkAccess();
  if (!canSee.value) return;
  await loadClubs();
  await loadSummary();
});

watch(activeClubId, async () => {
  await loadSummary();
});

// When season tab changes for a club, ensure disabled tiles computed
watch(
  selectedSeasonByClub,
  async (val) => {
    try {
      for (const group of summariesByClub.value || []) {
        const sid = val[group.club.id];
        const season = (group.seasons || []).find((s) => s.id === sid);
        if (season) await ensureDisabledComputed(group.club.id, season);
      }
    } catch (_) {}
  },
  { deep: true }
);

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
    if (!canSee.value) {
      summariesByClub.value = [];
      return;
    }
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
      // Precompute disabled tiles for active seasons
      await Promise.all(
        results.map(async (item) => {
          const sid = selectedSeasonByClub.value[item.club.id];
          const season = item.seasons.find((s) => s.id === sid);
          if (season) await ensureDisabledComputed(item.club.id, season);
        })
      );
      // clear single
      summary.value = [];
    } else {
      // No clubs: require team assignment; otherwise stop early
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
      // Precompute disabled for single-context
      const sid = selectedSeasonByClub.value.mine;
      const season = seasons.find((s) => s.id === sid);
      if (season) await ensureDisabledComputed('mine', season);
    }
  } catch (e) {
    if (String(e?.message || '').includes('403')) {
      // Friendly message for forbidden
      error.value =
        'Вам пока не назначены клубы или команды. Обратитесь к администратору спортивной школы.';
    } else {
      error.value = e.message || 'Не удалось загрузить данные по сезонам';
    }
  } finally {
    loading.value = false;
  }
}

async function checkAccess() {
  try {
    const data = await apiFetch('/users/me/sport-schools');
    canSee.value = Boolean(data?.has_club || data?.has_team);
  } catch (_e) {
    canSee.value = false;
  }
}

async function openRosterIfEligible(payload) {
  try {
    const paramsCommon = {
      season: payload.seasonId,
      club_id: payload.clubId,
      team_id: payload.teamId,
    };
    const qPlayers = new URLSearchParams({
      page: '1',
      limit: '1',
      mine: 'true',
      season: paramsCommon.season,
      club_id: paramsCommon.club_id,
      team_id: paramsCommon.team_id,
      team_birth_year: String(payload.teamYear),
    });
    qPlayers.append('include', 'clubs');
    qPlayers.append('include', 'teams');
    const qStaff = new URLSearchParams({
      page: '1',
      limit: '1',
      mine: 'true',
      season: paramsCommon.season,
      club_id: paramsCommon.club_id,
      team_id: paramsCommon.team_id,
    });
    qStaff.append('include', 'teams');

    const [playersRes, staffRes] = await Promise.all([
      apiFetch(`/players?${qPlayers.toString()}`),
      apiFetch(`/staff?${qStaff.toString()}`),
    ]);
    const playersTotal = Number(playersRes?.total || 0);
    const staffTotal = Number(staffRes?.total || 0);
    if (playersTotal === 0 && staffTotal === 0) return; // block navigation

    router.push({
      path: `/school-players/season/${payload.seasonId}/year/${payload.teamYear}`,
      query: { club_id: payload.clubId, team_id: payload.teamId },
    });
  } catch (_) {
    // Silently ignore navigation if check fails
  }
}

function keyFor(clubId, seasonId) {
  return `${clubId}__${seasonId}`;
}

async function ensureDisabledComputed(clubId, season) {
  const key = keyFor(clubId, season.id);
  if (disabledByKey.value[key]) return;
  // Candidates: teams with player_count == 0 and valid birth_year
  const candidates = (season.teams || [])
    .filter((t) => Number.isFinite(t.birth_year))
    .filter((t) => (t.player_count || 0) === 0);
  if (!candidates.length) {
    disabledByKey.value[key] = new Set();
    return;
  }
  // Check staff presence per candidate; limit concurrency to 4
  const hasStaff = new Set();
  const chunk = 4;
  for (let i = 0; i < candidates.length; i += chunk) {
    const part = candidates.slice(i, i + chunk);
    const res = await Promise.all(
      part.map(async (t) => {
        try {
          const params = new URLSearchParams({
            page: '1',
            limit: '1',
            mine: 'true',
            season: season.id,
            team_id: String(t.team_id),
            club_id: clubId === 'mine' ? '' : String(clubId),
          });
          params.append('include', 'teams');
          const r = await apiFetch(`/staff?${params.toString()}`);
          return { id: String(t.team_id), total: Number(r?.total || 0) };
        } catch (_e) {
          return { id: String(t.team_id), total: 0 };
        }
      })
    );
    for (const r of res) if (r.total > 0) hasStaff.add(r.id);
  }
  // Disabled = candidates with no staff
  disabledByKey.value[key] = new Set(
    candidates
      .filter((t) => !hasStaff.has(String(t.team_id)))
      .map((t) => String(t.team_id))
  );
}
</script>

<template>
  <div class="py-3 school-players-page">
    <div class="container">
      <Breadcrumbs
        :items="[
          { label: 'Главная', to: '/' },
          { label: 'Управление спортивной школой', disabled: true },
          { label: 'Команды и составы' },
        ]"
      />
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
            <div class="mb-3">
              <TabSelector
                :tabs="group.seasons.map((s) => ({ key: s.id, label: s.name }))"
                :model-value="selectedSeasonByClub[group.club.id]"
                :nav-fill="true"
                justify="start"
                @update:model-value="
                  (v) => (selectedSeasonByClub[group.club.id] = v)
                "
              />
            </div>
            <div
              v-if="!(group.seasons && group.seasons.length)"
              class="text-muted"
            >
              Пока нет доступных команд.
            </div>
            <div>
              <template v-for="s in group.seasons" :key="s.id">
                <template v-if="selectedSeasonByClub[group.club.id] === s.id">
                  <TeamTiles
                    :season="s"
                    :club-id="group.club.id"
                    :link-to-roster="false"
                    :disabled-team-ids="
                      disabledByKey[keyFor(group.club.id, s.id)] || new Set()
                    "
                    intercept
                    @open="openRosterIfEligible"
                  />
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
/* Uses global .section-card and .tab-selector from brand.css */
</style>

<!-- removed duplicate script setup block -->

<style scoped>
/* Mobile spacing handled globally */
</style>
