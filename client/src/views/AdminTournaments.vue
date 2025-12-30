<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import BrandSpinner from '../components/BrandSpinner.vue';
import PageNav from '../components/PageNav.vue';
import { apiFetch } from '../api';
import { useToast } from '../utils/toast';
import { loadPageSize, savePageSize } from '../utils/pageSize';

const route = useRoute();
const router = useRouter();
const { showToast } = useToast();

// Shared search
const search = ref(route.query.q || '');
const seasonOptions = ref([]);
const tournamentTypeOptions = ref([]);
const selectedSeasonId = ref(String(route.query.season_id || ''));

// Tournaments
const tournaments = ref([]);
const tournamentsTotal = ref(0);
const tournamentsPage = ref(Number(route.query.tp || 1) || 1);
const tournamentsPageSize = ref(loadPageSize('adminTournamentsPageSize', 20));
const tournamentsLoading = ref(false);
const tournamentsError = ref('');
const tournamentsTotalPages = computed(() =>
  Math.max(
    1,
    Math.ceil((tournamentsTotal.value || 0) / tournamentsPageSize.value)
  )
);
const createTournamentOpen = ref(false);
const createTournamentLoading = ref(false);
const createTournamentError = ref('');
const createTournamentForm = ref({
  name: '',
  full_name: '',
  birth_year: '',
  season_id: '',
  type_id: '',
});

const createStageOpen = ref(false);
const createStageLoading = ref(false);
const createStageError = ref('');
const createStageForm = ref({ name: '' });

const createGroupOpen = ref(false);
const createGroupLoading = ref(false);
const createGroupError = ref('');
const createGroupForm = ref({ name: '', hours: '', minutes: '' });

function updateQuery() {
  const q = { ...route.query };
  if (search.value) q.q = search.value;
  else delete q.q;
  q.tp = String(tournamentsPage.value);
  if (selectedSeasonId.value) q.season_id = selectedSeasonId.value;
  else delete q.season_id;
  // Remove obsolete params
  delete q.tab;
  delete q.sp;
  delete q.gp;
  delete q.up;
  delete q.gtid;
  delete q.stid;
  delete q.tt_tid;
  delete q.tt_gid;
  router.replace({ query: q });
}

async function loadTournaments() {
  tournamentsLoading.value = true;
  tournamentsError.value = '';
  try {
    const params = new URLSearchParams({
      page: String(tournamentsPage.value),
      limit: String(tournamentsPageSize.value),
    });
    const term = search.value.trim();
    if (term) params.set('search', term);
    if (selectedSeasonId.value) params.set('season_id', selectedSeasonId.value);
    const r = await apiFetch(`/tournaments?${params.toString()}`);
    tournaments.value = r.tournaments || [];
    tournamentsTotal.value = r.total || 0;
  } catch (e) {
    tournaments.value = [];
    tournamentsTotal.value = 0;
    tournamentsError.value = e.message || 'Ошибка загрузки турниров';
  } finally {
    tournamentsLoading.value = false;
  }
}

const tournamentsVisible = computed(() => tournaments.value || []);
const settingsGroupsByStage = computed(() => {
  const buckets = new Map();
  for (const stage of settingsStages.value || []) {
    buckets.set(stage.id, { stage, groups: [] });
  }
  const unassigned = { stage: { id: 'unassigned', name: 'Без этапа' }, groups: [] };
  for (const group of settingsGroups.value || []) {
    const bucket = buckets.get(group.stage_id) || unassigned;
    bucket.groups.push(group);
  }
  const list = Array.from(buckets.values());
  if (unassigned.groups.length) list.push(unassigned);
  return list;
});

const detailGroupCountsByStage = computed(() => {
  const counts = new Map();
  for (const group of detailGroups.value || []) {
    const key = group.stage_id || 'unassigned';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
});

const detailStagesVisible = computed(() => {
  const term = normalizeSearchTerm(detailStageSearch.value);
  const list = [...(detailStages.value || [])];
  if (detailGroups.value.some((g) => !g.stage_id)) {
    list.push({ id: 'unassigned', name: 'Без этапа', external_id: null });
  }
  return list.filter(
    (s) =>
      matchesSearch(s.name || '', term) ||
      matchesSearch(s.external_id || s.id || '', term)
  );
});

const detailGroupsVisible = computed(() => {
  if (!detailStage.value) return [];
  const term = normalizeSearchTerm(detailGroupSearch.value);
  const stageId = detailStage.value.id;
  return (detailGroups.value || []).filter((g) => {
    const isMatch =
      stageId === 'unassigned'
        ? !g.stage_id
        : String(g.stage_id) === String(stageId);
    if (!isMatch) return false;
    return (
      matchesSearch(g.name || '', term) ||
      matchesSearch(g.external_id || g.id || '', term)
    );
  });
});

const detailTeamsVisible = computed(() => {
  const term = normalizeSearchTerm(detailTeamSearch.value);
  return (detailTeams.value || []).filter((t) =>
    matchesSearch(t.team?.name || '', term)
  );
});

// Helper maps for chips
const seasonNameById = computed(
  () => new Map((seasonOptions.value || []).map((s) => [String(s.id), s.name]))
);
// type removed

const filterChips = computed(() => {
  const chips = [];
  const q = (search.value || '').trim();
  if (q) chips.push({ key: 'q', label: `Поиск: ${q}` });
  if (selectedSeasonId.value) {
    const name = seasonNameById.value.get(String(selectedSeasonId.value));
    chips.push({ key: 'season', label: `Сезон: ${name || '—'}` });
  }
  return chips;
});

function clearChip(key) {
  if (key === 'q') search.value = '';
  if (key === 'season') selectedSeasonId.value = '';
}

function clearAllFilters() {
  search.value = '';
  selectedSeasonId.value = '';
  tournamentsPage.value = 1;
  loadTournaments();
  updateQuery();
}

// Persist season/type filters
const FILTERS_KEY = 'adminTournamentsFilters';
function saveFilters() {
  try {
    const data = { season_id: selectedSeasonId.value || '' };
    localStorage.setItem(FILTERS_KEY, JSON.stringify(data));
  } catch (_) {}
}
function loadSavedFilters() {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return;
    const f = JSON.parse(raw);
    if (f && typeof f === 'object') {
      selectedSeasonId.value = String(f.season_id || '');
    }
  } catch (_) {}
}

