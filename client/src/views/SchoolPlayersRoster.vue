<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import { apiFetch, apiFetchBlobResponse } from '../api';
import EditPlayerRosterModal from '../components/EditPlayerRosterModal.vue';

const route = useRoute();
const isAdminView = computed(() => (route.path || '').startsWith('/admin'));
const rosterLoading = ref(false);
const staffLoading = ref(false);
const summaryLoading = ref(false);
const summaryExporting = ref(false);
const signedPdfExporting = ref(false);
const protocolExporting = ref(false);
const protocolExportJob = ref(null);
const protocolExportNotice = ref('');
const error = ref('');
const summaryError = ref('');
const season = ref({ id: route.params.seasonId, name: '' });
const year = computed(() => Number(route.params.year));
const players = ref([]);
const staff = ref([]);
const participationSummary = ref({ matches: [], players: [] });
const clubName = ref('');
const q = ref('');
const summarySearch = ref('');
const selectedSummaryPlayerIds = ref(new Set());
const activeSection = ref('players'); // 'players' | 'staff' | 'summary'
const teamId = computed(() => route.query.team_id || '');
const clubId = computed(() => route.query.club_id || '');
const roles = ref([]);
const showEdit = ref(false);
const currentPlayer = ref(null);
const signedPdfModalRef = ref(null);
const summaryExportMenuRef = ref(null);
const signedPdfError = ref('');
const signedPdfForm = ref({
  registry_number: '',
  event_name: '',
  event_date_start: '',
  event_date_end: '',
});
const summaryExportMenuOpen = ref(false);
let protocolExportCancelled = false;
let signedPdfModal = null;

onMounted(async () => {
  document.addEventListener('click', handleSummaryExportOutsideClick);
  // Always resolve labels; only fetch roster/staff when a specific team is provided
  await Promise.all([loadSeasonName(), loadClubName()]);
  await loadRoles();
  await Promise.all([loadRoster(), loadStaff(), loadParticipationSummary()]);
});

onBeforeUnmount(() => {
  protocolExportCancelled = true;
  document.removeEventListener('click', handleSummaryExportOutsideClick);
  signedPdfModal?.dispose();
  signedPdfModal = null;
});

function handleSummaryExportOutsideClick(event) {
  if (!summaryExportMenuOpen.value) return;
  const target = event.target;
  if (summaryExportMenuRef.value?.contains?.(target)) return;
  summaryExportMenuOpen.value = false;
}

async function loadSeasonName() {
  try {
    // Reuse summary to resolve season name with minimal overhead
    const params = new URLSearchParams();
    if (!isAdminView.value) params.set('mine', 'true');
    if (clubId.value) params.set('club_id', clubId.value);
    const data = await apiFetch(`/players/season-summary?${params.toString()}`);
    const s = (data.seasons || []).find((x) => x.id === season.value.id);
    if (s) season.value.name = s.name;
  } catch (_) {}
}

async function loadClubName() {
  try {
    if (!clubId.value) return;
    if (isAdminView.value) {
      const data = await apiFetch('/clubs?limit=1000');
      const clubs = Array.isArray(data.clubs) ? data.clubs : [];
      const found = clubs.find((c) => String(c.id) === String(clubId.value));
      if (found) clubName.value = found.name || '';
    } else {
      const data = await apiFetch('/clubs?mine=true');
      const clubs = Array.isArray(data.clubs) ? data.clubs : [];
      const found = clubs.find((c) => String(c.id) === String(clubId.value));
      if (found) clubName.value = found.name || '';
    }
  } catch (_) {}
}

async function loadRoster() {
  rosterLoading.value = true;
  error.value = '';
  try {
    if (!teamId.value) {
      players.value = [];
      return;
    }
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('limit', '500');
    params.set('season', season.value.id);
    params.set('team_birth_year', String(year.value));
    params.append('include', 'clubs');
    params.append('include', 'teams');
    if (clubId.value) params.set('club_id', clubId.value);
    if (teamId.value) params.set('team_id', teamId.value);
    if (!isAdminView.value) params.set('mine', 'true');
    const res = await apiFetch(`/players?${params.toString()}`);
    players.value = res.players || [];
  } catch (e) {
    const msg = e?.message || '';
    if (String(msg).includes('403')) {
      // Block access to foreign rosters explicitly
      if (typeof window !== 'undefined') window.location.assign('/forbidden');
      return;
    }
    error.value = msg || 'Не удалось загрузить состав команды';
  } finally {
    rosterLoading.value = false;
  }
}

async function loadStaff() {
  staffLoading.value = true;
  try {
    if (!teamId.value) {
      staff.value = [];
      return;
    }
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('limit', '500');
    params.set('season', season.value.id);
    if (clubId.value) params.set('club_id', clubId.value);
    if (teamId.value) params.set('team_id', teamId.value);
    params.append('include', 'teams');
    if (!isAdminView.value) params.set('mine', 'true');
    const res = await apiFetch(`/staff?${params.toString()}`);
    staff.value = res.staff || [];
  } catch (e) {
    // staff fetch errors should not break the page
    console.warn('Staff load failed', e);
    staff.value = [];
  } finally {
    staffLoading.value = false;
  }
}

