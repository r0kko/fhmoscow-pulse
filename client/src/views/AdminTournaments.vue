<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import BrandSpinner from '../components/BrandSpinner.vue';
import PageNav from '../components/PageNav.vue';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import BaseTile from '../components/BaseTile.vue';
import { apiFetch } from '../api';
import { useToast } from '../utils/toast';
import { loadPageSize, savePageSize } from '../utils/pageSize';

const route = useRoute();
const router = useRouter();
const { showToast } = useToast();
const MOSCOW_TZ = 'Europe/Moscow';
const weekdayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// Shared search
const search = ref(route.query.q || '');
const seasonOptions = ref([]);
const tournamentTypeOptions = ref([]);
const competitionTypeOptions = ref([]);
const scheduleManagementOptions = ref([]);
const matchFormatOptions = ref([]);
const refereePaymentOptions = ref([]);
const groundOptions = ref([]);
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
  competition_type_id: '',
  schedule_management_type_id: '',
  match_format: '',
  referee_payment_type: '',
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
  const unassigned = {
    stage: { id: 'unassigned', name: 'Без этапа' },
    groups: [],
  };
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

const tournamentTeamAssignmentsByTeamId = computed(() => {
  const map = new Map();
  for (const assignment of tournamentTeams.value || []) {
    if (assignment.team?.id) {
      map.set(assignment.team.id, assignment);
    }
  }
  return map;
});

const scheduleTeamOptions = computed(() => {
  return [...(tournamentTeams.value || [])]
    .filter((assignment) => assignment.team?.id)
    .sort((a, b) => (a.team?.name || '').localeCompare(b.team?.name || ''));
});

const clubTeamsVisible = computed(() => {
  const term = normalizeSearchTerm(addTeamSearch.value);
  return (clubTeamsCatalog.value || [])
    .filter((team) => {
      const haystack = `${team.name || ''} ${team.club?.name || ''}`;
      return matchesSearch(haystack, term);
    })
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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

const detailBreadcrumbs = computed(() => {
  if (!detailTournament.value) {
    return [
      { label: 'Администрирование', to: '/admin' },
      { label: 'Управление спортивной частью', disabled: true },
      { label: 'Турниры' },
    ];
  }

  const items = [
    { label: 'Администрирование', to: '/admin' },
    { label: 'Управление спортивной частью', disabled: true },
    { label: 'Турниры', disabled: true },
    { label: detailTournament.value.name || 'Турнир' },
  ];

  if (detailMode.value === 'structure' && detailStage.value) {
    items.push({
      label: `Этап: ${detailStage.value.name || 'Без названия'}`,
    });
  }
  if (detailMode.value === 'structure' && detailGroup.value) {
    items.push({
      label: detailGroup.value.name || 'Группа',
    });
  }

  return items;
});

const tournamentSummary = computed(() => ({
  stages:
    detailStages.value.length || detailTournament.value?.counts?.stages || 0,
  groups:
    detailGroups.value.length || detailTournament.value?.counts?.groups || 0,
  teams:
    tournamentTeams.value.length || detailTournament.value?.counts?.teams || 0,
  matches: tournamentMatches.value.length,
}));

const detailModeTiles = computed(() => [
  {
    key: 'structure',
    title: 'Структура',
    subtitle: `${tournamentSummary.value.stages} этапов · ${tournamentSummary.value.groups} групп`,
    icon: 'bi-diagram-3',
  },
  {
    key: 'schedule',
    title: 'Расписание',
    subtitle: `${tournamentSummary.value.matches} матчей в календаре`,
    icon: 'bi-calendar3',
  },
  {
    key: 'settings',
    title: 'Настройки',
    subtitle: 'Параметры турнира, групп и судейства',
    icon: 'bi-sliders2',
  },
]);

const scheduleStageOptions = computed(() => {
  const options = [{ id: '', name: 'Все этапы' }];
  for (const stage of detailStages.value || []) {
    options.push({
      id: stage.id,
      name: stage.name || 'Этап без названия',
    });
  }
  if (detailGroups.value.some((group) => !group.stage_id)) {
    options.push({ id: 'unassigned', name: 'Матчи без этапа' });
  }
  return options;
});

const scheduleMatchesFiltered = computed(() => {
  if (!scheduleStageFilter.value) return tournamentMatches.value || [];
  if (scheduleStageFilter.value === 'unassigned') {
    return (tournamentMatches.value || []).filter((match) => !match.stage_id);
  }
  return (tournamentMatches.value || []).filter(
    (match) =>
      String(match.stage_id || '') === String(scheduleStageFilter.value)
  );
});

const scheduleMatchesSorted = computed(() => {
  return [...scheduleMatchesFiltered.value].sort(
    (a, b) =>
      new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
  );
});

const scheduleBucketsByDay = computed(() => {
  const map = new Map();
  for (const match of scheduleMatchesSorted.value) {
    const dayKey = toMoscowDayKey(match.date_start);
    if (!dayKey) continue;
    if (!map.has(dayKey)) map.set(dayKey, []);
    map.get(dayKey).push(match);
  }
  return map;
});

const todayMoscowDay = computed(() => toMoscowDayKey(new Date().toISOString()));

const scheduleMonthKeys = computed(() => {
  const keys = new Set();
  for (const dayKey of scheduleBucketsByDay.value.keys()) {
    keys.add(dayKey.slice(0, 7));
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
});

const activeScheduleMonth = computed(() => {
  if (scheduleMonthAnchor.value) return scheduleMonthAnchor.value;
  const todayMonth = todayMoscowDay.value?.slice(0, 7);
  if (todayMonth && scheduleMonthKeys.value.includes(todayMonth))
    return todayMonth;
  return scheduleMonthKeys.value[0] || todayMonth || formatMonthKey(new Date());
});

const scheduleCurrentMonthMatchDays = computed(() => {
  const monthKey = activeScheduleMonth.value;
  const keys = [...scheduleBucketsByDay.value.keys()]
    .filter((day) => day.startsWith(monthKey))
    .sort((a, b) => a.localeCompare(b));
  return keys;
});

const activeScheduleDay = computed(() => {
  const selected = scheduleSelectedDayKey.value;
  if (selected && selected.startsWith(activeScheduleMonth.value))
    return selected;

  const todayKey = todayMoscowDay.value;
  if (
    todayKey &&
    todayKey.startsWith(activeScheduleMonth.value) &&
    scheduleBucketsByDay.value.has(todayKey)
  ) {
    return todayKey;
  }
  return (
    scheduleCurrentMonthMatchDays.value[0] || `${activeScheduleMonth.value}-01`
  );
});

const scheduleDayMatches = computed(
  () => scheduleBucketsByDay.value.get(activeScheduleDay.value) || []
);

const scheduleCalendarCells = computed(() =>
  buildCalendarCells(
    activeScheduleMonth.value,
    scheduleBucketsByDay.value,
    activeScheduleDay.value,
    todayMoscowDay.value
  )
);

const scheduleMonthLabel = computed(() =>
  formatMonthLabel(activeScheduleMonth.value)
);

const schedulePastMatchesCount = computed(
  () => scheduleMatchesSorted.value.filter((match) => isPastMatch(match)).length
);

const scheduleUpcomingMatchesCount = computed(
  () => scheduleMatchesSorted.value.length - schedulePastMatchesCount.value
);

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
const tournamentTeams = ref([]);
const tournamentTeamsLoading = ref(false);
const tournamentTeamsError = ref('');
const clubTeamsCatalog = ref([]);
const clubTeamsCatalogLoading = ref(false);
const addTeamSearch = ref('');
const addTeamForm = ref({ team_id: '' });
const addTeamLoading = ref(false);
const addTeamError = ref('');
const stageMatches = ref([]);
const stageMatchesLoading = ref(false);
const stageMatchesError = ref('');
const createMatchForm = ref({
  date_start: '',
  ground_id: '',
  home_team_id: '',
  away_team_id: '',
});
const createMatchLoading = ref(false);
const createMatchError = ref('');
const tournamentMatches = ref([]);
const tournamentMatchesLoading = ref(false);
const tournamentMatchesError = ref('');
const scheduleStageFilter = ref('');
const scheduleMonthAnchor = ref('');
const scheduleSelectedDayKey = ref('');

const isImportedTournament = computed(
  () => detailTournament.value?.external_id != null
);

function resetMainSettings() {
  const tournament = detailTournament.value;
  mainSettings.value = {
    competition_type_id: tournament?.competition_type_id || '',
    schedule_management_type_id:
      tournament?.schedule_management_type_id ||
      resolveDefaultScheduleManagementId(),
    match_format: tournament?.match_format || '',
    referee_payment_type: tournament?.referee_payment_type || '',
    dirty: false,
    saving: false,
    error: '',
  };
}

const settingsStages = ref([]);
const settingsGroups = ref([]);
const settingsLoading = ref(false);
const settingsError = ref('');
const settingsEdits = ref({});
const settingsOpenStageId = ref(null);
const mainSettings = ref({
  competition_type_id: '',
  schedule_management_type_id: '',
  match_format: '',
  referee_payment_type: '',
  dirty: false,
  saving: false,
  error: '',
});
const refereeRoleGroups = ref([]);
const refereeEdits = ref({});
const refereeLoading = ref(false);
const refereeError = ref('');

function closeDetail() {
  detailTournament.value = null;
  detailStage.value = null;
  detailGroup.value = null;
  detailStages.value = [];
  detailGroups.value = [];
  detailTeams.value = [];
  tournamentTeams.value = [];
  stageMatches.value = [];
  tournamentMatches.value = [];
  clubTeamsCatalog.value = [];
  detailStagesError.value = '';
  detailGroupsError.value = '';
  detailTeamsError.value = '';
  tournamentTeamsError.value = '';
  stageMatchesError.value = '';
  tournamentMatchesError.value = '';
  detailMode.value = 'structure';
  scheduleStageFilter.value = '';
  scheduleMonthAnchor.value = '';
  scheduleSelectedDayKey.value = '';
  settingsStages.value = [];
  settingsGroups.value = [];
  settingsEdits.value = {};
  settingsOpenStageId.value = null;
  resetMainSettings();
  refereeRoleGroups.value = [];
  refereeEdits.value = {};
  refereeLoading.value = false;
  refereeError.value = '';
  createStageOpen.value = false;
  createGroupOpen.value = false;
  resetCreateStageForm();
  resetCreateGroupForm();
  resetAssignTeamForm();
  resetCreateMatchForm();
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
  return String(value || '')
    .trim()
    .toLowerCase();
}

function matchesSearch(value, term) {
  if (!term) return true;
  return String(value || '')
    .toLowerCase()
    .includes(term);
}

function resolveDefaultScheduleManagementId() {
  const options = scheduleManagementOptions.value || [];
  const preferred = options.find((o) => o.alias === 'PARTICIPANTS');
  return preferred?.id || options[0]?.id || '';
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

function formatTeamForSelect(team) {
  const assignment = tournamentTeamAssignmentsByTeamId.value.get(team.id);
  if (!assignment) {
    return team.club?.name
      ? `${team.name} (${team.club.name})`
      : (team.name ?? 'Команда');
  }
  const groupName = assignment.group?.name || 'без названия';
  if (
    detailGroup.value?.id &&
    assignment.tournament_group_id === detailGroup.value.id
  ) {
    return `${team.name} (уже в текущей группе)`;
  }
  return `${team.name} (сейчас в группе: ${groupName})`;
}

function formatMatchDateTime(value) {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  });
}

function formatMatchTime(value) {
  if (!value) return '—:—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—:—';
  return dt.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: MOSCOW_TZ,
  });
}