// Drill-down state for tile interface inside a tournament
const detailTournament = ref(null); // { id, name, season }
const detailStage = ref(null); // { id, external_id }
const detailGroup = ref(null); // { id, name }
const detailMode = ref('structure');

const detailStages = ref([]);
const detailStagesLoading = ref(false);
const detailStagesError = ref('');
const detailGroups = ref([]);
const detailGroupsLoading = ref(false);
const detailGroupsError = ref('');
const detailTeams = ref([]);
const detailTeamsLoading = ref(false);
const detailTeamsError = ref('');
const detailStageSearch = ref('');
const detailGroupSearch = ref('');
const detailTeamSearch = ref('');

const isImportedTournament = computed(
  () => detailTournament.value?.external_id != null
);

const settingsStages = ref([]);
const settingsGroups = ref([]);
const settingsLoading = ref(false);
const settingsError = ref('');
const settingsEdits = ref({});
const settingsOpenStageId = ref(null);

function closeDetail() {
  detailTournament.value = null;
  detailStage.value = null;
  detailGroup.value = null;
  detailStages.value = [];
  detailGroups.value = [];
  detailTeams.value = [];
  detailStagesError.value = '';
  detailGroupsError.value = '';
  detailTeamsError.value = '';
  detailMode.value = 'structure';
  settingsStages.value = [];
  settingsGroups.value = [];
  settingsEdits.value = {};
  settingsOpenStageId.value = null;
  createStageOpen.value = false;
  createGroupOpen.value = false;
  resetCreateStageForm();
  resetCreateGroupForm();
  detailStageSearch.value = '';
  detailGroupSearch.value = '';
  detailTeamSearch.value = '';
}

function splitDurationMinutes(total) {
  if (total == null) return { hours: '', minutes: '' };
  const hours = Math.floor(Number(total) / 60);
  const minutes = Number(total) % 60;
  return { hours: String(hours), minutes: String(minutes) };
}

function parseDurationInput(hoursInput, minutesInput) {
  const hRaw = String(hoursInput ?? '').trim();
  const mRaw = String(minutesInput ?? '').trim();
  if (!hRaw && !mRaw) return { value: null };
  const hours = Number.parseInt(hRaw || '0', 10);
  const minutes = Number.parseInt(mRaw || '0', 10);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
    return { error: 'Укажите корректные часы' };
  }
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 59) {
    return { error: 'Укажите корректные минуты' };
  }
  if (hours === 24 && minutes > 0) {
    return { error: 'Максимум 24:00' };
  }
  return { value: hours * 60 + minutes };
}

function normalizeSearchTerm(value) {
  return String(value || '').trim().toLowerCase();
}

function matchesSearch(value, term) {
  if (!term) return true;
  return String(value || '').toLowerCase().includes(term);
}

function formatDurationMinutes(total) {
  if (total == null) return '—';
  const minutes = Number(total);
  if (!Number.isFinite(minutes) || minutes < 0) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && mins) return `${hours} ч ${mins} мин`;
  if (hours) return `${hours} ч`;
  return `${mins} мин`;
}

async function openTournamentDetail(t) {
  detailTournament.value = t;
  detailStage.value = null;
  detailGroup.value = null;
  detailStagesError.value = '';
  detailGroupsError.value = '';
  detailTeamsError.value = '';
  detailMode.value = 'structure';
  createStageOpen.value = false;
  createGroupOpen.value = false;
  resetCreateStageForm();
  resetCreateGroupForm();
  detailStageSearch.value = '';
  detailGroupSearch.value = '';
  detailTeamSearch.value = '';
  await Promise.all([loadDetailStages(), loadDetailGroups()]);
}

function backToTournamentStages() {
  detailGroup.value = null;
  detailTeams.value = [];
  detailTeamSearch.value = '';
  detailTeamsError.value = '';
}

function backToTournamentsList() {
  closeDetail();
}

async function openStageDetail(s) {
  detailStage.value = s;
  detailGroup.value = null;
  detailTeams.value = [];
  detailGroupSearch.value = '';
  detailTeamSearch.value = '';
  detailGroupsError.value = '';
  detailTeamsError.value = '';
  createGroupOpen.value = false;
  resetCreateGroupForm();
  if (!detailGroups.value.length) {
    await loadDetailGroups();
  }
}

async function openGroupDetail(g) {
  detailGroup.value = g;
  createGroupOpen.value = false;
  detailTeamSearch.value = '';
  detailTeamsError.value = '';
  await loadDetailTeams();
}

function openTournamentStructure() {
  detailMode.value = 'structure';
  if (!detailStages.value.length) loadDetailStages();
  if (!detailGroups.value.length) loadDetailGroups();
}

async function openTournamentSettings() {
  detailMode.value = 'settings';
  createStageOpen.value = false;
  createGroupOpen.value = false;
  await loadTournamentSettings();
}