async function loadParticipationSummary() {
  summaryLoading.value = true;
  summaryError.value = '';
  try {
    if (!teamId.value) {
      participationSummary.value = { matches: [], players: [] };
      return;
    }
    const params = new URLSearchParams();
    params.set('season_id', season.value.id);
    const res = await apiFetch(
      `/teams/${encodeURIComponent(teamId.value)}/participation-summary?${params.toString()}`
    );
    participationSummary.value = {
      matches: Array.isArray(res.matches) ? res.matches : [],
      players: Array.isArray(res.players) ? res.players : [],
    };
    selectedSummaryPlayerIds.value = new Set();
  } catch (e) {
    const msg = e?.message || '';
    if (String(msg).includes('403')) {
      if (typeof window !== 'undefined') window.location.assign('/forbidden');
      return;
    }
    summaryError.value = msg || 'Не удалось загрузить сводку участия';
    participationSummary.value = { matches: [], players: [] };
  } finally {
    summaryLoading.value = false;
  }
}

function formatDate(val) {
  if (!val) return '-';
  const date = new Date(val);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ru-RU');
}

function openPlayer(p) {
  const id = p?.external_id;
  if (!id) return;
  const url = `https://fhmoscow.com/player/${id}`;
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener');
  }
}

async function loadRoles() {
  try {
    const res = await apiFetch('/players/roles');
    roles.value = Array.isArray(res.roles) ? res.roles : [];
  } catch (_) {
    roles.value = [];
  }
}

function openEdit(p) {
  currentPlayer.value = {
    id: p.id,
    full_name: p.full_name,
    height: p.height ?? null,
    weight: p.weight ?? null,
    grip: p.grip ?? '',
    jersey_number: p.jersey_number ?? null,
    role: p.role || (p.role_name ? { id: null, name: p.role_name } : null),
  };
  // Prefill role_id by matching name if possible
  if (!currentPlayer.value.role?.id && p.role_name) {
    const found = roles.value.find((r) => r.name === p.role_name);
    if (found) currentPlayer.value.role = found;
  }
  showEdit.value = true;
}

function onSaved(updated) {
  // Merge updated fields into local list for snappy UX; also safe to re-fetch
  if (updated) {
    const idx = players.value.findIndex((x) => x.id === updated.id);
    if (idx !== -1) {
      const p = players.value[idx];
      players.value[idx] = {
        ...p,
        height: updated.height,
        weight: updated.weight,
        grip: updated.grip,
        jersey_number: updated.jersey_number,
        role_name: updated.role?.name || p.role_name || null,
        role: updated.role || p.role || null,
      };
    }
  }
  // Always refresh to ensure complete consistency
  void loadRoster();
}

const sorted = (arr) => {
  return [...arr].sort((a, b) => {
    const an = Number.isFinite(a.jersey_number) ? a.jersey_number : Infinity;
    const bn = Number.isFinite(b.jersey_number) ? b.jersey_number : Infinity;
    if (an !== bn) return an - bn;
    return (a.full_name || '').localeCompare(b.full_name || '', 'ru');
  });
};

const filteredPlayers = computed(() => {
  const term = (q.value || '').toString().trim().toLowerCase();
  if (!term) return players.value;
  return players.value.filter((p) => {
    const name = (p.full_name || '').toLowerCase();
    const jersey =
      p.jersey_number !== undefined && p.jersey_number !== null
        ? String(p.jersey_number)
        : '';
    return name.includes(term) || jersey.includes(term);
  });
});

const filteredStaff = computed(() => {
  const term = (q.value || '').toString().trim().toLowerCase();
  if (!term) return staff.value;
  return staff.value.filter((s) =>
    (s.full_name || '').toLowerCase().includes(term)
  );
});

const summaryMatches = computed(() => participationSummary.value.matches || []);
const summaryPlayers = computed(() => participationSummary.value.players || []);

const filteredSummaryPlayers = computed(() => {
  const term = (summarySearch.value || '').toString().trim().toLowerCase();
  if (!term) return summaryPlayers.value;
  return summaryPlayers.value.filter((player) =>
    (player.full_name || '').toLowerCase().includes(term)
  );
});

const sectionCards = computed(() => [
  {
    key: 'players',
    title: 'Игроки',
    count: players.value.length,
    icon: 'bi-people',
  },
  {
    key: 'staff',
    title: 'Тренерский штаб',
    count: staff.value.length,
    icon: 'bi-person-workspace',
  },
  {
    key: 'summary',
    title: 'Сводка участия',
    count: summaryMatches.value.length,
    icon: 'bi-table',
  },
]);

const goalies = computed(() =>
  sorted(filteredPlayers.value.filter((p) => p.role_name === 'Вратарь'))
);
const defenders = computed(() =>
  sorted(filteredPlayers.value.filter((p) => p.role_name === 'Защитник'))
);
const forwards = computed(() =>
  sorted(filteredPlayers.value.filter((p) => p.role_name === 'Нападающий'))
);

const playerGroups = computed(() => [
  { key: 'goalies', title: 'Вратари', items: goalies.value },
  { key: 'defenders', title: 'Защитники', items: defenders.value },
  { key: 'forwards', title: 'Нападающие', items: forwards.value },
]);

function matchHeader(match) {
  return (
    match.label ||
    [formatDate(match.date_start), match.home_team_name, match.away_team_name]
      .filter(Boolean)
      .join(' ')
  );
}

function matchDate(match) {
  return formatDate(match.date_start);
}

function matchTeamsLabel(match) {
  return `${match.home_team_name || 'Команда А'} — ${match.away_team_name || 'Команда Б'}`;
}

function shortMatchTeamsLabel(match) {
  const label = matchTeamsLabel(match);
  return label.length > 34 ? `${label.slice(0, 33)}…` : label;
}

function participationCell(player, match) {
  return Number(player?.cells?.[match.id] || 0);
}