function getMoscowParts(value) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MOSCOW_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(dt);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) return null;
  return { year, month, day };
}

function toMoscowDayKey(value) {
  const parts = getMoscowParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : '';
}

function formatMonthKey(dateLike) {
  const parts = getMoscowParts(dateLike);
  if (!parts) return '';
  return `${parts.year}-${parts.month}`;
}

function shiftMonthKey(monthKey, delta) {
  const [yearRaw, monthRaw] = String(monthKey || '').split('-');
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12
  ) {
    return formatMonthKey(new Date());
  }
  const dt = new Date(Date.UTC(year, month - 1 + delta, 1));
  const nextYear = dt.getUTCFullYear();
  const nextMonth = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${nextYear}-${nextMonth}`;
}

function formatMonthLabel(monthKey) {
  const [yearRaw, monthRaw] = String(monthKey || '').split('-');
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 'Календарь';
  const dt = new Date(Date.UTC(year, month - 1, 1));
  return dt.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
    timeZone: MOSCOW_TZ,
  });
}

function isPastMatch(match) {
  const ts = new Date(match?.date_start || '').getTime();
  if (!Number.isFinite(ts)) return false;
  return ts < Date.now();
}

function formatScheduleDayTitle(dayKey) {
  const [yearRaw, monthRaw, dayRaw] = String(dayKey || '').split('-');
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  const day = Number.parseInt(dayRaw, 10);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return 'Выберите день';
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: MOSCOW_TZ,
  });
}

function buildCalendarCells(monthKey, matchesByDay, activeDayKey, todayDayKey) {
  const [yearRaw, monthRaw] = String(monthKey || '').split('-');
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return [];

  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingOffset = (firstDay.getUTCDay() + 6) % 7;
  const cells = [];

  for (let idx = 0; idx < leadingOffset; idx += 1) {
    cells.push({ key: `pad-${idx}`, inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const matches = matchesByDay.get(dayKey) || [];
    cells.push({
      key: dayKey,
      inMonth: true,
      day,
      dayKey,
      matchCount: matches.length,
      hasMatches: matches.length > 0,
      isSelected: dayKey === activeDayKey,
      isToday: dayKey === todayDayKey,
      isPast: dayKey < todayDayKey,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `tail-${cells.length}`, inMonth: false });
  }

  return cells;
}

async function openTournamentDetail(t) {
  const tournamentId = t?.id ? String(t.id) : '';
  if (!tournamentId) return;
  await router.push({
    name: 'adminTournamentStructure',
    params: { tournamentId },
  });
}

function backToTournamentStages() {
  detailGroup.value = null;
  detailTeams.value = [];
  stageMatches.value = [];
  detailTeamSearch.value = '';
  detailTeamsError.value = '';
  addTeamError.value = '';
  resetAssignTeamForm();
}

function backToTournamentsList() {
  closeDetail();
}

async function openStageDetail(s) {
  detailStage.value = s;
  detailGroup.value = null;
  detailTeams.value = [];
  stageMatches.value = [];
  detailGroupSearch.value = '';
  detailTeamSearch.value = '';
  detailGroupsError.value = '';
  detailTeamsError.value = '';
  stageMatchesError.value = '';
  resetAssignTeamForm();
  resetCreateMatchForm();
  createGroupOpen.value = false;
  resetCreateGroupForm();
  const jobs = [];
  if (!detailGroups.value.length) jobs.push(loadDetailGroups());
  jobs.push(loadStageMatches());
  await Promise.all(jobs);
}

async function openGroupDetail(g) {
  detailGroup.value = g;
  createGroupOpen.value = false;
  detailTeamSearch.value = '';
  detailTeamsError.value = '';
  addTeamError.value = '';
  if (!clubTeamsCatalog.value.length) {
    await loadClubTeamsCatalog();
  }
  await loadDetailTeams();
}

function openTournamentStructure() {
  detailMode.value = 'structure';
  if (!detailStages.value.length) loadDetailStages();
  if (!detailGroups.value.length) loadDetailGroups();
  if (!tournamentTeams.value.length) loadTournamentTeams();
  if (detailStage.value && detailStage.value.id !== 'unassigned') {
    loadStageMatches();
  }
}

async function openTournamentSchedule() {
  detailMode.value = 'schedule';
  createStageOpen.value = false;
  createGroupOpen.value = false;
  if (!detailStages.value.length) {
    await loadDetailStages();
  }
  await loadTournamentMatches();
}

async function openTournamentSettings() {
  detailMode.value = 'settings';
  createStageOpen.value = false;
  createGroupOpen.value = false;
  await loadTournamentSettings();
}

function openTournamentMode(mode) {
  if (mode === 'structure') {
    openTournamentStructure();
    return;
  }
  if (mode === 'schedule') {
    openTournamentSchedule();
    return;
  }
  openTournamentSettings();
}

function shiftScheduleMonth(delta) {
  scheduleMonthAnchor.value = shiftMonthKey(activeScheduleMonth.value, delta);
}

function jumpScheduleToToday() {
  const todayKey = todayMoscowDay.value;
  if (!todayKey) return;
  scheduleMonthAnchor.value = todayKey.slice(0, 7);
  scheduleSelectedDayKey.value = todayKey;
}

async function loadTournamentSettings() {
  if (!detailTournament.value) return;
  const tournamentId = detailTournament.value.id;
  settingsLoading.value = true;
  settingsError.value = '';
  refereeLoading.value = true;
  refereeError.value = '';
  try {
    const params = new URLSearchParams({
      page: '1',
      limit: '1000',
      tournament_id: tournamentId,
    });
    const [stagesRes, groupsRes, rolesRes, assignmentsRes] = await Promise.all([
      apiFetch(`/tournaments/stages?${params.toString()}`),
      apiFetch(`/tournaments/groups?${params.toString()}`),
      apiFetch('/tournaments/referee-roles'),
      apiFetch(`/tournaments/groups/referees?${params.toString()}`),
    ]);
    settingsStages.value = stagesRes.stages || [];
    settingsGroups.value = groupsRes.groups || [];
    refereeRoleGroups.value = rolesRes.groups || [];
    const assignments = assignmentsRes.assignments || [];
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
    const refereeMap = {};
    const roleIds = refereeRoleGroups.value.flatMap((group) =>
      (group.roles || []).map((role) => role.id)
    );
    const roleSet = new Set(roleIds);
    for (const g of settingsGroups.value) {
      refereeMap[g.id] = {
        counts: Object.fromEntries(roleIds.map((id) => [id, 0])),
        saving: false,
        error: '',
        dirty: false,
      };
    }
    for (const row of assignments) {
      if (!roleSet.has(row.referee_role_id)) continue;
      if (!refereeMap[row.tournament_group_id]) continue;
      refereeMap[row.tournament_group_id].counts[row.referee_role_id] =
        row.count ?? 0;
    }
    refereeEdits.value = refereeMap;
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
    refereeRoleGroups.value = [];
    refereeEdits.value = {};
    settingsError.value = e.message || 'Ошибка загрузки настроек';
    refereeError.value = e.message || 'Ошибка загрузки судей';
  } finally {
    settingsLoading.value = false;
    refereeLoading.value = false;
  }
}

function toggleSettingsStage(id) {
  settingsOpenStageId.value = settingsOpenStageId.value === id ? null : id;
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
    group.match_duration_minutes =
      updated.match_duration_minutes ?? parsed.value;
    edit.dirty = false;
    showToast('Настройки группы сохранены');
  } catch (e) {
    edit.error = e.message || 'Ошибка сохранения';
  } finally {
    edit.saving = false;
  }
}

async function saveMainSettings() {
  if (!detailTournament.value || mainSettings.value.saving) return;
  if (!mainSettings.value.schedule_management_type_id) {
    mainSettings.value.error = 'Укажите управление расписанием';
    return;
  }
  mainSettings.value.saving = true;
  mainSettings.value.error = '';
  try {
    const payload = {
      competition_type_id: mainSettings.value.competition_type_id || null,
      schedule_management_type_id:
        mainSettings.value.schedule_management_type_id || null,
      match_format: mainSettings.value.match_format || null,
      referee_payment_type: mainSettings.value.referee_payment_type || null,
    };
    const res = await apiFetch(`/tournaments/${detailTournament.value.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const updated = res.tournament || {};
    detailTournament.value = {
      ...detailTournament.value,
      ...updated,
    };
    mainSettings.value.dirty = false;
    showToast('Основные настройки сохранены');
  } catch (e) {
    mainSettings.value.error = e.message || 'Ошибка сохранения настроек';
  } finally {
    mainSettings.value.saving = false;
  }
}