async function loadTournamentSettings() {
  if (!detailTournament.value) return;
  const tournamentId = detailTournament.value.id;
  settingsLoading.value = true;
  settingsError.value = '';
  try {
    const params = new URLSearchParams({
      page: '1',
      limit: '1000',
      tournament_id: tournamentId,
    });
    const [stagesRes, groupsRes] = await Promise.all([
      apiFetch(`/tournaments/stages?${params.toString()}`),
      apiFetch(`/tournaments/groups?${params.toString()}`),
    ]);
    settingsStages.value = stagesRes.stages || [];
    settingsGroups.value = groupsRes.groups || [];
    const edits = {};
    for (const g of settingsGroups.value) {
      const parts = splitDurationMinutes(g.match_duration_minutes);
      edits[g.id] = {
        hours: parts.hours,
        minutes: parts.minutes,
        saving: false,
        error: '',
        dirty: false,
      };
    }
    settingsEdits.value = edits;
    const stageIds = (settingsStages.value || []).map((s) => s.id);
    const hasUnassigned = settingsGroups.value.some((g) => !g.stage_id);
    const isValidOpen =
      stageIds.includes(settingsOpenStageId.value) ||
      (settingsOpenStageId.value === 'unassigned' && hasUnassigned);
    if (!isValidOpen) {
      settingsOpenStageId.value =
        stageIds[0] || (hasUnassigned ? 'unassigned' : null);
    }
  } catch (e) {
    settingsStages.value = [];
    settingsGroups.value = [];
    settingsEdits.value = {};
    settingsOpenStageId.value = null;
    settingsError.value = e.message || 'Ошибка загрузки настроек';
  } finally {
    settingsLoading.value = false;
  }
}

function toggleSettingsStage(id) {
  settingsOpenStageId.value =
    settingsOpenStageId.value === id ? null : id;
}