function participationPercentValue(player) {
  if (!summaryMatches.value.length) return 0;
  const playedCount = summaryMatches.value.reduce(
    (sum, match) => sum + participationCell(player, match),
    0
  );
  return Math.round((playedCount / summaryMatches.value.length) * 100);
}

function participationPercentLabel(player) {
  return `${player.full_name || 'Игрок'}: ${participationPercentValue(player)}% матчей`;
}

function participationLabel(player, match) {
  const value = participationCell(player, match);
  return `${player.full_name || 'Игрок'}: ${value ? 'участвовал' : 'не участвовал'} в матче ${matchHeader(match)}`;
}

function summaryPlayerKey(player) {
  return String(
    player?.id || player?.player_id || player?.external_player_id || ''
  );
}

function isSummaryPlayerSelected(player) {
  return selectedSummaryPlayerIds.value.has(summaryPlayerKey(player));
}

function setSummaryPlayerSelected(player, checked) {
  const key = summaryPlayerKey(player);
  if (!key) return;
  const next = new Set(selectedSummaryPlayerIds.value);
  if (checked) next.add(key);
  else next.delete(key);
  selectedSummaryPlayerIds.value = next;
}

function checkedFromEvent(event) {
  return Boolean(event?.target?.checked);
}

function toggleFilteredSummaryPlayers(checked) {
  const next = new Set(selectedSummaryPlayerIds.value);
  for (const player of filteredSummaryPlayers.value) {
    const key = summaryPlayerKey(player);
    if (!key) continue;
    if (checked) next.add(key);
    else next.delete(key);
  }
  selectedSummaryPlayerIds.value = next;
}

const filteredSummarySelectedCount = computed(
  () =>
    filteredSummaryPlayers.value.filter((player) =>
      isSummaryPlayerSelected(player)
    ).length
);

const allFilteredSummarySelected = computed(
  () =>
    filteredSummaryPlayers.value.length > 0 &&
    filteredSummarySelectedCount.value === filteredSummaryPlayers.value.length
);

const selectedSummaryCount = computed(
  () => selectedSummaryPlayerIds.value.size
);

const selectedSummaryPlayers = computed(() => {
  const selected = selectedSummaryPlayerIds.value;
  return summaryPlayers.value.filter((player) =>
    selected.has(summaryPlayerKey(player))
  );
});

const selectedProtocolMatchCount = computed(
  () =>
    summaryMatches.value.filter((match) =>
      selectedSummaryPlayers.value.some(
        (player) => participationCell(player, match) === 1
      )
    ).length
);

const protocolExportDisabled = computed(
  () =>
    protocolExporting.value ||
    selectedSummaryCount.value === 0 ||
    selectedProtocolMatchCount.value === 0
);

function buildLocalDateOnly(date = new Date()) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildSummaryExportFilename() {
  const club = String(clubName.value || 'команда')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ');
  const seasonName = String(season.value.name || season.value.id || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ');
  return ['Сводка участия', club, seasonName, buildLocalDateOnly()]
    .filter(Boolean)
    .join(' - ')
    .concat('.xlsx');
}

function buildSignedPdfFallbackFilename() {
  const club = String(clubName.value || 'команда')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ');
  const seasonName = String(season.value.name || season.value.id || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ');
  return ['Выписка из протокола', club, seasonName, buildLocalDateOnly()]
    .filter(Boolean)
    .join(' - ')
    .concat('.pdf');
}

function buildProtocolArchiveFallbackFilename() {
  const club = String(clubName.value || 'команда')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ');
  const seasonName = String(season.value.name || season.value.id || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ');
  return ['Протоколы матчей', club, seasonName, buildLocalDateOnly()]
    .filter(Boolean)
    .join(' - ')
    .concat('.zip');
}

function getDispositionFilename(contentDisposition) {
  if (!contentDisposition) return null;
  const utf8Match = contentDisposition.match(
    /filename\*\s*=\s*UTF-8''([^;]+)/i
  );
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch (_) {
      return utf8Match[1].trim();
    }
  }
  const filenameMatch = contentDisposition.match(/filename\s*=\s*"([^"]+)"/i);
  if (filenameMatch?.[1]) return filenameMatch[1].trim();
  const plainMatch = contentDisposition.match(/filename\s*=\s*([^;]+)/i);
  return plainMatch?.[1]?.trim() || null;
}

async function exportSelectedSummary() {
  if (!selectedSummaryCount.value || summaryExporting.value) return;
  summaryExporting.value = true;
  summaryError.value = '';
  try {
    const { blob, headers } = await apiFetchBlobResponse(
      `/teams/${encodeURIComponent(teamId.value)}/participation-summary/export.xlsx`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: season.value.id,
          player_ids: Array.from(selectedSummaryPlayerIds.value),
        }),
      }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download =
      getDispositionFilename(headers.get('Content-Disposition')) ||
      buildSummaryExportFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    summaryError.value = e?.message || 'Не удалось выгрузить отчет';
  } finally {
    summaryExporting.value = false;
  }
}

async function openSignedPdfModal() {
  if (!selectedSummaryCount.value) return;
  summaryExportMenuOpen.value = false;
  signedPdfError.value = '';
  await nextTick();
  if (!signedPdfModal && signedPdfModalRef.value) {
    signedPdfModal = new Modal(signedPdfModalRef.value, {
      backdrop: 'static',
      keyboard: false,
    });
  }
  signedPdfModal?.show();
}