async function saveGroupReferees(group) {
  const edit = refereeEdits.value[group.id];
  if (!edit || edit.saving) return;
  edit.saving = true;
  edit.error = '';
  try {
    const roles = Object.entries(edit.counts || {}).map(([roleId, count]) => ({
      role_id: roleId,
      count: Number(count),
    }));
    await apiFetch(`/tournaments/groups/${group.id}/referees`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles }),
    });
    edit.dirty = false;
    showToast('Судейский состав сохранён');
  } catch (e) {
    edit.error = e.message || 'Ошибка сохранения судей';
  } finally {
    edit.saving = false;
  }
}

function getRefereeCount(groupId, roleId) {
  return refereeEdits.value?.[groupId]?.counts?.[roleId] ?? 0;
}

function setRefereeCount(groupId, roleId, value) {
  const edit = refereeEdits.value?.[groupId];
  if (!edit) return;
  const parsed = Number.parseInt(String(value), 10);
  const safe = Number.isFinite(parsed) ? Math.min(2, Math.max(0, parsed)) : 0;
  edit.counts[roleId] = safe;
  edit.dirty = true;
  edit.error = '';
}

function resetCreateTournamentForm() {
  createTournamentForm.value = {
    name: '',
    full_name: '',
    birth_year: '',
    season_id: selectedSeasonId.value || '',
    type_id: '',
    competition_type_id: '',
    schedule_management_type_id: resolveDefaultScheduleManagementId(),
    match_format: '',
    referee_payment_type: '',
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
  if (!createTournamentForm.value.schedule_management_type_id) {
    createTournamentError.value = 'Укажите управление расписанием';
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
    if (createTournamentForm.value.competition_type_id)
      payload.competition_type_id =
        createTournamentForm.value.competition_type_id;
    if (createTournamentForm.value.schedule_management_type_id)
      payload.schedule_management_type_id =
        createTournamentForm.value.schedule_management_type_id;
    if (createTournamentForm.value.match_format)
      payload.match_format = createTournamentForm.value.match_format;
    if (createTournamentForm.value.referee_payment_type)
      payload.referee_payment_type =
        createTournamentForm.value.referee_payment_type;
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

function resetAssignTeamForm() {
  addTeamForm.value = { team_id: '' };
  addTeamSearch.value = '';
  addTeamError.value = '';
}

function resetCreateMatchForm() {
  createMatchForm.value = {
    date_start: '',
    ground_id: '',
    home_team_id: '',
    away_team_id: '',
  };
  createMatchError.value = '';
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

async function submitAssignTeamToGroup() {
  if (
    addTeamLoading.value ||
    !detailTournament.value ||
    !detailGroup.value ||
    !addTeamForm.value.team_id
  ) {
    return;
  }
  addTeamLoading.value = true;
  addTeamError.value = '';
  try {
    await apiFetch('/tournaments/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tournament_id: detailTournament.value.id,
        group_id: detailGroup.value.id,
        team_id: addTeamForm.value.team_id,
      }),
    });
    showToast('Команда добавлена в группу');
    addTeamForm.value.team_id = '';
    await Promise.all([
      loadDetailTeams(),
      loadTournamentTeams(),
      loadStageMatches(),
    ]);
  } catch (e) {
    addTeamError.value = e.message || 'Ошибка добавления команды';
  } finally {
    addTeamLoading.value = false;
  }
}

async function submitCreateStageMatch() {
  if (
    createMatchLoading.value ||
    !detailTournament.value ||
    !detailStage.value ||
    detailStage.value.id === 'unassigned'
  ) {
    return;
  }
  if (!createMatchForm.value.date_start) {
    createMatchError.value = 'Укажите дату и время матча';
    return;
  }
  if (
    !createMatchForm.value.home_team_id ||
    !createMatchForm.value.away_team_id
  ) {
    createMatchError.value = 'Выберите обе команды';
    return;
  }
  if (
    createMatchForm.value.home_team_id === createMatchForm.value.away_team_id
  ) {
    createMatchError.value = 'Для матча нужны две разные команды';
    return;
  }

  const parsedDate = new Date(`${createMatchForm.value.date_start}:00+03:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    createMatchError.value = 'Укажите корректные дату и время';
    return;
  }

  createMatchLoading.value = true;
  createMatchError.value = '';
  try {
    await apiFetch('/tournaments/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tournament_id: detailTournament.value.id,
        stage_id: detailStage.value.id,
        ground_id: createMatchForm.value.ground_id || null,
        home_team_id: createMatchForm.value.home_team_id,
        away_team_id: createMatchForm.value.away_team_id,
        date_start: parsedDate.toISOString(),
      }),
    });
    showToast('Матч добавлен в расписание');
    resetCreateMatchForm();
    await Promise.all([loadStageMatches(), loadTournamentMatches()]);
  } catch (e) {
    createMatchError.value = e.message || 'Ошибка добавления матча';
  } finally {
    createMatchLoading.value = false;
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

async function loadTournamentTeams() {
  if (!detailTournament.value) return;
  tournamentTeamsLoading.value = true;
  tournamentTeamsError.value = '';
  try {
    const p = new URLSearchParams({
      page: '1',
      limit: '1000',
      tournament_id: detailTournament.value.id,
    });
    const r = await apiFetch(`/tournaments/teams?${p.toString()}`);
    tournamentTeams.value = r.teams || [];
  } catch (e) {
    tournamentTeams.value = [];
    tournamentTeamsError.value = e.message || 'Ошибка загрузки команд турнира';
  } finally {
    tournamentTeamsLoading.value = false;
  }
}

async function loadClubTeamsCatalog() {
  clubTeamsCatalogLoading.value = true;
  try {
    const p = new URLSearchParams({
      page: '1',
      limit: '1000',
      status: 'ACTIVE',
    });
    const r = await apiFetch(`/teams?${p.toString()}`);
    clubTeamsCatalog.value = r.teams || [];
  } catch (_) {
    clubTeamsCatalog.value = [];
  } finally {
    clubTeamsCatalogLoading.value = false;
  }
}

async function loadStageMatches() {
  if (
    !detailTournament.value ||
    !detailStage.value ||
    detailStage.value.id === 'unassigned'
  ) {
    stageMatches.value = [];
    stageMatchesError.value = '';
    return;
  }
  stageMatchesLoading.value = true;
  stageMatchesError.value = '';
  try {
    const p = new URLSearchParams({
      page: '1',
      limit: '1000',
      tournament_id: detailTournament.value.id,
      stage_id: detailStage.value.id,
    });
    const r = await apiFetch(`/tournaments/matches?${p.toString()}`);
    stageMatches.value = r.matches || [];
  } catch (e) {
    stageMatches.value = [];
    stageMatchesError.value = e.message || 'Ошибка загрузки расписания';
  } finally {
    stageMatchesLoading.value = false;
  }
}

async function loadTournamentMatches() {
  if (!detailTournament.value) return;
  tournamentMatchesLoading.value = true;
  tournamentMatchesError.value = '';
  try {
    const params = new URLSearchParams({
      page: '1',
      limit: '2000',
      tournament_id: detailTournament.value.id,
    });
    const response = await apiFetch(
      `/tournaments/matches?${params.toString()}`
    );
    tournamentMatches.value = response.matches || [];
  } catch (e) {
    tournamentMatches.value = [];
    tournamentMatchesError.value = e.message || 'Ошибка загрузки календаря';
  } finally {
    tournamentMatchesLoading.value = false;
  }
}

async function loadFilters() {
  try {
    const [seasonsRes, activeRes, typesRes, settingsRes, groundsRes] =
      await Promise.all([
        apiFetch('/seasons?limit=1000'),
        apiFetch('/seasons/active'),
        apiFetch('/tournaments/types'),
        apiFetch('/tournaments/settings-options'),
        apiFetch('/grounds?limit=1000&order_by=name&order=ASC'),
      ]);
    seasonOptions.value = (seasonsRes.seasons || []).map((s) => ({
      id: s.id,
      name: s.name,
    }));
    tournamentTypeOptions.value = (typesRes.types || []).map((t) => ({
      id: t.id,
      name: t.name,
    }));
    competitionTypeOptions.value = (settingsRes.competition_types || []).map(
      (t) => ({
        id: t.id,
        name: t.name,
      })
    );
    scheduleManagementOptions.value = (
      settingsRes.schedule_management_types || []
    ).map((t) => ({
      id: t.id,
      name: t.name,
      alias: t.alias,
    }));
    matchFormatOptions.value = settingsRes.match_formats || [];
    refereePaymentOptions.value = settingsRes.referee_payment_types || [];
    groundOptions.value = (groundsRes.grounds || []).map((ground) => ({
      id: ground.id,
      name: ground.name || 'Без названия',
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

watch(scheduleStageFilter, () => {
  scheduleSelectedDayKey.value = '';
  const todayMonth =
    todayMoscowDay.value?.slice(0, 7) || formatMonthKey(new Date());
  if (scheduleMonthKeys.value.includes(todayMonth)) {
    scheduleMonthAnchor.value = todayMonth;
    return;
  }
  scheduleMonthAnchor.value = scheduleMonthKeys.value[0] || todayMonth;
});

// Quick transitions: click counts now open tournament detail
</script>

<template>
  <div class="py-4 admin-tournaments-page">
    <div class="container">
      <Breadcrumbs class="mb-2" :items="detailBreadcrumbs" />
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
                    <label class="form-label">Тип турнира</label>
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
                  <div class="col-12 col-lg-4">
                    <label class="form-label">Тип соревнований</label>
                    <select
                      v-model="createTournamentForm.competition_type_id"
                      class="form-select"
                    >
                      <option value="">Не задан</option>
                      <option
                        v-for="t in competitionTypeOptions"
                        :key="t.id"
                        :value="t.id"
                      >
                        {{ t.name }}
                      </option>
                    </select>
                  </div>
                  <div class="col-12 col-lg-4">
                    <label class="form-label">Управление расписанием</label>
                    <select
                      v-model="createTournamentForm.schedule_management_type_id"
                      class="form-select"
                    >
                      <option value="">Выберите вариант</option>
                      <option
                        v-for="option in scheduleManagementOptions"
                        :key="option.id"
                        :value="option.id"
                      >
                        {{ option.name }}
                      </option>
                    </select>
                  </div>
                  <div class="col-12 col-lg-4">
                    <label class="form-label">Формат проведения</label>
                    <select
                      v-model="createTournamentForm.match_format"
                      class="form-select"
                    >
                      <option value="">Не задан</option>
                      <option
                        v-for="format in matchFormatOptions"
                        :key="format.value"
                        :value="format.value"
                      >
                        {{ format.label }}
                      </option>
                    </select>
                  </div>
                  <div class="col-12 col-lg-4">
                    <label class="form-label">Расчеты с судьями</label>
                    <select
                      v-model="createTournamentForm.referee_payment_type"
                      class="form-select"
                    >
                      <option value="">Не задано</option>
                      <option
                        v-for="option in refereePaymentOptions"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </div>
                  <div class="col-12 d-flex align-items-end">
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
      <div v-else>
        <div
          class="card section-card tile fade-in shadow-sm mb-3 tournament-hub"
        >
          <div class="card-body">
            <div
              class="d-flex align-items-start justify-content-between gap-3 flex-wrap"
            >
              <div>
                <h2 class="h4 mb-1">{{ detailTournament.name }}</h2>
                <div class="small text-muted d-flex flex-wrap gap-2">
                  <span>Сезон: {{ detailTournament.season?.name || '—' }}</span>
                  <span>Год: {{ detailTournament.birth_year || '—' }}</span>
                  <span>Команд: {{ tournamentSummary.teams }}</span>
                </div>
              </div>
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                @click="backToTournamentsList"
              >
                К списку турниров
              </button>
            </div>
            <div class="row g-2 mt-1">
              <div
                v-for="tile in detailModeTiles"
                :key="tile.key"
                class="col-12 col-md-6 col-xl-4"
              >
                <BaseTile
                  role="button"
                  :extra-class="[
                    'h-100 mode-tile',
                    detailMode === tile.key ? 'mode-tile--active' : '',
                  ]"
                  :aria-label="`Открыть раздел ${tile.title}`"
                  @click="openTournamentMode(tile.key)"
                >
                  <div class="card-body">
                    <div
                      class="d-flex align-items-start justify-content-between"
                    >
                      <div>
                        <div class="fw-semibold">{{ tile.title }}</div>
                        <div class="small text-muted mt-1">
                          {{ tile.subtitle }}
                        </div>
                      </div>
                      <i :class="`bi ${tile.icon} fs-4 text-brand`"></i>
                    </div>
                  </div>
                </BaseTile>
              </div>
            </div>
          </div>
          <div class="card-body pt-0">
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
        </div>

        <div class="card section-card tile fade-in shadow-sm">
          <div class="card-body">
            <template v-if="detailMode === 'structure'">
              <div
                v-if="isImportedTournament"
                class="alert alert-info small mb-3"
              >
                Турнир импортирован из внешней системы. Редактирование
                структуры, добавление команд и ручное расписание матчей
                недоступны.
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
                      <div
                        v-if="detailStagesError"
                        class="text-danger small mb-2"
                      >
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
                                {{ s.name || 'Этап без названия' }}
                              </div>
                              <span class="badge bg-light text-muted border">
                                {{ detailGroupCountsByStage.get(s.id) || 0 }}
                              </span>
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
                                ? `Этап: ${detailStage.name || 'Без названия'}`
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
                      <div
                        v-if="detailGroupsError"
                        class="text-danger small mb-2"
                      >
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
                                <i
                                  class="bi bi-clock me-1"
                                  aria-hidden="true"
                                ></i>
                                {{
                                  formatDurationMinutes(
                                    g.match_duration_minutes
                                  )
                                }}
                              </span>
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
                      <div
                        v-if="detailTeamsError"
                        class="text-danger small mb-2"
                      >
                        {{ detailTeamsError }}
                      </div>
                      <div
                        v-if="detailGroup && !isImportedTournament"
                        class="border rounded-3 p-2 mb-2 bg-light-subtle"
                      >
                        <div class="small fw-semibold mb-1">
                          Добавить команду в группу
                        </div>
                        <div v-if="addTeamError" class="text-danger small mb-1">
                          {{ addTeamError }}
                        </div>
                        <div class="input-group input-group-sm mb-2">
                          <span class="input-group-text"
                            ><i class="bi bi-search" aria-hidden="true"></i
                          ></span>
                          <input
                            v-model="addTeamSearch"
                            type="search"
                            class="form-control"
                            placeholder="Поиск по названию команды или клуба"
                          />
                        </div>
                        <select
                          v-model="addTeamForm.team_id"
                          class="form-select form-select-sm mb-2"
                          :disabled="addTeamLoading || clubTeamsCatalogLoading"
                        >
                          <option value="">Выберите команду</option>
                          <option
                            v-for="team in clubTeamsVisible"
                            :key="team.id"
                            :value="team.id"
                          >
                            {{ formatTeamForSelect(team) }}
                          </option>
                        </select>
                        <button
                          type="button"
                          class="btn btn-brand btn-sm w-100"
                          :disabled="
                            addTeamLoading ||
                            clubTeamsCatalogLoading ||
                            !addTeamForm.team_id
                          "
                          @click="submitAssignTeamToGroup"
                        >
                          <span
                            v-if="addTeamLoading"
                            class="spinner-border spinner-border-sm me-2"
                          ></span>
                          Добавить в группу
                        </button>
                      </div>
                      <div
                        v-else-if="detailGroup && isImportedTournament"
                        class="text-muted small mb-2"
                      >
                        Для импортированных турниров добавление команд в группы
                        недоступно.
                      </div>
                      <BrandSpinner
                        v-if="detailTeamsLoading"
                        label="Загрузка"
                      />
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
                <div
                  v-if="detailStage && detailStage.id !== 'unassigned'"
                  class="col-12"
                >
                  <div class="card section-card shadow-sm mt-1">
                    <div class="card-body">
                      <div
                        class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2"
                      >
                        <div>
                          <div class="fw-semibold">Расписание матчей этапа</div>
                          <div class="small text-muted">
                            {{ detailStage?.name || 'Этап без названия' }}
                          </div>
                        </div>
                      </div>
                      <div
                        v-if="stageMatchesError"
                        class="text-danger small mb-2"
                      >
                        {{ stageMatchesError }}
                      </div>
                      <div
                        v-if="!isImportedTournament"
                        class="border rounded-3 p-3 mb-3 bg-light-subtle"
                      >
                        <div
                          v-if="createMatchError"
                          class="text-danger small mb-2"
                        >
                          {{ createMatchError }}
                        </div>
                        <div class="row g-2 align-items-end">
                          <div class="col-12 col-lg-3">
                            <label class="form-label">Дата и время</label>
                            <input
                              v-model="createMatchForm.date_start"
                              type="datetime-local"
                              class="form-control"
                              :disabled="createMatchLoading"
                            />
                          </div>
                          <div class="col-12 col-lg-3">
                            <label class="form-label">Стадион</label>
                            <select
                              v-model="createMatchForm.ground_id"
                              class="form-select"
                              :disabled="createMatchLoading"
                            >
                              <option value="">Не указан</option>
                              <option
                                v-for="ground in groundOptions"
                                :key="ground.id"
                                :value="ground.id"
                              >
                                {{ ground.name }}
                              </option>
                            </select>
                          </div>
                          <div class="col-12 col-lg-3">
                            <label class="form-label">Команда 1</label>
                            <select
                              v-model="createMatchForm.home_team_id"
                              class="form-select"
                              :disabled="
                                createMatchLoading || tournamentTeamsLoading
                              "
                            >
                              <option value="">Выберите команду</option>
                              <option
                                v-for="assignment in scheduleTeamOptions"
                                :key="assignment.id"
                                :value="assignment.team.id"
                              >
                                {{ assignment.team.name }}
                              </option>
                            </select>
                          </div>
                          <div class="col-12 col-lg-2">
                            <label class="form-label">Команда 2</label>
                            <select
                              v-model="createMatchForm.away_team_id"
                              class="form-select"
                              :disabled="
                                createMatchLoading || tournamentTeamsLoading
                              "
                            >
                              <option value="">Выберите команду</option>
                              <option
                                v-for="assignment in scheduleTeamOptions"
                                :key="`away-${assignment.id}`"
                                :value="assignment.team.id"
                              >
                                {{ assignment.team.name }}
                              </option>
                            </select>
                          </div>
                          <div class="col-12 col-lg-1 d-grid">
                            <button
                              type="button"
                              class="btn btn-brand"
                              :disabled="
                                createMatchLoading ||
                                tournamentTeamsLoading ||
                                !createMatchForm.date_start ||
                                !createMatchForm.home_team_id ||
                                !createMatchForm.away_team_id
                              "
                              @click="submitCreateStageMatch"
                            >
                              <span
                                v-if="createMatchLoading"
                                class="spinner-border spinner-border-sm me-2"
                              ></span>
                              Добавить
                            </button>
                          </div>
                        </div>
                        <div
                          v-if="tournamentTeamsError"
                          class="text-danger small mt-2"
                        >
                          {{ tournamentTeamsError }}
                        </div>
                      </div>
                      <div v-else class="text-muted small mb-3">
                        Для импортированных турниров ручное добавление матчей
                        недоступно.
                      </div>
                      <BrandSpinner
                        v-if="stageMatchesLoading"
                        label="Загрузка расписания"
                      />
                      <div v-else>
                        <div
                          v-if="stageMatches.length"
                          class="table-responsive"
                        >
                          <table class="table table-sm align-middle mb-0">
                            <thead>
                              <tr>
                                <th>Дата и время</th>
                                <th>Стадион</th>
                                <th>Команда 1</th>
                                <th>Команда 2</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr v-for="match in stageMatches" :key="match.id">
                                <td>
                                  {{ formatMatchDateTime(match.date_start) }}
                                </td>
                                <td>{{ match.ground?.name || '—' }}</td>
                                <td>{{ match.home_team?.name || '—' }}</td>
                                <td>{{ match.away_team?.name || '—' }}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div v-else class="text-muted small">
                          Матчи на этапе пока не добавлены.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <template v-else-if="detailMode === 'schedule'">
              <div class="row g-3 align-items-end mb-3">
                <div class="col-12 col-lg-4">
                  <label class="form-label">Этап</label>
                  <select
                    v-model="scheduleStageFilter"
                    class="form-select"
                    aria-label="Фильтр расписания по этапу"
                  >
                    <option
                      v-for="option in scheduleStageOptions"
                      :key="option.id || 'all'"
                      :value="option.id"
                    >
                      {{ option.name }}
                    </option>
                  </select>
                </div>
                <div class="col-12 col-lg-8">
                  <label class="form-label">Календарь</label>
                  <div class="d-flex flex-wrap gap-2">
                    <button
                      type="button"
                      class="btn btn-outline-secondary"
                      aria-label="Предыдущий месяц"
                      @click="shiftScheduleMonth(-1)"
                    >
                      <i class="bi bi-chevron-left" aria-hidden="true"></i>
                    </button>
                    <div class="form-control text-center fw-semibold">
                      {{ scheduleMonthLabel }}
                    </div>
                    <button
                      type="button"
                      class="btn btn-outline-secondary"
                      aria-label="Следующий месяц"
                      @click="shiftScheduleMonth(1)"
                    >
                      <i class="bi bi-chevron-right" aria-hidden="true"></i>
                    </button>
                    <button
                      type="button"
                      class="btn btn-outline-brand"
                      @click="jumpScheduleToToday"
                    >
                      Сегодня
                    </button>
                  </div>
                </div>
              </div>

              <div
                v-if="tournamentMatchesError"
                class="alert alert-danger mb-3"
              >
                {{ tournamentMatchesError }}
              </div>

              <div class="row g-2 mb-3">
                <div class="col-12 col-md-4">
                  <div class="border rounded-3 p-2 h-100 schedule-metric">
                    <div class="small text-muted">Матчей всего</div>
                    <div class="h5 mb-0">
                      {{ scheduleMatchesSorted.length }}
                    </div>
                  </div>
                </div>
                <div class="col-12 col-md-4">
                  <div class="border rounded-3 p-2 h-100 schedule-metric">
                    <div class="small text-muted">Предстоящие</div>
                    <div class="h5 mb-0">
                      {{ scheduleUpcomingMatchesCount }}
                    </div>
                  </div>
                </div>
                <div class="col-12 col-md-4">
                  <div class="border rounded-3 p-2 h-100 schedule-metric">
                    <div class="small text-muted">Прошедшие</div>
                    <div class="h5 mb-0">{{ schedulePastMatchesCount }}</div>
                  </div>
                </div>
              </div>

              <BrandSpinner
                v-if="tournamentMatchesLoading"
                label="Загрузка календаря турнира"
              />
              <template v-else>
                <div class="row g-3">
                  <div class="col-12 col-lg-5">
                    <div class="border rounded-3 p-3 h-100">
                      <div class="calendar-weekdays mb-2">
                        <span
                          v-for="weekday in weekdayLabels"
                          :key="weekday"
                          class="calendar-weekday"
                        >
                          {{ weekday }}
                        </span>
                      </div>
                      <div class="calendar-grid">
                        <template
                          v-for="cell in scheduleCalendarCells"
                          :key="cell.key"
                        >
                          <button
                            v-if="cell.inMonth"
                            type="button"
                            class="calendar-cell"
                            :class="{
                              'calendar-cell--selected': cell.isSelected,
                              'calendar-cell--today': cell.isToday,
                              'calendar-cell--has-matches': cell.hasMatches,
                              'calendar-cell--past': cell.isPast,
                            }"
                            :aria-label="`Выбрать ${cell.day}`"
                            @click="scheduleSelectedDayKey = cell.dayKey"
                          >
                            <span class="calendar-day-number">{{
                              cell.day
                            }}</span>
                            <span
                              v-if="cell.matchCount"
                              class="badge bg-light text-muted border"
                            >
                              {{ cell.matchCount }}
                            </span>
                          </button>
                          <div
                            v-else
                            class="calendar-cell calendar-cell--empty"
                          ></div>
                        </template>
                      </div>
                    </div>
                  </div>
                  <div class="col-12 col-lg-7">
                    <div class="border rounded-3 p-3 h-100">
                      <div
                        class="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-2"
                      >
                        <div>
                          <div class="fw-semibold">
                            {{ formatScheduleDayTitle(activeScheduleDay) }}
                          </div>
                          <div class="small text-muted">
                            Матчей за день: {{ scheduleDayMatches.length }}
                          </div>
                        </div>
                        <RouterLink
                          class="btn btn-outline-secondary btn-sm"
                          :to="{
                            path: '/admin/sports-calendar',
                            query: { tournament: detailTournament.name },
                          }"
                        >
                          Открыть общий календарь
                        </RouterLink>
                      </div>

                      <div
                        v-if="scheduleDayMatches.length"
                        class="list-group list-group-flush"
                      >
                        <div
                          v-for="match in scheduleDayMatches"
                          :key="`day-${match.id}`"
                          class="list-group-item px-0 schedule-match-item"
                        >
                          <div
                            class="d-flex align-items-start justify-content-between gap-2 flex-wrap"
                          >
                            <div>
                              <div class="fw-semibold">
                                {{ match.home_team?.name || '—' }} —
                                {{ match.away_team?.name || '—' }}
                              </div>
                              <div class="small text-muted">
                                {{
                                  match.stage?.name
                                    ? `Этап: ${match.stage.name}`
                                    : 'Этап не указан'
                                }}
                                ·
                                {{ match.ground?.name || 'Стадион не указан' }}
                              </div>
                            </div>
                            <div class="text-end">
                              <div class="fw-semibold">
                                {{ formatMatchTime(match.date_start) }}
                              </div>
                              <span
                                class="badge"
                                :class="
                                  isPastMatch(match)
                                    ? 'text-bg-secondary'
                                    : 'badge-brand'
                                "
                              >
                                {{
                                  isPastMatch(match)
                                    ? 'Прошедший'
                                    : 'Предстоящий'
                                }}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div v-else class="text-muted small">
                        На выбранный день матчи не назначены.
                      </div>
                    </div>
                  </div>
                </div>

                <div class="border rounded-3 p-3 mt-3">
                  <div class="fw-semibold mb-2">Лента матчей турнира</div>
                  <div
                    v-if="scheduleMatchesSorted.length"
                    class="table-responsive"
                  >
                    <table class="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Дата и время</th>
                          <th>Этап</th>
                          <th>Матч</th>
                          <th>Стадион</th>
                          <th>Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="match in scheduleMatchesSorted"
                          :key="`all-${match.id}`"
                        >
                          <td>{{ formatMatchDateTime(match.date_start) }}</td>
                          <td>{{ match.stage?.name || '—' }}</td>
                          <td>
                            {{ match.home_team?.name || '—' }} —
                            {{ match.away_team?.name || '—' }}
                          </td>
                          <td>{{ match.ground?.name || '—' }}</td>
                          <td>
                            <span
                              class="badge"
                              :class="
                                isPastMatch(match)
                                  ? 'text-bg-secondary'
                                  : 'badge-brand'
                              "
                            >
                              {{
                                isPastMatch(match) ? 'Прошедший' : 'Предстоящий'
                              }}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div v-else class="text-muted small">
                    В этом фильтре пока нет матчей.
                  </div>
                </div>
              </template>
            </template>
            <template v-else-if="detailMode === 'settings'">
              <div v-if="settingsError" class="alert alert-danger mb-2">
                {{ settingsError }}
              </div>
              <BrandSpinner v-if="settingsLoading" label="Загрузка" />
              <div v-else>
                <div class="card section-card tile fade-in shadow-sm mb-3">
                  <div class="card-body">
                    <div
                      class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2"
                    >
                      <div class="fw-semibold">Основные настройки</div>
                      <div class="text-muted small">
                        {{ detailTournament?.name || 'Турнир' }}
                      </div>
                    </div>
                    <div v-if="mainSettings.error" class="alert alert-danger">
                      {{ mainSettings.error }}
                    </div>
                    <div class="row g-3 align-items-end">
                      <div class="col-12 col-lg-4">
                        <label class="form-label">Тип соревнований</label>
                        <select
                          v-model="mainSettings.competition_type_id"
                          class="form-select"
                          :disabled="mainSettings.saving"
                          @change="
                            () => {
                              mainSettings.dirty = true;
                              mainSettings.error = '';
                            }
                          "
                        >
                          <option value="">Не задан</option>
                          <option
                            v-for="t in competitionTypeOptions"
                            :key="t.id"
                            :value="t.id"
                          >
                            {{ t.name }}
                          </option>
                        </select>
                      </div>
                      <div class="col-12 col-lg-4">
                        <label class="form-label">Управление расписанием</label>
                        <select
                          v-model="mainSettings.schedule_management_type_id"
                          class="form-select"
                          :disabled="mainSettings.saving"
                          @change="
                            () => {
                              mainSettings.dirty = true;
                              mainSettings.error = '';
                            }
                          "
                        >
                          <option value="">Выберите вариант</option>
                          <option
                            v-for="option in scheduleManagementOptions"
                            :key="option.id"
                            :value="option.id"
                          >
                            {{ option.name }}
                          </option>
                        </select>
                      </div>
                      <div class="col-12 col-lg-4">
                        <label class="form-label">Формат проведения</label>
                        <select
                          v-model="mainSettings.match_format"
                          class="form-select"
                          :disabled="mainSettings.saving"
                          @change="
                            () => {
                              mainSettings.dirty = true;
                              mainSettings.error = '';
                            }
                          "
                        >
                          <option value="">Не задан</option>
                          <option
                            v-for="format in matchFormatOptions"
                            :key="format.value"
                            :value="format.value"
                          >
                            {{ format.label }}
                          </option>
                        </select>
                      </div>
                      <div class="col-12 col-lg-4">
                        <label class="form-label">Расчеты с судьями</label>
                        <select
                          v-model="mainSettings.referee_payment_type"
                          class="form-select"
                          :disabled="mainSettings.saving"
                          @change="
                            () => {
                              mainSettings.dirty = true;
                              mainSettings.error = '';
                            }
                          "
                        >
                          <option value="">Не задано</option>
                          <option
                            v-for="option in refereePaymentOptions"
                            :key="option.value"
                            :value="option.value"
                          >
                            {{ option.label }}
                          </option>
                        </select>
                      </div>
                      <div class="col-12 col-lg-3">
                        <button
                          type="button"
                          class="btn btn-brand btn-sm w-100"
                          :disabled="mainSettings.saving || !mainSettings.dirty"
                          @click="saveMainSettings"
                        >
                          <span
                            v-if="mainSettings.saving"
                            class="spinner-border spinner-border-sm me-2"
                          ></span>
                          Сохранить
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="settingsGroupsByStage.length" class="accordion">
                  <div
                    v-for="bucket in settingsGroupsByStage"
                    :key="bucket.stage.id"
                    class="accordion-item"
                  >
                    <h2
                      :id="`heading-${bucket.stage.id}`"
                      class="accordion-header"
                    >
                      <button
                        class="accordion-button"
                        type="button"
                        :class="{
                          collapsed: settingsOpenStageId !== bucket.stage.id,
                        }"
                        :aria-expanded="
                          settingsOpenStageId === bucket.stage.id
                            ? 'true'
                            : 'false'
                        "
                        :aria-controls="`stage-${bucket.stage.id}`"
                        @click="toggleSettingsStage(bucket.stage.id)"
                      >
                        {{ bucket.stage.name || 'Этап' }}
                      </button>
                    </h2>
                    <div
                      :id="`stage-${bucket.stage.id}`"
                      class="accordion-collapse collapse"
                      :class="{ show: settingsOpenStageId === bucket.stage.id }"
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
                            <div class="mt-3">
                              <div class="fw-semibold">Судейский состав</div>
                              <div
                                v-if="refereeError"
                                class="text-danger small"
                              >
                                {{ refereeError }}
                              </div>
                              <div v-else-if="refereeRoleGroups.length">
                                <div
                                  v-for="rg in refereeRoleGroups"
                                  :key="rg.id"
                                  class="mt-2"
                                >
                                  <div class="small text-muted mb-1">
                                    {{ rg.name }}
                                  </div>
                                  <div class="row g-2">
                                    <div
                                      v-for="role in rg.roles"
                                      :key="role.id"
                                      class="col-6 col-lg-4"
                                    >
                                      <label class="form-label small">{{
                                        role.name
                                      }}</label>
                                      <select
                                        :value="getRefereeCount(g.id, role.id)"
                                        class="form-select form-select-sm"
                                        :disabled="
                                          refereeLoading || !refereeEdits[g.id]
                                        "
                                        @change="
                                          setRefereeCount(
                                            g.id,
                                            role.id,
                                            $event.target.value
                                          )
                                        "
                                      >
                                        <option :value="0">0</option>
                                        <option :value="1">1</option>
                                        <option :value="2">2</option>
                                      </select>
                                    </div>
                                  </div>
                                </div>
                                <div
                                  v-if="refereeEdits[g.id]?.error"
                                  class="text-danger small mt-2"
                                >
                                  {{ refereeEdits[g.id].error }}
                                </div>
                                <button
                                  type="button"
                                  class="btn btn-brand btn-sm mt-2"
                                  :disabled="
                                    refereeLoading ||
                                    !refereeEdits[g.id]?.dirty ||
                                    refereeEdits[g.id]?.saving
                                  "
                                  @click="saveGroupReferees(g)"
                                >
                                  <span
                                    v-if="refereeEdits[g.id]?.saving"
                                    class="spinner-border spinner-border-sm me-2"
                                  ></span>
                                  Сохранить судейский состав
                                </button>
                              </div>
                              <div v-else class="text-muted small">
                                Должности судей не настроены.
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

.tournament-hub {
  background:
    radial-gradient(
      circle at right top,
      rgba(17, 56, 103, 0.08),
      rgba(17, 56, 103, 0) 45%
    ),
    #fff;
}

.mode-tile {
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.mode-tile .card-body {
  min-height: 112px;
}

.mode-tile--active {
  border-color: var(--brand-color) !important;
  background: rgba(17, 56, 103, 0.06);
}

.mode-tile--active .text-muted {
  color: rgba(17, 56, 103, 0.9) !important;
}

.schedule-metric {
  background: rgba(17, 56, 103, 0.03);
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.35rem;
}

.calendar-weekday {
  text-align: center;
  font-size: 0.8rem;
  color: var(--bs-secondary-color);
  font-weight: 600;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.35rem;
}

.calendar-cell {
  min-height: 72px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: #fff;
  padding: 0.35rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
}

.calendar-cell--empty {
  visibility: hidden;
}

.calendar-cell--has-matches {
  border-color: rgba(17, 56, 103, 0.32);
}

.calendar-cell--selected {
  border-color: var(--brand-color);
  box-shadow: 0 0 0 1px rgba(17, 56, 103, 0.28);
}

.calendar-cell--today {
  background: rgba(17, 56, 103, 0.06);
}

.calendar-cell--past .calendar-day-number {
  color: var(--bs-secondary-color);
}

.calendar-day-number {
  font-weight: 600;
  font-size: 0.95rem;
}

.schedule-match-item {
  border-bottom: 1px solid var(--border-subtle);
}

.schedule-match-item:last-child {
  border-bottom: 0;
}
</style>