async function saveGroupSettings(group) {
  const edit = settingsEdits.value[group.id];
  if (!edit || edit.saving) return;
  const parsed = parseDurationInput(edit.hours, edit.minutes);
  if (parsed.error) {
    edit.error = parsed.error;
    return;
  }
  edit.saving = true;
  edit.error = '';
  try {
    const payload = { match_duration_minutes: parsed.value };
    const res = await apiFetch(`/tournaments/groups/${group.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const updated = res.group || {};
    group.match_duration_minutes = updated.match_duration_minutes ?? parsed.value;
    edit.dirty = false;
    showToast('Настройки группы сохранены');
  } catch (e) {
    edit.error = e.message || 'Ошибка сохранения';
  } finally {
    edit.saving = false;
  }
}

function resetCreateTournamentForm() {
  createTournamentForm.value = {
    name: '',
    full_name: '',
    birth_year: '',
    season_id: selectedSeasonId.value || '',
    type_id: '',
  };
  createTournamentError.value = '';
}

function toggleCreateTournament() {
  createTournamentOpen.value = !createTournamentOpen.value;
  if (createTournamentOpen.value) {
    resetCreateTournamentForm();
  }
}

async function submitCreateTournament() {
  if (createTournamentLoading.value) return;
  const name = String(createTournamentForm.value.name || '').trim();
  if (!name) {
    createTournamentError.value = 'Укажите название турнира';
    return;
  }
  createTournamentLoading.value = true;
  createTournamentError.value = '';
  try {
    const payload = { name };
    if (createTournamentForm.value.full_name)
      payload.full_name = createTournamentForm.value.full_name;
    if (createTournamentForm.value.season_id)
      payload.season_id = createTournamentForm.value.season_id;
    if (createTournamentForm.value.type_id)
      payload.type_id = createTournamentForm.value.type_id;
    if (createTournamentForm.value.birth_year) {
      payload.birth_year = createTournamentForm.value.birth_year;
    }
    const res = await apiFetch('/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const created = res.tournament;
    showToast('Турнир создан');
    createTournamentOpen.value = false;
    resetCreateTournamentForm();
    await loadTournaments();
    if (created) {
      await openTournamentDetail(created);
    }
  } catch (e) {
    createTournamentError.value = e.message || 'Ошибка создания турнира';
  } finally {
    createTournamentLoading.value = false;
  }
}

function resetCreateStageForm() {
  createStageForm.value = { name: '' };
  createStageError.value = '';
}

async function submitCreateStage() {
  if (createStageLoading.value || !detailTournament.value) return;
  createStageLoading.value = true;
  createStageError.value = '';
  try {
    const payload = {
      tournament_id: detailTournament.value.id,
    };
    const name = String(createStageForm.value.name || '').trim();
    if (name) payload.name = name;
    const res = await apiFetch('/tournaments/stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const createdStage = res.stage || null;
    showToast('Этап создан');
    resetCreateStageForm();
    createStageOpen.value = false;
    await loadDetailStages();
    if (createdStage) {
      detailStage.value = createdStage;
      detailGroup.value = null;
      detailTeams.value = [];
    }
    if (detailMode.value === 'settings') await loadTournamentSettings();
  } catch (e) {
    createStageError.value = e.message || 'Ошибка создания этапа';
  } finally {
    createStageLoading.value = false;
  }
}

function resetCreateGroupForm() {
  createGroupForm.value = { name: '', hours: '', minutes: '' };
  createGroupError.value = '';
}

async function submitCreateGroup() {
  if (
    createGroupLoading.value ||
    !detailTournament.value ||
    !detailStage.value ||
    detailStage.value.id === 'unassigned'
  )
    return;
  const parsed = parseDurationInput(
    createGroupForm.value.hours,
    createGroupForm.value.minutes
  );
  if (parsed.error) {
    createGroupError.value = parsed.error;
    return;
  }
  createGroupLoading.value = true;
  createGroupError.value = '';
  try {
    const payload = {
      tournament_id: detailTournament.value.id,
      stage_id: detailStage.value.id,
    };
    const name = String(createGroupForm.value.name || '').trim();
    if (name) payload.name = name;
    if (parsed.value != null) payload.match_duration_minutes = parsed.value;
    const res = await apiFetch('/tournaments/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const createdGroup = res.group || null;
    showToast('Группа создана');
    resetCreateGroupForm();
    createGroupOpen.value = false;
    await loadDetailGroups();
    if (createdGroup) {
      detailGroup.value = createdGroup;
      detailTeams.value = [];
    }
    if (detailMode.value === 'settings') await loadTournamentSettings();
  } catch (e) {
    createGroupError.value = e.message || 'Ошибка создания группы';
  } finally {
    createGroupLoading.value = false;
  }
}

async function loadDetailStages() {
  if (!detailTournament.value) return;
  detailStagesLoading.value = true;
  detailStagesError.value = '';
  try {
    const p = new URLSearchParams({
      page: '1',
      limit: '1000',
      tournament_id: detailTournament.value.id,
    });
    const r = await apiFetch(`/tournaments/stages?${p.toString()}`);
    detailStages.value = r.stages || [];
  } catch (e) {
    detailStages.value = [];
    detailStagesError.value = e.message || 'Ошибка загрузки этапов';
  } finally {
    detailStagesLoading.value = false;
  }
}

async function loadDetailGroups() {
  if (!detailTournament.value) return;
  detailGroupsLoading.value = true;
  detailGroupsError.value = '';
  try {
    const p = new URLSearchParams({
      page: '1',
      limit: '1000',
      tournament_id: detailTournament.value.id,
    });
    const r = await apiFetch(`/tournaments/groups?${p.toString()}`);
    detailGroups.value = r.groups || [];
  } catch (e) {
    detailGroups.value = [];
    detailGroupsError.value = e.message || 'Ошибка загрузки групп';
  } finally {
    detailGroupsLoading.value = false;
  }
}

async function loadDetailTeams() {
  if (!detailTournament.value || !detailGroup.value) return;
  detailTeamsLoading.value = true;
  detailTeamsError.value = '';
  try {
    const p = new URLSearchParams({
      page: '1',
      limit: '1000',
      tournament_id: detailTournament.value.id,
      group_id: detailGroup.value.id,
    });
    const r = await apiFetch(`/tournaments/teams?${p.toString()}`);
    detailTeams.value = r.teams || [];
  } catch (e) {
    detailTeams.value = [];
    detailTeamsError.value = e.message || 'Ошибка загрузки команд';
  } finally {
    detailTeamsLoading.value = false;
  }
}

async function loadFilters() {
  try {
    const [seasonsRes, activeRes, typesRes] = await Promise.all([
      apiFetch('/seasons?limit=1000'),
      apiFetch('/seasons/active'),
      apiFetch('/tournaments/types'),
    ]);
    seasonOptions.value = (seasonsRes.seasons || []).map((s) => ({
      id: s.id,
      name: s.name,
    }));
    tournamentTypeOptions.value = (typesRes.types || []).map((t) => ({
      id: t.id,
      name: t.name,
    }));
    if (!selectedSeasonId.value && activeRes?.season?.id) {
      selectedSeasonId.value = String(activeRes.season.id);
    }
  } catch (_) {}
}

onMounted(async () => {
  loadSavedFilters();
  await Promise.all([loadFilters(), loadTournaments()]);
});

// Watchers for pagination and sizes
watch([tournamentsPage, tournamentsPageSize], ([, size]) => {
  savePageSize('adminTournamentsPageSize', size);
  loadTournaments();
  updateQuery();
});
watch([selectedSeasonId], () => {
  tournamentsPage.value = 1;
  loadTournaments();
  updateQuery();
  saveFilters();
});
// Old global lists removed; watchers cleaned up

let searchTimeout;
watch(search, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    tournamentsPage.value = 1;
    loadTournaments();
    updateQuery();
  }, 300);
});

// Quick transitions: click counts now open tournament detail
</script>

<template>
  <div class="py-4 admin-tournaments-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Турниры</li>
        </ol>
      </nav>
      <h1 class="mb-3 text-start">Турниры</h1>

      <div v-if="!detailTournament">
        <div class="card section-card tile fade-in shadow-sm">
          <div class="card-body">
            <div class="row g-2 align-items-end mb-3">
              <div class="col-12 col-md-4">
                <div class="input-group">
                  <span class="input-group-text"
                    ><i class="bi bi-search" aria-hidden="true"></i
                  ></span>
                  <input
                    v-model="search"
                    type="search"
                    class="form-control"
                    placeholder="Поиск (название турнира, группа, команда)"
                    aria-label="Поиск"
                  />
                </div>
              </div>
              <div class="col-6 col-md-4">
                <select
                  v-model="selectedSeasonId"
                  class="form-select"
                  aria-label="Сезон"
                >
                  <option value="">Все сезоны</option>
                  <option v-for="s in seasonOptions" :key="s.id" :value="s.id">
                    {{ s.name }}
                  </option>
                </select>
              </div>
            </div>

            <div
              class="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2"
            >
              <div class="d-flex flex-wrap align-items-center gap-1">
                <button
                  v-for="chip in filterChips"
                  :key="chip.key"
                  type="button"
                  class="badge bg-light text-muted border d-inline-flex align-items-center gap-1"
                  :aria-label="`Удалить фильтр ${chip.label}`"
                  @click="clearChip(chip.key)"
                >
                  {{ chip.label }}
                  <i class="bi bi-x-lg" aria-hidden="true"></i>
                </button>
              </div>
              <div class="d-flex align-items-center gap-2">
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  @click="clearAllFilters"
                >
                  Сбросить все
                </button>
                <button
                  type="button"
                  class="btn btn-brand btn-sm"
                  @click="toggleCreateTournament"
                >
                  {{ createTournamentOpen ? 'Скрыть форму' : 'Создать турнир' }}
                </button>
              </div>
            </div>

            <div
              v-if="createTournamentOpen"
              class="card border-0 shadow-sm mb-3 bg-light-subtle"
            >
              <div class="card-body">
                <div class="d-flex align-items-center mb-2">
                  <div class="fw-semibold">Новый турнир</div>
                </div>
                <div v-if="createTournamentError" class="alert alert-danger">
                  {{ createTournamentError }}
                </div>
                <div class="row g-2">
                  <div class="col-12 col-lg-4">
                    <label class="form-label">Название</label>
                    <input
                      v-model="createTournamentForm.name"
                      type="text"
                      class="form-control"
                      placeholder="Название турнира"
                      @input="createTournamentError = ''"
                    />
                  </div>
                  <div class="col-12 col-lg-4">
                    <label class="form-label">Полное название</label>
                    <input
                      v-model="createTournamentForm.full_name"
                      type="text"
                      class="form-control"
                      placeholder="Полное название"
                    />
                  </div>
                  <div class="col-6 col-lg-2">
                    <label class="form-label">Год</label>
                    <input
                      v-model="createTournamentForm.birth_year"
                      type="number"
                      class="form-control"
                      min="1900"
                      max="2100"
                      placeholder="Год"
                    />
                  </div>
                  <div class="col-6 col-lg-2">
                    <label class="form-label">Сезон</label>
                    <select
                      v-model="createTournamentForm.season_id"
                      class="form-select"
                    >
                      <option value="">Выберите сезон</option>
                      <option
                        v-for="s in seasonOptions"
                        :key="s.id"
                        :value="s.id"
                      >
                        {{ s.name }}
                      </option>
                    </select>
                  </div>
                  <div class="col-12 col-lg-4">
                    <label class="form-label">Тип</label>
                    <select
                      v-model="createTournamentForm.type_id"
                      class="form-select"
                    >
                      <option value="">Без типа</option>
                      <option
                        v-for="t in tournamentTypeOptions"
                        :key="t.id"
                        :value="t.id"
                      >
                        {{ t.name }}
                      </option>
                    </select>
                  </div>
                  <div class="col-12 col-lg-8 d-flex align-items-end">
                    <button
                      type="button"
                      class="btn btn-brand"
                      :disabled="createTournamentLoading"
                      @click="submitCreateTournament"
                    >
                      <span
                        v-if="createTournamentLoading"
                        class="spinner-border spinner-border-sm me-2"
                      ></span>
                      Создать
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tournaments -->
            <div>
              <div v-if="tournamentsError" class="alert alert-danger mb-2">
                {{ tournamentsError }}
              </div>
              <BrandSpinner v-if="tournamentsLoading" label="Загрузка" />
              <div v-else>
                <div v-if="tournamentsVisible.length" class="table-responsive">
                  <table class="table align-middle">
                    <thead>
                      <tr>
                        <th>Название</th>
                        <th>Сезон</th>
                        <th>Год</th>
                        <th class="text-end">Этапы</th>
                        <th class="text-end">Группы</th>
                        <th class="text-end">Команды</th>
                        <th class="text-end">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="t in tournamentsVisible" :key="t.id">
                        <td class="text-start">
                          <div class="fw-semibold">{{ t.name }}</div>
                          <div v-if="t.full_name" class="small text-muted">
                            {{ t.full_name }}
                          </div>
                        </td>
                        <td>{{ t.season?.name || '—' }}</td>

                        <td>{{ t.birth_year || '—' }}</td>
                        <td class="text-end">
                          <button
                            class="btn btn-link px-0"
                            @click="openTournamentDetail(t)"
                          >
                            {{ t.counts?.stages ?? '—' }}
                          </button>
                        </td>
                        <td class="text-end">
                          <button
                            class="btn btn-link px-0"
                            @click="openTournamentDetail(t)"
                          >
                            {{ t.counts?.groups ?? '—' }}
                          </button>
                        </td>
                        <td class="text-end">
                          <button
                            class="btn btn-link px-0"
                            @click="openTournamentDetail(t)"
                          >
                            {{ t.counts?.teams ?? '—' }}
                          </button>
                        </td>
                        <td class="text-end">
                          <RouterLink
                            class="btn btn-outline-secondary btn-sm"
                            :to="{
                              path: '/admin/sports-calendar',
                              query: { tournament: t.name },
                            }"
                          >
                            Календарь
                          </RouterLink>
                          <button
                            class="btn btn-outline-brand btn-sm ms-2"
                            @click="openTournamentDetail(t)"
                          >
                            Открыть
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <PageNav
                    v-model:page="tournamentsPage"
                    v-model:page-size="tournamentsPageSize"
                    :total-pages="tournamentsTotalPages"
                    :sizes="[10, 20, 50]"
                  />
                </div>
                <div v-else class="alert alert-warning mb-0">
                  Турниры не найдены.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <!-- Drill-down tiles -->
  <div v-if="detailTournament" class="py-3">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item">
            <button
              type="button"
              class="btn btn-link p-0 align-baseline text-decoration-none"
              @click="backToTournamentsList"
            >
              Турниры
            </button>
          </li>
          <!-- Tournament crumb: active when no deeper selection; clickable otherwise -->
          <li
            v-if="!detailStage && !detailGroup"
            class="breadcrumb-item active"
            aria-current="page"
          >
            {{ detailTournament.name }}
          </li>
          <li v-else class="breadcrumb-item">
            <button
              type="button"
              class="btn btn-link p-0 align-baseline text-decoration-none"
              @click="
                (() => {
                  detailStage = null;
                  detailGroup = null;
                })()
              "
            >
              {{ detailTournament.name }}
            </button>
          </li>
          <!-- Stage crumb: show name if exists; active only when group is not selected -->
          <li
            v-if="detailStage && !detailGroup"
            class="breadcrumb-item active"
            aria-current="page"
          >
            Этап:
            {{
              detailStage.name ||
              '#' + (detailStage.external_id || detailStage.id)
            }}
          </li>
          <li v-else-if="detailStage && detailGroup" class="breadcrumb-item">
            <button
              type="button"
              class="btn btn-link p-0 align-baseline text-decoration-none"
              @click="backToTournamentStages"
            >
              Этап:
              {{
                detailStage.name ||
                '#' + (detailStage.external_id || detailStage.id)
              }}
            </button>
          </li>
          <!-- Group crumb: active only as the last crumb -->
          <li
            v-if="detailGroup"
            class="breadcrumb-item active"
            aria-current="page"
          >
            {{ detailGroup.name || 'Группа' }}
          </li>
        </ol>
      </nav>
      <div
        class="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2"
      >
        <div class="d-flex align-items-center gap-3 flex-wrap">
          <h2 class="h5 mb-0">
            {{
              detailMode === 'settings'
                ? 'Настройки групп'
                : detailGroup
                  ? 'Команды'
                  : detailStage
                    ? 'Группы'
                    : 'Этапы'
            }}
          </h2>
          <div class="btn-group btn-group-sm" role="group">
            <button
              type="button"
              class="btn"
              :class="detailMode === 'structure' ? 'btn-brand' : 'btn-outline-secondary'"
              @click="openTournamentStructure"
            >
              Структура
            </button>
            <button
              type="button"
              class="btn"
              :class="detailMode === 'settings' ? 'btn-brand' : 'btn-outline-secondary'"
              @click="openTournamentSettings"
            >
              Настройки
            </button>
          </div>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <RouterLink
            class="btn btn-outline-secondary btn-sm"
            :to="{
              path: '/admin/sports-calendar',
              query: detailGroup
                ? {
                    tournament: detailTournament.name,
                    group: detailGroup.name || '',
                  }
                : { tournament: detailTournament.name },
            }"
          >
            Календарь {{ detailGroup ? 'группы' : 'турнира' }}
          </RouterLink>
          <button
            v-if="detailGroup"
            class="btn btn-outline-secondary btn-sm"
            @click="backToTournamentStages"
          >
            К группам
          </button>
          <button
            v-else-if="detailStage"
            class="btn btn-outline-secondary btn-sm"
            @click="detailStage = null"
          >
            К этапам
          </button>
        </div>
      </div>

      <div class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <template v-if="detailMode === 'structure'">
            <div v-if="isImportedTournament" class="alert alert-info small mb-3">
              Турнир импортирован из внешней системы. Добавление этапов и групп
              недоступно.
            </div>
            <div class="row g-3">
              <div class="col-12 col-lg-4">
                <div class="card section-card shadow-sm h-100 hierarchy-card">
                  <div class="card-body">
                    <div
                      class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2"
                    >
                      <div>
                        <div class="fw-semibold">Этапы</div>
                        <div class="small text-muted">
                          {{ detailStagesVisible.length }} этапов
                        </div>
                      </div>
                      <button
                        type="button"
                        class="btn btn-outline-brand btn-sm"
                        :disabled="isImportedTournament"
                        :title="
                          isImportedTournament
                            ? 'Добавление этапов недоступно для импортированных турниров'
                            : ''
                        "
                        @click="createStageOpen = !createStageOpen"
                      >
                        {{ createStageOpen ? 'Скрыть' : 'Добавить' }}
                      </button>
                    </div>
                    <div class="input-group input-group-sm mb-2">
                      <span class="input-group-text"
                        ><i class="bi bi-search" aria-hidden="true"></i
                      ></span>
                      <input
                        v-model="detailStageSearch"
                        type="search"
                        class="form-control"
                        placeholder="Поиск этапа"
                        aria-label="Поиск этапа"
                      />
                    </div>
                    <div v-if="detailStagesError" class="text-danger small mb-2">
                      {{ detailStagesError }}
                    </div>
                    <div
                      v-if="createStageOpen && !isImportedTournament"
                      class="border rounded-3 p-2 mb-2 bg-light-subtle"
                    >
                      <div v-if="createStageError" class="text-danger small">
                        {{ createStageError }}
                      </div>
                      <label class="form-label small">Название этапа</label>
                      <input
                        v-model="createStageForm.name"
                        type="text"
                        class="form-control form-control-sm mb-2"
                        placeholder="Название этапа"
                        @input="createStageError = ''"
                      />
                      <button
                        type="button"
                        class="btn btn-brand btn-sm w-100"
                        :disabled="createStageLoading"
                        @click="submitCreateStage"
                      >
                        <span
                          v-if="createStageLoading"
                          class="spinner-border spinner-border-sm me-2"
                        ></span>
                        Создать этап
                      </button>
                    </div>
                    <BrandSpinner
                      v-if="detailStagesLoading"
                      label="Загрузка"
                    />
                    <div v-else>
                      <div
                        v-if="detailStagesVisible.length"
                        class="list-group list-group-flush"
                      >
                        <button
                          v-for="s in detailStagesVisible"
                          :key="s.id"
                          type="button"
                          class="list-group-item list-group-item-action hierarchy-item"
                          :class="{ active: detailStage?.id === s.id }"
                          @click="openStageDetail(s)"
                        >
                          <div
                            class="d-flex align-items-center justify-content-between"
                          >
                            <div class="fw-semibold">
                              {{ s.name || '#' + (s.external_id || s.id) }}
                            </div>
                            <span class="badge bg-light text-muted border">
                              {{ detailGroupCountsByStage.get(s.id) || 0 }}
                            </span>
                          </div>
                          <div class="small text-muted">
                            ID: {{ s.id === 'unassigned' ? '—' : s.external_id || s.id }}
                          </div>
                        </button>
                      </div>
                      <div v-else class="text-muted small">
                        Этапы не найдены.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-12 col-lg-4">
                <div class="card section-card shadow-sm h-100 hierarchy-card">
                  <div class="card-body">
                    <div
                      class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2"
                    >
                      <div>
                        <div class="fw-semibold">Группы</div>
                        <div class="small text-muted">
                          {{
                            detailStage
                              ? `Этап: ${detailStage.name || '#' + (detailStage.external_id || detailStage.id)}`
                              : 'Выберите этап'
                          }}
                        </div>
                      </div>
                      <button
                        v-if="detailStage && detailStage.id !== 'unassigned'"
                        type="button"
                        class="btn btn-outline-brand btn-sm"
                        :disabled="isImportedTournament"
                        :title="
                          isImportedTournament
                            ? 'Добавление групп недоступно для импортированных турниров'
                            : ''
                        "
                        @click="createGroupOpen = !createGroupOpen"
                      >
                        {{ createGroupOpen ? 'Скрыть' : 'Добавить' }}
                      </button>
                    </div>
                    <div class="input-group input-group-sm mb-2">
                      <span class="input-group-text"
                        ><i class="bi bi-search" aria-hidden="true"></i
                      ></span>
                      <input
                        v-model="detailGroupSearch"
                        type="search"
                        class="form-control"
                        placeholder="Поиск группы"
                        aria-label="Поиск группы"
                        :disabled="!detailStage"
                      />
                    </div>
                    <div v-if="detailGroupsError" class="text-danger small mb-2">
                      {{ detailGroupsError }}
                    </div>
                    <div
                      v-if="
                        detailStage &&
                        detailStage.id !== 'unassigned' &&
                        createGroupOpen &&
                        !isImportedTournament
                      "
                      class="border rounded-3 p-2 mb-2 bg-light-subtle"
                    >
                      <div v-if="createGroupError" class="text-danger small">
                        {{ createGroupError }}
                      </div>
                      <label class="form-label small">Название группы</label>
                      <input
                        v-model="createGroupForm.name"
                        type="text"
                        class="form-control form-control-sm mb-2"
                        placeholder="Название группы"
                        @input="createGroupError = ''"
                      />
                      <div class="row g-2">
                        <div class="col-6">
                          <label class="form-label small">Часы</label>
                          <input
                            v-model="createGroupForm.hours"
                            type="number"
                            class="form-control form-control-sm"
                            min="0"
                            max="24"
                            placeholder="0"
                            @input="createGroupError = ''"
                          />
                        </div>
                        <div class="col-6">
                          <label class="form-label small">Минуты</label>
                          <input
                            v-model="createGroupForm.minutes"
                            type="number"
                            class="form-control form-control-sm"
                            min="0"
                            max="59"
                            placeholder="00"
                            @input="createGroupError = ''"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        class="btn btn-brand btn-sm w-100 mt-2"
                        :disabled="createGroupLoading"
                        @click="submitCreateGroup"
                      >
                        <span
                          v-if="createGroupLoading"
                          class="spinner-border spinner-border-sm me-2"
                        ></span>
                        Создать группу
                      </button>
                    </div>
                    <BrandSpinner
                      v-if="detailGroupsLoading"
                      label="Загрузка"
                    />
                    <div v-else>
                      <div v-if="!detailStage" class="text-muted small">
                        Выберите этап слева, чтобы увидеть список групп.
                      </div>
                      <div
                        v-else-if="detailGroupsVisible.length"
                        class="list-group list-group-flush"
                      >
                        <button
                          v-for="g in detailGroupsVisible"
                          :key="g.id"
                          type="button"
                          class="list-group-item list-group-item-action hierarchy-item"
                          :class="{ active: detailGroup?.id === g.id }"
                          @click="openGroupDetail(g)"
                        >
                          <div
                            class="d-flex align-items-center justify-content-between"
                          >
                            <div class="fw-semibold">
                              {{ g.name || 'Группа' }}
                            </div>
                            <span class="badge bg-light text-muted border">
                              <i class="bi bi-clock me-1" aria-hidden="true"></i>
                              {{ formatDurationMinutes(g.match_duration_minutes) }}
                            </span>
                          </div>
                          <div class="small text-muted">
                            ID: {{ g.external_id || g.id }}
                          </div>
                        </button>
                      </div>
                      <div v-else class="text-muted small">
                        Группы не найдены.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-12 col-lg-4">
                <div class="card section-card shadow-sm h-100 hierarchy-card">
                  <div class="card-body">
                    <div
                      class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2"
                    >
                      <div>
                        <div class="fw-semibold">Команды</div>
                        <div class="small text-muted">
                          {{
                            detailGroup
                              ? `Группа: ${detailGroup.name || 'Группа'}`
                              : 'Выберите группу'
                          }}
                        </div>
                      </div>
                      <span
                        v-if="detailGroup"
                        class="badge bg-light text-muted border"
                      >
                        {{ detailTeamsVisible.length }}
                      </span>
                    </div>
                    <div class="input-group input-group-sm mb-2">
                      <span class="input-group-text"
                        ><i class="bi bi-search" aria-hidden="true"></i
                      ></span>
                      <input
                        v-model="detailTeamSearch"
                        type="search"
                        class="form-control"
                        placeholder="Поиск команды"
                        aria-label="Поиск команды"
                        :disabled="!detailGroup"
                      />
                    </div>
                    <div v-if="detailTeamsError" class="text-danger small mb-2">
                      {{ detailTeamsError }}
                    </div>
                    <BrandSpinner v-if="detailTeamsLoading" label="Загрузка" />
                    <div v-else>
                      <div v-if="!detailGroup" class="text-muted small">
                        Выберите группу, чтобы увидеть команды.
                      </div>
                      <div
                        v-else-if="detailTeamsVisible.length"
                        class="list-group list-group-flush"
                      >
                        <div
                          v-for="u in detailTeamsVisible"
                          :key="u.id"
                          class="list-group-item"
                        >
                          <div class="fw-semibold">
                            {{ u.team?.name || 'Команда' }}
                          </div>
                        </div>
                      </div>
                      <div v-else class="text-muted small">
                        Команды не найдены.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <template v-else>
            <div v-if="settingsError" class="alert alert-danger mb-2">
              {{ settingsError }}
            </div>
            <BrandSpinner v-if="settingsLoading" label="Загрузка" />
            <div v-else>
              <div v-if="settingsGroupsByStage.length" class="accordion">
                <div
                  v-for="bucket in settingsGroupsByStage"
                  :key="bucket.stage.id"
                  class="accordion-item"
                >
                  <h2
                    class="accordion-header"
                    :id="`heading-${bucket.stage.id}`"
                  >
                    <button
                      class="accordion-button"
                      type="button"
                      :class="{
                        collapsed: settingsOpenStageId !== bucket.stage.id,
                      }"
                      :aria-expanded="
                        settingsOpenStageId === bucket.stage.id ? 'true' : 'false'
                      "
                      :aria-controls="`stage-${bucket.stage.id}`"
                      @click="toggleSettingsStage(bucket.stage.id)"
                    >
                      {{ bucket.stage.name || 'Этап' }}
                    </button>
                  </h2>
                  <div
                    class="accordion-collapse collapse"
                    :class="{ show: settingsOpenStageId === bucket.stage.id }"
                    :id="`stage-${bucket.stage.id}`"
                    :aria-labelledby="`heading-${bucket.stage.id}`"
                  >
                    <div class="accordion-body">
                      <div v-if="bucket.groups.length">
                        <div
                          v-for="g in bucket.groups"
                          :key="g.id"
                          class="border rounded-3 p-3 mb-2"
                        >
                          <div
                            class="d-flex align-items-center justify-content-between flex-wrap gap-2"
                          >
                            <div class="fw-semibold">
                              {{ g.name || 'Группа' }}
                            </div>
                            <div class="small text-muted">
                              Идентификатор: {{ g.external_id || g.id }}
                            </div>
                          </div>
                          <div class="small text-muted mt-1">
                            Длительность матча
                          </div>
                          <div
                            v-if="settingsEdits[g.id]"
                            class="row g-2 align-items-end mt-1"
                          >
                            <div class="col-6 col-md-2">
                              <label class="form-label">Часы</label>
                              <input
                                v-model="settingsEdits[g.id].hours"
                                type="number"
                                class="form-control"
                                min="0"
                                max="24"
                                placeholder="0"
                                @input="
                                  () => {
                                    settingsEdits[g.id].dirty = true;
                                    settingsEdits[g.id].error = '';
                                  }
                                "
                              />
                            </div>
                            <div class="col-6 col-md-2">
                              <label class="form-label">Минуты</label>
                              <input
                                v-model="settingsEdits[g.id].minutes"
                                type="number"
                                class="form-control"
                                min="0"
                                max="59"
                                placeholder="00"
                                @input="
                                  () => {
                                    settingsEdits[g.id].dirty = true;
                                    settingsEdits[g.id].error = '';
                                  }
                                "
                              />
                            </div>
                            <div class="col-12 col-md-3">
                              <button
                                type="button"
                                class="btn btn-brand btn-sm w-100"
                                :disabled="
                                  settingsEdits[g.id].saving ||
                                  !settingsEdits[g.id].dirty
                                "
                                @click="saveGroupSettings(g)"
                              >
                                <span
                                  v-if="settingsEdits[g.id].saving"
                                  class="spinner-border spinner-border-sm me-2"
                                ></span>
                                Сохранить
                              </button>
                            </div>
                            <div
                              v-if="settingsEdits[g.id].error"
                              class="col-12"
                            >
                              <div class="text-danger small">
                                {{ settingsEdits[g.id].error }}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div v-else class="text-muted">
                        В этом этапе пока нет групп.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="alert alert-warning mb-0">
                Группы не найдены.
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Uses global .section-card from brand.css */
.hierarchy-card {
  min-height: 100%;
}
.hierarchy-item {
  border: 0;
  border-bottom: 1px solid var(--border-subtle);
}
.hierarchy-item:last-child {
  border-bottom: 0;
}
.hierarchy-item.active {
  background-color: var(--brand-color);
  border-color: var(--brand-color);
  color: #fff;
}
.hierarchy-item.active .text-muted {
  color: rgba(255, 255, 255, 0.75) !important;
}
.hierarchy-item.active .badge {
  background-color: #fff;
  border-color: #fff;
  color: var(--brand-color) !important;
}
.hierarchy-item.active .badge.text-muted {
  color: var(--brand-color) !important;
}
</style>