function toggleSummaryExportMenu() {
  if (
    !selectedSummaryCount.value ||
    summaryExporting.value ||
    signedPdfExporting.value
  ) {
    return;
  }
  summaryExportMenuOpen.value = !summaryExportMenuOpen.value;
}

async function exportSelectedSummaryFromMenu() {
  summaryExportMenuOpen.value = false;
  await exportSelectedSummary();
}

function validateSignedPdfForm() {
  const form = signedPdfForm.value;
  if (!String(form.registry_number || '').trim()) {
    return 'Укажите реестровый номер мероприятия';
  }
  if (!String(form.event_name || '').trim()) {
    return 'Укажите наименование мероприятия';
  }
  if (!form.event_date_start) return 'Укажите дату начала мероприятия';
  if (!form.event_date_end) return 'Укажите дату окончания мероприятия';
  if (form.event_date_end < form.event_date_start) {
    return 'Дата окончания не может быть раньше даты начала';
  }
  return '';
}

async function exportSignedPdf() {
  if (!selectedSummaryCount.value || signedPdfExporting.value) return;
  const validationError = validateSignedPdfForm();
  if (validationError) {
    signedPdfError.value = validationError;
    return;
  }
  signedPdfExporting.value = true;
  signedPdfError.value = '';
  try {
    const { blob, headers } = await apiFetchBlobResponse(
      `/teams/${encodeURIComponent(teamId.value)}/participation-summary/export-signed.pdf`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: season.value.id,
          player_ids: Array.from(selectedSummaryPlayerIds.value),
          registry_number: signedPdfForm.value.registry_number,
          event_name: signedPdfForm.value.event_name,
          event_date_start: signedPdfForm.value.event_date_start,
          event_date_end: signedPdfForm.value.event_date_end,
        }),
      }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download =
      getDispositionFilename(headers.get('Content-Disposition')) ||
      buildSignedPdfFallbackFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    signedPdfModal?.hide();
  } catch (e) {
    signedPdfError.value =
      e?.message || 'Не удалось сформировать подписанный документ';
  } finally {
    signedPdfExporting.value = false;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function protocolProgressText() {
  const job = protocolExportJob.value;
  if (!job) return '';
  return `Обработано ${job.processed_matches || 0} из ${job.total_matches || 0}, успешно ${job.success_count || 0}, с проблемами ${(job.skipped_count || 0) + (job.failure_count || 0)}`;
}

async function downloadProtocolArchive(jobId) {
  const { blob, headers } = await apiFetchBlobResponse(
    `/teams/${encodeURIComponent(teamId.value)}/participation-summary/protocols/export-jobs/${encodeURIComponent(jobId)}/download.zip`
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download =
    getDispositionFilename(headers.get('Content-Disposition')) ||
    buildProtocolArchiveFallbackFilename();
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function pollProtocolExportJob(jobId) {
  while (!protocolExportCancelled) {
    await wait(2500);
    const job = await apiFetch(
      `/teams/${encodeURIComponent(teamId.value)}/participation-summary/protocols/export-jobs/${encodeURIComponent(jobId)}`
    );
    protocolExportJob.value = job;
    if (job.status === 'COMPLETED') {
      await downloadProtocolArchive(jobId);
      const problemCount = (job.skipped_count || 0) + (job.failure_count || 0);
      protocolExportNotice.value = problemCount
        ? `Архив сформирован частично: ${problemCount} матчей с проблемами, детали в errors.csv.`
        : 'Архив протоколов сформирован.';
      return;
    }
    if (job.status === 'FAILED') {
      throw new Error(job.error_code || 'Не удалось сформировать архив');
    }
  }
}

async function exportSelectedProtocols() {
  if (protocolExportDisabled.value) return;
  protocolExportCancelled = false;
  protocolExporting.value = true;
  summaryError.value = '';
  protocolExportNotice.value = '';
  protocolExportJob.value = null;
  try {
    const job = await apiFetch(
      `/teams/${encodeURIComponent(teamId.value)}/participation-summary/protocols/export-jobs`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: season.value.id,
          player_ids: Array.from(selectedSummaryPlayerIds.value),
        }),
      }
    );
    protocolExportJob.value = job;
    if (job.status === 'COMPLETED' && job.download_available) {
      await downloadProtocolArchive(job.job_id);
      protocolExportNotice.value = 'Готовый архив протоколов скачан.';
    } else {
      await pollProtocolExportJob(job.job_id);
    }
  } catch (e) {
    summaryError.value = e?.message || 'Не удалось сформировать архив';
  } finally {
    protocolExporting.value = false;
  }
}
</script>

<template>
  <div class="py-3 school-roster-page">
    <div class="container">
      <Breadcrumbs
        v-if="isAdminView"
        :items="[
          { label: 'Администрирование', to: '/admin' },
          { label: 'Команды и клубы', to: '/admin/clubs-teams' },
          { label: `Состав — ${clubName || 'Клуб'} / ${year || ''} г.р.` },
        ]"
      />
      <Breadcrumbs
        v-else
        :items="[
          { label: 'Главная', to: '/' },
          { label: 'Управление спортивной школой', disabled: true },
          { label: 'Команды и составы', to: '/school-players' },
          { label: `Состав — ${clubName || 'Клуб'} / ${year || ''} г.р.` },
        ]"
      />
      <h1 class="mb-3">
        Состав — {{ clubName || 'Клуб' }} / {{ year || '' }} г.р.
      </h1>
      <div v-if="!teamId" class="alert alert-info mb-3" role="alert">
        Для просмотра состава выберите конкретную команду на странице
        <RouterLink to="/school-players">«Команды и составы»</RouterLink>
        .
      </div>

      <!-- Плитка-предупреждение (только для режима школы) -->
      <div
        v-if="!isAdminView"
        class="card section-card tile fade-in shadow-sm mb-3"
      >
        <div class="card-body">
          <div class="alert alert-warning small mb-0" role="alert">
            <div class="d-flex align-items-start">
              <i
                class="bi bi-exclamation-triangle-fill me-2 fs-5 text-warning"
                aria-hidden="true"
              ></i>
              <div>
                <p class="mb-1">
                  В случае ошибок в отображении сведений или любых технических
                  проблем — обращайтесь к сотрудникам отдела проведения
                  соревнований ФХМ через телеграм-чат
                  <a
                    href="https://t.me/+XMZeDBBSbqxjYzVi"
                    target="_blank"
                    rel="noopener"
                    >по ссылке</a
                  >.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="section-switch-grid mb-3" role="tablist">
        <button
          v-for="section in sectionCards"
          :key="section.key"
          type="button"
          class="section-switch-tile"
          :class="{ active: activeSection === section.key }"
          role="tab"
          :aria-selected="activeSection === section.key"
          :aria-controls="`${section.key}-section`"
          @click="activeSection = section.key"
        >
          <span class="section-switch-icon" aria-hidden="true">
            <i class="bi" :class="section.icon"></i>
          </span>
          <span class="section-switch-text">
            <span class="section-switch-title">{{ section.title }}</span>
            <span class="section-switch-count">{{ section.count }}</span>
          </span>
        </button>
      </div>

      <div
        v-if="activeSection !== 'summary'"
        class="card section-card tile fade-in shadow-sm mb-3"
      >
        <div class="card-body">
          <form class="search-form" @submit.prevent>
            <div class="search-control">
              <label
                for="rosterSearch"
                class="form-label small text-muted mb-1"
              >
                Поиск по ФИО{{
                  activeSection === 'players' ? ' или номеру' : ''
                }}
              </label>
              <div class="input-group">
                <span class="input-group-text" aria-hidden="true">
                  <i class="bi bi-search"></i>
                </span>
                <input
                  id="rosterSearch"
                  v-model="q"
                  type="search"
                  class="form-control"
                  :placeholder="
                    activeSection === 'players'
                      ? 'Например: Иванов или 17'
                      : 'Например: Иванов'
                  "
                  autocomplete="off"
                  aria-describedby="rosterSearchHelp"
                />
                <button
                  v-if="q"
                  type="button"
                  class="btn btn-outline-secondary"
                  aria-label="Очистить поиск"
                  @click="q = ''"
                >
                  Очистить
                </button>
              </div>
              <div id="rosterSearchHelp" class="form-text">
                Поиск применяется только к активному разделу.
              </div>
            </div>
          </form>
        </div>
      </div>

      <div
        v-show="activeSection === 'players'"
        id="players-section"
        class="stacked-roles"
        role="tabpanel"
      >
        <div
          v-for="group in playerGroups"
          :key="group.key"
          class="card section-card tile fade-in shadow-sm mb-3"
        >
          <div class="card-body">
            <h3 class="h5 mb-3">
              {{ group.title }} ({{ group.items.length }})
            </h3>
            <div v-if="error" class="alert alert-danger">{{ error }}</div>
            <div v-else-if="rosterLoading" class="text-center py-3">
              <div class="spinner-border spinner-brand" role="status"></div>
            </div>
            <ul v-else class="list-group list-group-flush">
              <li v-for="p in group.items" :key="p.id" class="list-group-item">
                <div class="d-flex align-items-start gap-3">
                  <div
                    class="jersey badge bg-secondary-subtle text-dark fw-semibold"
                  >
                    {{ p.jersey_number ?? '—' }}
                  </div>
                  <div
                    class="flex-grow-1 clickable-row"
                    role="button"
                    tabindex="0"
                    @click="openPlayer(p)"
                    @keydown.enter="openPlayer(p)"
                  >
                    <div class="fw-semibold d-flex align-items-center gap-2">
                      <span>{{ p.full_name || '—' }}</span>
                    </div>
                    <div class="text-muted small">
                      {{ formatDate(p.date_of_birth) }}
                    </div>
                    <div
                      v-if="p.height || p.weight || p.grip"
                      class="text-muted small mt-1"
                    >
                      <span v-if="p.height">{{ p.height }} см</span>
                      <span v-if="p.height && (p.weight || p.grip)"> · </span>
                      <span v-if="p.weight">{{ p.weight }} кг</span>
                      <span v-if="p.weight && p.grip"> · </span>
                      <span v-if="p.grip">Хват: {{ p.grip }}</span>
                    </div>
                  </div>
                  <div class="ms-auto">
                    <button
                      type="button"
                      class="btn btn-link btn-icon text-muted"
                      aria-label="Изменить данные игрока"
                      title="Изменить"
                      @click.stop="openEdit(p)"
                    >
                      <i class="bi bi-pencil" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              </li>
              <li v-if="!group.items.length" class="list-group-item text-muted">
                Нет игроков.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div
        v-show="activeSection === 'staff'"
        id="staff-section"
        class="card section-card tile fade-in shadow-sm mb-3"
        role="tabpanel"
      >
        <div class="card-body">
          <h3 class="h5 mb-3">Тренерский штаб ({{ filteredStaff.length }})</h3>
          <div v-if="error" class="alert alert-danger">{{ error }}</div>
          <div v-else-if="staffLoading" class="text-center py-3">
            <div class="spinner-border spinner-brand" role="status"></div>
          </div>
          <ul v-else class="list-group list-group-flush">
            <li
              v-for="s in filteredStaff"
              :key="s.id"
              class="list-group-item d-flex align-items-start gap-3"
            >
              <div
                class="avatar badge bg-secondary-subtle text-dark fw-semibold"
                aria-hidden="true"
              >
                <i class="bi bi-person-workspace"></i>
              </div>
              <div class="flex-grow-1">
                <div class="fw-semibold">{{ s.full_name || '—' }}</div>
                <div class="text-muted small">
                  {{ formatDate(s.date_of_birth) }}
                </div>
              </div>
            </li>
            <li v-if="!filteredStaff.length" class="list-group-item text-muted">
              Нет тренеров.
            </li>
          </ul>
        </div>
      </div>

      <section
        v-show="activeSection === 'summary'"
        id="summary-section"
        class="card section-card tile fade-in shadow-sm mb-3"
        role="tabpanel"
      >
        <div class="card-body">
          <div
            class="summary-header d-flex flex-wrap align-items-end justify-content-between gap-3 mb-3"
          >
            <div>
              <h3 class="h5 mb-1">Сводка участия</h3>
              <div class="text-muted small">
                {{ summaryMatches.length }} матчей, {{ summaryPlayers.length }}
                игроков из протокольных снимков, выбрано
                {{ selectedSummaryCount }}
              </div>
            </div>
            <div class="summary-actions">
              <form class="summary-search" @submit.prevent>
                <label
                  for="summarySearch"
                  class="form-label small text-muted mb-1"
                >
                  Поиск по ФИО игрока
                </label>
                <div class="input-group input-group-sm">
                  <span class="input-group-text" aria-hidden="true">
                    <i class="bi bi-search"></i>
                  </span>
                  <input
                    id="summarySearch"
                    v-model="summarySearch"
                    type="search"
                    class="form-control"
                    placeholder="Например: Иванов"
                    autocomplete="off"
                  />
                  <button
                    v-if="summarySearch"
                    type="button"
                    class="btn btn-outline-secondary"
                    aria-label="Очистить поиск по сводке"
                    @click="summarySearch = ''"
                  >
                    Очистить
                  </button>
                </div>
              </form>
              <button
                type="button"
                class="btn btn-outline-primary btn-sm summary-export-button"
                :disabled="protocolExportDisabled"
                :title="
                  selectedSummaryCount && !selectedProtocolMatchCount
                    ? 'У выбранных игроков нет матчей с участием'
                    : 'Выгрузить PDF-протоколы выбранных игроков'
                "
                @click="exportSelectedProtocols"
              >
                <span
                  v-if="protocolExporting"
                  class="spinner-border spinner-border-sm"
                  aria-hidden="true"
                ></span>
                <i v-else class="bi bi-file-earmark-zip" aria-hidden="true"></i>
                <span>
                  Протоколы ZIP
                  <span v-if="selectedProtocolMatchCount">
                    ({{ selectedProtocolMatchCount }})
                  </span>
                </span>
              </button>
              <div ref="summaryExportMenuRef" class="btn-group">
                <button
                  type="button"
                  class="btn btn-brand btn-sm summary-export-button dropdown-toggle"
                  :disabled="
                    !selectedSummaryCount ||
                    summaryExporting ||
                    signedPdfExporting
                  "
                  :aria-expanded="summaryExportMenuOpen ? 'true' : 'false'"
                  aria-haspopup="true"
                  @click="toggleSummaryExportMenu"
                  @keydown.escape="summaryExportMenuOpen = false"
                >
                  <span
                    v-if="summaryExporting || signedPdfExporting"
                    class="spinner-border spinner-border-sm"
                    aria-hidden="true"
                  ></span>
                  <i v-else class="bi bi-download" aria-hidden="true"></i>
                  <span>
                    Выгрузить
                    <span v-if="selectedSummaryCount">
                      ({{ selectedSummaryCount }})
                    </span>
                  </span>
                </button>
                <ul
                  class="dropdown-menu dropdown-menu-end"
                  :class="{ show: summaryExportMenuOpen }"
                >
                  <li>
                    <button
                      type="button"
                      class="dropdown-item"
                      :disabled="summaryExporting"
                      @click="exportSelectedSummaryFromMenu"
                    >
                      <i class="bi bi-file-earmark-excel me-2"></i>
                      Скачать XLSX
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      class="dropdown-item"
                      :disabled="signedPdfExporting"
                      @click="openSignedPdfModal"
                    >
                      <i class="bi bi-file-earmark-pdf me-2"></i>
                      Подписанный документ
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div v-if="summaryError" class="alert alert-danger">
            {{ summaryError }}
          </div>
          <div
            v-if="protocolExporting && protocolExportJob"
            class="alert alert-info py-2"
          >
            Формируем архив протоколов. {{ protocolProgressText() }}
          </div>
          <div v-if="protocolExportNotice" class="alert alert-warning py-2">
            {{ protocolExportNotice }}
          </div>
          <div v-if="!summaryError && summaryLoading" class="text-center py-3">
            <div class="spinner-border spinner-brand" role="status"></div>
          </div>
          <div
            v-else-if="!summaryError && !summaryMatches.length"
            class="empty-state"
          >
            В выбранном сезоне нет матчей этой команды.
          </div>
          <div
            v-else-if="!summaryError && !summaryPlayers.length"
            class="empty-state"
          >
            В протокольных снимках нет игроков этой команды.
          </div>
          <div v-else-if="!summaryError" class="summary-table-wrap">
            <table class="table table-sm participation-table align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col" class="sticky-col sticky-select">
                    <input
                      class="form-check-input"
                      type="checkbox"
                      :checked="allFilteredSummarySelected"
                      :disabled="!filteredSummaryPlayers.length"
                      aria-label="Выбрать отображенных игроков"
                      @change="
                        toggleFilteredSummaryPlayers(checkedFromEvent($event))
                      "
                    />
                  </th>
                  <th scope="col" class="sticky-col sticky-name">ФИО игрока</th>
                  <th scope="col" class="sticky-col sticky-birth">
                    Дата рождения
                  </th>
                  <th
                    v-for="match in summaryMatches"
                    :key="match.id"
                    scope="col"
                    class="match-column"
                    :class="{ 'text-muted': !match.has_snapshot }"
                    :title="matchHeader(match)"
                  >
                    <svg
                      class="match-header-svg"
                      viewBox="0 0 44 156"
                      role="img"
                      :aria-label="matchHeader(match)"
                    >
                      <text
                        class="match-svg-date"
                        x="0"
                        y="0"
                        transform="translate(17 148) rotate(-90)"
                      >
                        {{ matchDate(match) }}
                      </text>
                      <text
                        class="match-svg-teams"
                        x="0"
                        y="0"
                        transform="translate(34 148) rotate(-90)"
                      >
                        {{ shortMatchTeamsLabel(match) }}
                      </text>
                    </svg>
                  </th>
                  <th scope="col" class="percent-column">% участия</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="player in filteredSummaryPlayers" :key="player.id">
                  <td class="sticky-col sticky-select">
                    <input
                      class="form-check-input"
                      type="checkbox"
                      :checked="isSummaryPlayerSelected(player)"
                      :aria-label="`Выбрать игрока ${player.full_name || 'без имени'}`"
                      @change="
                        setSummaryPlayerSelected(
                          player,
                          checkedFromEvent($event)
                        )
                      "
                    />
                  </td>
                  <th scope="row" class="sticky-col sticky-name fw-semibold">
                    {{ player.full_name || '—' }}
                  </th>
                  <td class="sticky-col sticky-birth">
                    {{ formatDate(player.date_of_birth) }}
                  </td>
                  <td
                    v-for="match in summaryMatches"
                    :key="`${player.id}-${match.id}`"
                    class="participation-cell-wrap"
                  >
                    <span
                      class="participation-cell"
                      :class="{
                        'is-played': participationCell(player, match) === 1,
                        'is-missed': participationCell(player, match) === 0,
                      }"
                      :aria-label="participationLabel(player, match)"
                    >
                      {{ participationCell(player, match) }}
                    </span>
                  </td>
                  <td class="participation-percent-wrap">
                    <span
                      class="participation-percent"
                      :aria-label="participationPercentLabel(player)"
                    >
                      {{ participationPercentValue(player) }}%
                    </span>
                  </td>
                </tr>
                <tr v-if="!filteredSummaryPlayers.length">
                  <td
                    class="text-muted text-center py-3"
                    :colspan="summaryMatches.length + 4"
                  >
                    По этому запросу игроки не найдены.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  </div>
  <EditPlayerRosterModal
    v-model="showEdit"
    :player="currentPlayer"
    :season-id="season.id"
    :team-id="teamId"
    :club-id="clubId"
    :roles="roles"
    @saved="onSaved"
  />
  <div
    ref="signedPdfModalRef"
    class="modal fade"
    tabindex="-1"
    aria-labelledby="signedPdfModalTitle"
    aria-hidden="true"
  >
    <div class="modal-dialog modal-lg modal-dialog-centered">
      <form class="modal-content" @submit.prevent="exportSignedPdf">
        <div class="modal-header">
          <h2 id="signedPdfModalTitle" class="modal-title h5">
            Подписанный документ
          </h2>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Закрыть"
            :disabled="signedPdfExporting"
          ></button>
        </div>
        <div class="modal-body">
          <div v-if="signedPdfError" class="alert alert-danger">
            {{ signedPdfError }}
          </div>
          <div class="row g-3">
            <div class="col-md-6">
              <label for="signedPdfRegistry" class="form-label">
                Реестровый номер мероприятия
              </label>
              <input
                id="signedPdfRegistry"
                v-model.trim="signedPdfForm.registry_number"
                type="text"
                class="form-control"
                maxlength="64"
                required
                autocomplete="off"
              />
            </div>
            <div class="col-md-3">
              <label for="signedPdfDateStart" class="form-label">
                Дата начала
              </label>
              <input
                id="signedPdfDateStart"
                v-model="signedPdfForm.event_date_start"
                type="date"
                class="form-control"
                required
              />
            </div>
            <div class="col-md-3">
              <label for="signedPdfDateEnd" class="form-label">
                Дата окончания
              </label>
              <input
                id="signedPdfDateEnd"
                v-model="signedPdfForm.event_date_end"
                type="date"
                class="form-control"
                :min="signedPdfForm.event_date_start || undefined"
                required
              />
            </div>
            <div class="col-12">
              <label for="signedPdfEventName" class="form-label">
                Наименование мероприятия
              </label>
              <textarea
                id="signedPdfEventName"
                v-model.trim="signedPdfForm.event_name"
                class="form-control"
                rows="3"
                maxlength="500"
                required
              ></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            data-bs-dismiss="modal"
            :disabled="signedPdfExporting"
          >
            Отмена
          </button>
          <button
            type="submit"
            class="btn btn-brand"
            :disabled="signedPdfExporting"
          >
            <span
              v-if="signedPdfExporting"
              class="spinner-border spinner-border-sm me-2"
              aria-hidden="true"
            ></span>
            Скачать PDF
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
export default { name: 'SchoolPlayersRosterView' };
</script>

<style scoped>
.jersey {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.5rem;
}

.list-group-item {
  padding-left: 1rem;
  padding-right: 1rem;
}

/* Mobile spacing handled globally */

.clickable-row {
  cursor: pointer;
}

.clickable-row:hover {
  background-color: #f8f9fa;
}

/* Search tile layout */
.search-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-end;
}

.search-form .search-control {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-width: 280px;
}

.search-form .input-group {
  width: 100%;
}

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.5rem;
}

.btn-icon {
  padding: 0.25rem;
  line-height: 1;
}
.btn-icon .bi {
  font-size: 1rem;
}

.section-switch-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.section-switch-tile {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 4.75rem;
  padding: 1rem;
  text-align: left;
  color: var(--bs-body-color);
  background: var(--bs-body-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-tile);
  box-shadow: var(--shadow-tile);
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.section-switch-tile:hover {
  border-color: rgba(17, 56, 103, 0.3);
  box-shadow: var(--shadow-tile-hover);
}

.section-switch-tile:focus-visible {
  outline: 3px solid rgba(17, 56, 103, 0.25);
  outline-offset: 2px;
}

.section-switch-tile.active {
  border-color: var(--brand-color);
  box-shadow:
    0 0 0 1px rgba(17, 56, 103, 0.08),
    var(--shadow-tile-hover);
}

.section-switch-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 2.5rem;
  width: 2.5rem;
  height: 2.5rem;
  color: var(--brand-color);
  background: rgba(17, 56, 103, 0.08);
  border-radius: var(--radius-sm);
}

.section-switch-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.section-switch-title {
  font-weight: 700;
}

.section-switch-count {
  color: var(--bs-secondary-color);
  font-size: 0.875rem;
}

.summary-actions {
  display: flex;
  align-items: end;
  justify-content: flex-end;
  flex: 1 1 28rem;
  gap: 0.75rem;
  min-width: 0;
}

.summary-search {
  flex: 1 1 18rem;
  max-width: 24rem;
}

.summary-export-button {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  white-space: nowrap;
}

.empty-state {
  padding: 1.25rem;
  color: var(--bs-secondary-color);
  text-align: center;
  background: var(--bs-tertiary-bg, #f8f9fa);
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-sm);
}

.summary-table-wrap {
  max-width: 100%;
  overflow: auto;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
}

.participation-table {
  width: max-content;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.participation-table th,
.participation-table td {
  white-space: nowrap;
  border-color: var(--border-subtle);
}

.participation-table thead th {
  position: sticky;
  top: 0;
  z-index: 4;
  height: 10.25rem;
  background: var(--bs-body-bg);
  box-shadow: inset 0 -1px 0 var(--border-subtle);
}

.sticky-col {
  position: sticky;
  z-index: 7;
  background: var(--bs-body-bg);
  box-shadow: 1px 0 0 var(--border-subtle);
}

.sticky-select {
  left: 0;
  width: 3rem;
  min-width: 3rem;
  max-width: 3rem;
  text-align: center;
}

.sticky-name {
  left: 3rem;
  width: 15rem;
  min-width: 15rem;
  max-width: 15rem;
}

.sticky-birth {
  left: 18rem;
  width: 8.25rem;
  min-width: 8.25rem;
  max-width: 8.25rem;
}

.participation-table thead .sticky-col {
  z-index: 12;
}

.match-column {
  width: 3.25rem;
  min-width: 3.25rem;
  max-width: 3.25rem;
  padding: 0.25rem;
  text-align: center;
  vertical-align: bottom;
}

.match-header-svg {
  display: block;
  width: 2.75rem;
  height: 9.75rem;
  overflow: hidden;
}

.match-svg-date,
.match-svg-teams {
  dominant-baseline: middle;
  font-family: inherit;
  text-anchor: start;
  white-space: pre;
}

.match-svg-date {
  fill: var(--brand-color);
  font-size: 0.875rem;
  font-weight: 700;
}

.match-svg-teams {
  fill: var(--bs-body-color);
  font-size: 0.72rem;
  font-weight: 600;
}

.participation-cell-wrap,
.participation-percent-wrap {
  text-align: center;
}

.participation-cell,
.participation-percent {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  font-weight: 700;
  border-radius: var(--radius-xs);
}

.participation-cell.is-played {
  color: #146c43;
  background: #d1e7dd;
}

.participation-cell.is-missed {
  color: #842029;
  background: #f8d7da;
}

.percent-column {
  width: 5.75rem;
  min-width: 5.75rem;
  text-align: center;
  vertical-align: bottom;
}

.participation-percent {
  width: auto;
  min-width: 3.25rem;
  padding: 0 0.375rem;
  color: var(--brand-color);
  background: rgba(17, 56, 103, 0.08);
}

@media (max-width: 767.98px) {
  .section-switch-grid {
    grid-template-columns: 1fr;
  }

  .summary-search {
    max-width: none;
  }

  .summary-actions {
    align-items: stretch;
    flex-basis: 100%;
    flex-direction: column;
  }

  .sticky-name {
    left: 3rem;
    width: 12rem;
    min-width: 12rem;
    max-width: 12rem;
  }

  .sticky-birth {
    left: 15rem;
    width: 7.5rem;
    min-width: 7.5rem;
    max-width: 7.5rem;
  }
}
</style>
