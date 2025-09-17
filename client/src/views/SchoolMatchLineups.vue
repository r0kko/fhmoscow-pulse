<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { useRoute } from 'vue-router';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import { apiFetch } from '../api.js';
import { useToast } from '../utils/toast.js';
import { createLineupSync } from '../utils/lineupSync.js';
import SyncStatus from '../components/lineups/SyncStatus.vue';
import ExportModal from '../components/lineups/ExportModal.vue';
import StaffList from '../components/lineups/StaffList.vue';
import PlayersTable from '../components/lineups/PlayersTable.vue';
import PlayersListMobile from '../components/lineups/PlayersListMobile.vue';

const route = useRoute();
// Disable local draft persistence to avoid any UI/DB mismatch on reload
const DRAFT_ENABLED = false;
const error = ref('');
const loading = ref(true);
const saving = ref(false);
const data = ref(null); // result of GET /matches/:id/lineups
const search = ref('');
const activeTeam = ref(''); // team_id we're editing
// Optimistic concurrency and offline persistence
const teamRev = ref(''); // revision token for current team players
const staffRev = ref(''); // revision token for current team staff
const selected = ref(new Set()); // Set of team_player_id currently selected
const roles = ref([]); // available roles
const editedNumber = ref({}); // tpId -> number
const editedRole = ref({}); // tpId -> role_id|null
const editedSquad = ref({}); // tpId -> 1|2|null (double protocol)
const editedBoth = ref({}); // tpId -> boolean (double protocol GK both squads)
// Staff selection state
const staff = ref([]); // current team staff rows
const staffSelected = ref(new Set());
const staffCategories = ref([]);
const editedStaffRole = ref({});
// Toasts
const { showToast } = useToast();
// Sync (revisions + pending queue)
const {
  isOnline,
  pendingPlayers,
  pendingStaff,
  setPending,
  getPending,
  clearPending,
  flushPending,
  initNetworkListeners,
  initPendingFlagsFromStorage,
} = createLineupSync({
  matchId: route.params.id,
  teamIdRef: activeTeam,
  apiFetch,
  getTeamRev: () => teamRev.value,
  setTeamRev: (v) => (teamRev.value = v),
  getStaffRev: () => staffRev.value,
  setStaffRev: (v) => (staffRev.value = v),
});
// Составы для штаба не используются — убрано по требованию
// Global search is shared across players and staff
// Staff selection UX limits (server-side validation on export)
const staffSelectedCount = computed(() => staffSelected.value.size);
const staffOverLimit = computed(() => staffSelectedCount.value > 8);
const hasAnyStaff = computed(() => staffSelected.value.size > 0);
const headCoachCount = computed(() => {
  const byId = new Map(
    (staffCategories.value || []).map((c) => [
      String(c.id),
      c.name.toLowerCase(),
    ])
  );
  let cnt = 0;
  for (const r of staff.value || []) {
    if (!staffSelected.value.has(r.team_staff_id)) continue;
    const rid =
      editedStaffRole.value[r.team_staff_id] ?? r.match_role?.id ?? null;
    const nm = rid ? byId.get(String(rid)) || '' : '';
    if (nm === 'главный тренер') cnt += 1;
  }
  return cnt;
});
const hasHeadCoachSelected = computed(() => headCoachCount.value === 1);
const selectedCoachesCount = computed(() => {
  const byId = new Map(
    (staffCategories.value || []).map((c) => [
      String(c.id),
      c.name.toLowerCase(),
    ])
  );
  let cnt = 0;
  for (const r of staff.value || []) {
    if (!staffSelected.value.has(r.team_staff_id)) continue;
    const rid =
      editedStaffRole.value[r.team_staff_id] ?? r.match_role?.id ?? null;
    const nm = rid ? byId.get(String(rid)) || '' : '';
    if (nm.includes('тренер')) cnt += 1;
  }
  return cnt;
});
// Leadership selection
const captainId = ref(''); // single-protocol captain (team_player_id)
const assistants = ref(new Set()); // single-protocol assistants (up to 2)
// Double-protocol leadership per squad
const captain1Id = ref('');
const captain2Id = ref('');
const assistants1 = ref(new Set());
const assistants2 = ref(new Set());

// --- Draft persistence (protect user actions across reloads) -------------
function draftKey(kind = 'all') {
  const id = route.params.id || 'match';
  const team = activeTeam.value || 'team';
  return `lineupDraft:${id}:${team}:${kind}`;
}

function persistDraft() {
  if (!DRAFT_ENABLED) return;
  try {
    const playersDraft = {
      selected: Array.from(selected.value),
      editedNumber: editedNumber.value,
      editedRole: editedRole.value,
      editedSquad: editedSquad.value,
      editedBoth: editedBoth.value,
      captainId: captainId.value,
      assistants: Array.from(assistants.value),
      captain1Id: captain1Id.value,
      captain2Id: captain2Id.value,
      assistants1: Array.from(assistants1.value),
      assistants2: Array.from(assistants2.value),
    };
    localStorage.setItem(draftKey('players'), JSON.stringify(playersDraft));
  } catch (_) {
    /* ignore */
  }
  try {
    const staffDraft = {
      staffSelected: Array.from(staffSelected.value),
      editedStaffRole: editedStaffRole.value,
    };
    localStorage.setItem(draftKey('staff'), JSON.stringify(staffDraft));
  } catch (_) {
    /* ignore */
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(draftKey('players'));
  } catch (_) {
    /* ignore */
  }
  try {
    localStorage.removeItem(draftKey('staff'));
  } catch (_) {
    /* ignore */
  }
}

function loadDraftPlayers() {
  try {
    const raw = localStorage.getItem(draftKey('players'));
    if (!raw) return;
    const draft = JSON.parse(raw);
    const pool =
      activeTeam.value === data.value?.team2_id
        ? data.value?.away?.players || []
        : data.value?.home?.players || [];
    const validIds = new Set(pool.map((p) => p.team_player_id));
    if (Array.isArray(draft.selected))
      selected.value = new Set(draft.selected.filter((id) => validIds.has(id)));
    // Shallow-merge edited maps only for existing ids
    const applyMap = (src) => {
      const out = {};
      for (const id of validIds) if (src && id in src) out[id] = src[id];
      return out;
    };
    if (draft.editedNumber) editedNumber.value = applyMap(draft.editedNumber);
    if (draft.editedRole) editedRole.value = applyMap(draft.editedRole);
    if (draft.editedSquad) editedSquad.value = applyMap(draft.editedSquad);
    if (draft.editedBoth) editedBoth.value = applyMap(draft.editedBoth);
    if (draft.captainId && validIds.has(draft.captainId))
      captainId.value = draft.captainId;
    if (Array.isArray(draft.assistants))
      assistants.value = new Set(
        draft.assistants.filter((id) => validIds.has(id))
      );
    // Double-protocol leadership
    if (draft.captain1Id && validIds.has(draft.captain1Id))
      captain1Id.value = draft.captain1Id;
    if (draft.captain2Id && validIds.has(draft.captain2Id))
      captain2Id.value = draft.captain2Id;
    if (Array.isArray(draft.assistants1))
      assistants1.value = new Set(
        draft.assistants1.filter((id) => validIds.has(id))
      );
    if (Array.isArray(draft.assistants2))
      assistants2.value = new Set(
        draft.assistants2.filter((id) => validIds.has(id))
      );
  } catch (_) {
    /* ignore */
  }
}

function loadDraftStaff() {
  try {
    const raw = localStorage.getItem(draftKey('staff'));
    if (!raw) return;
    const draft = JSON.parse(raw);
    const validIds = new Set((staff.value || []).map((r) => r.team_staff_id));
    if (Array.isArray(draft.staffSelected))
      staffSelected.value = new Set(
        draft.staffSelected.filter((id) => validIds.has(id))
      );
    if (draft.editedStaffRole) {
      const out = {};
      for (const id of validIds)
        if (id in draft.editedStaffRole) out[id] = draft.editedStaffRole[id];
      editedStaffRole.value = out;
    }
  } catch (_) {
    /* ignore */
  }
}

// Persist drafts on significant state changes (debounced)
let draftPersistTimer = null;
function scheduleDraftPersist() {
  if (draftPersistTimer) clearTimeout(draftPersistTimer);
  draftPersistTimer = setTimeout(() => {
    persistDraft();
  }, 300);
}

// --- Pending queue (offline-friendly progressive save) ----------------------
// pending helpers are provided by createLineupSync

// Goalkeeper helpers
const gkRoleId = computed(() => {
  const r = roles.value.find((x) => (x.name || '').toLowerCase() === 'вратарь');
  return r ? r.id : null;
});

function isPlayerGk(p) {
  const rid =
    editedRole.value[p.team_player_id] ??
    p.match_role?.id ??
    p.role?.id ??
    null;
  return rid && gkRoleId.value && String(rid) === String(gkRoleId.value);
}

const gkCount = computed(() => {
  if (!data.value) return 0;
  const pool =
    activeTeam.value === data.value.team2_id
      ? data.value.away?.players || []
      : data.value.home?.players || [];
  let cnt = 0;
  for (const p of pool) {
    if (selected.value.has(p.team_player_id) && isPlayerGk(p)) cnt += 1;
  }
  return cnt;
});

const fieldCount = computed(() => {
  if (!data.value) return 0;
  const pool =
    activeTeam.value === data.value.team2_id
      ? data.value.away?.players || []
      : data.value.home?.players || [];
  let cnt = 0;
  for (const p of pool) {
    if (selected.value.has(p.team_player_id) && !isPlayerGk(p)) cnt += 1;
  }
  return cnt;
});

// Over-limit guard for export UX
const overLimit = computed(() => gkCount.value > 2 || fieldCount.value > 20);

// Double protocol helpers
const isDouble = computed(() => !!data.value?.double_protocol);
const squadMissingCount = computed(() => {
  if (!isDouble.value || !data.value) return 0;
  const pool =
    activeTeam.value === data.value.team2_id
      ? data.value.away?.players || []
      : data.value.home?.players || [];
  let cnt = 0;
  for (const p of pool) {
    if (!selected.value.has(p.team_player_id)) continue;
    const isBoth =
      isPlayerGk(p) &&
      Boolean(editedBoth.value[p.team_player_id] ?? p.squad_both ?? false);
    const sq = editedSquad.value[p.team_player_id] ?? p.squad_no ?? null;
    if (!isBoth && sq !== 1 && sq !== 2) cnt += 1;
  }
  return cnt;
});
function countsBySquad(sq) {
  if (!isDouble.value || !data.value) return { gk: 0, field: 0 };
  const pool =
    activeTeam.value === data.value.team2_id
      ? data.value.away?.players || []
      : data.value.home?.players || [];
  let gk = 0;
  let field = 0;
  for (const p of pool) {
    if (!selected.value.has(p.team_player_id)) continue;
    const isBoth =
      isPlayerGk(p) &&
      Boolean(editedBoth.value[p.team_player_id] ?? p.squad_both ?? false);
    const s = editedSquad.value[p.team_player_id] ?? p.squad_no ?? null;
    if (!isBoth && s !== sq) continue;
    if (isPlayerGk(p)) gk += 1;
    else field += 1;
  }
  return { gk, field };
}
const squad1 = computed(() => countsBySquad(1));
const squad2 = computed(() => countsBySquad(2));
// Staff export is independent of squads; no per-squad coach limits in UI
const coachesOverLimit = computed(() => false);

// Duplicate numbers guard (selected players with the same match number) —
// global across both squads (double protocol also enforces global uniqueness)
const duplicateNumbers = computed(() => {
  if (!data.value) return [];
  const pool =
    activeTeam.value === data.value.team2_id
      ? data.value.away?.players || []
      : data.value.home?.players || [];
  const byNum = new Map(); // num -> count across all selected players
  for (const p of pool) {
    if (!selected.value.has(p.team_player_id)) continue;
    const n = editedNumber.value[p.team_player_id];
    if (n == null || Number.isNaN(n)) continue;
    const key = String(n);
    byNum.set(key, (byNum.get(key) || 0) + 1);
  }
  return Array.from(byNum.entries())
    .filter(([, cnt]) => cnt > 1)
    .map(([num]) => num);
});
const hasDuplicateNumbers = computed(() => duplicateNumbers.value.length > 0);
// For quick per-player duplicate detection in UI
const duplicateNumbersSet = computed(() => new Set(duplicateNumbers.value));
const missingNumbers = computed(() => {
  if (!data.value) return 0;
  const pool =
    activeTeam.value === data.value.team2_id
      ? data.value.away?.players || []
      : data.value.home?.players || [];
  let cnt = 0;
  for (const p of pool) {
    if (!selected.value.has(p.team_player_id)) continue;
    const n = editedNumber.value[p.team_player_id];
    if (n == null || Number.isNaN(n)) cnt += 1;
  }
  return cnt;
});
const hasCaptain = computed(() => {
  if (!data.value) return false;
  if (isDouble.value) {
    const ok1 = !!captain1Id.value && selected.value.has(captain1Id.value);
    const ok2 = !!captain2Id.value && selected.value.has(captain2Id.value);
    return ok1 && ok2;
  }
  return !!captainId.value && selected.value.has(captainId.value);
});

// Preferences removed

// Export readiness helpers (players + staff)
const playersSelectedCount = computed(() => {
  if (!data.value) return 0;
  const pool =
    activeTeam.value === data.value.team2_id
      ? data.value.away?.players || []
      : data.value.home?.players || [];
  return pool.filter((p) => selected.value.has(p.team_player_id)).length;
});
const exportDisabled = computed(() => {
  const needsSync =
    saving.value ||
    pendingPlayers.value ||
    pendingStaff.value ||
    !isOnline.value;
  if (isDouble.value) {
    const s1 = squad1.value;
    const s2 = squad2.value;
    const s1Ok = s1.gk >= 1 && s1.gk <= 2 && s1.field >= 12 && s1.field <= 13;
    const s2Ok = s2.gk >= 1 && s2.gk <= 2 && s2.field >= 12 && s2.field <= 13;
    const cap1 = !!captain1Id.value && selected.value.has(captain1Id.value);
    const cap2 = !!captain2Id.value && selected.value.has(captain2Id.value);
    return (
      needsSync ||
      !activeTeam.value ||
      squadMissingCount.value > 0 ||
      missingRoles.value ||
      hasDuplicateNumbers.value ||
      missingNumbers.value > 0 ||
      !s1Ok ||
      !s2Ok ||
      staffOverLimit.value ||
      coachesOverLimit.value ||
      !hasAnyStaff.value ||
      selectedCoachesCount.value < 2 ||
      !hasHeadCoachSelected.value ||
      !cap1 ||
      !cap2
    );
  }
  const gkOk = gkCount.value >= 1 && gkCount.value <= 2;
  const fldOk = fieldCount.value >= 5 && fieldCount.value <= 20;
  return (
    needsSync ||
    !activeTeam.value ||
    !gkOk ||
    !fldOk ||
    overLimit.value ||
    missingRoles.value ||
    hasDuplicateNumbers.value ||
    missingNumbers.value > 0 ||
    staffOverLimit.value ||
    !hasCaptain.value ||
    !hasAnyStaff.value ||
    !hasHeadCoachSelected.value
  );
});
const exportRequirements = computed(() => {
  const syncOk =
    !saving.value &&
    !pendingPlayers.value &&
    !pendingStaff.value &&
    isOnline.value;
  if (isDouble.value) {
    const s1 = squad1.value;
    const s2 = squad2.value;
    const pool =
      activeTeam.value === data.value.team2_id
        ? data.value.away?.players || []
        : data.value.home?.players || [];
    const cap1 = pool.some(
      (p) =>
        selected.value.has(p.team_player_id) &&
        (editedSquad.value[p.team_player_id] ?? p.squad_no) === 1 &&
        p.is_captain
    );
    const cap2 = pool.some(
      (p) =>
        selected.value.has(p.team_player_id) &&
        (editedSquad.value[p.team_player_id] ?? p.squad_no) === 2 &&
        p.is_captain
    );
    const staffCount = staffSelectedCount.value;
    return [
      {
        key: 'sync',
        ok: syncOk,
        text: syncOk
          ? 'Данные синхронизированы с сервером'
          : 'Ожидается синхронизация с сервером',
      },
      { key: 'team', ok: !!activeTeam.value, text: 'Команда выбрана' },
      {
        key: 'roles',
        ok: !missingRoles.value,
        text: 'Амплуа назначены всем выбранным игрокам',
      },
      {
        key: 'squad',
        ok: squadMissingCount.value === 0,
        text:
          squadMissingCount.value === 0
            ? 'Состав (1/2) указан каждому выбранному игроку'
            : `Не указан состав у ${squadMissingCount.value} игрок(ов)`,
      },
      {
        key: 'filledNumbers',
        ok: missingNumbers.value === 0,
        text:
          missingNumbers.value === 0
            ? 'Игровые номера указаны всем выбранным игрокам'
            : `Отсутствуют номера у ${missingNumbers.value} игрок(ов)`,
      },
      {
        key: 'uniqueNumbers',
        ok: !hasDuplicateNumbers.value,
        text: hasDuplicateNumbers.value
          ? `Дубли игровых номеров (в команде): ${duplicateNumbers.value.join(', ')}`
          : 'Игровые номера уникальны в команде',
      },
      {
        key: 'gk1',
        ok: s1.gk >= 1 && s1.gk <= 2,
        text: `Состав 1 — вратари: ${s1.gk}/1–2`,
      },
      {
        key: 'fld1',
        ok: s1.field >= 12 && s1.field <= 13,
        text: `Состав 1 — полевые: ${s1.field}/12–13`,
      },
      { key: 'cap1', ok: cap1, text: 'Состав 1 — капитан выбран' },
      {
        key: 'gk2',
        ok: s2.gk >= 1 && s2.gk <= 2,
        text: `Состав 2 — вратари: ${s2.gk}/1–2`,
      },
      {
        key: 'fld2',
        ok: s2.field >= 12 && s2.field <= 13,
        text: `Состав 2 — полевые: ${s2.field}/12–13`,
      },
      { key: 'cap2', ok: cap2, text: 'Состав 2 — капитан выбран' },
      {
        key: 'staffAny',
        ok: hasAnyStaff.value,
        text: `Представители: ${staffCount}/1+`,
      },
      {
        key: 'coaches',
        ok: selectedCoachesCount.value >= 2,
        text: `Тренеры (активные): ${selectedCoachesCount.value}/≥2`,
      },
      {
        key: 'hc',
        ok: hasHeadCoachSelected.value,
        text: 'Главный тренер выбран',
      },
      {
        key: 'staffLimit',
        ok: !staffOverLimit.value,
        text: `Лимит представителей: ${Math.min(staffCount, 8)}/≤8`,
      },
      // No per-squad coach limits — single staff list across both pages
    ];
  }
  const gkOk = gkCount.value >= 1 && gkCount.value <= 2;
  const fldOk = fieldCount.value >= 5 && fieldCount.value <= 20;
  const syncOk2 =
    !saving.value &&
    !pendingPlayers.value &&
    !pendingStaff.value &&
    isOnline.value;
  const staffCount = staffSelectedCount.value;
  return [
    {
      key: 'sync',
      ok: syncOk2,
      text: syncOk2
        ? 'Данные синхронизированы с сервером'
        : 'Ожидается синхронизация с сервером',
    },
    {
      key: 'team',
      ok: !!activeTeam.value,
      text: 'Команда выбрана',
    },
    {
      key: 'roles',
      ok: !missingRoles.value,
      text: 'Амплуа назначены всем выбранным игрокам',
    },
    {
      key: 'filledNumbers',
      ok: missingNumbers.value === 0,
      text:
        missingNumbers.value === 0
          ? 'Игровые номера указаны всем выбранным игрокам'
          : `Отсутствуют номера у ${missingNumbers.value} игрок(ов)`,
    },
    {
      key: 'uniqueNumbers',
      ok: !hasDuplicateNumbers.value,
      text: hasDuplicateNumbers.value
        ? `Дубли игровых номеров: ${duplicateNumbers.value.join(', ')}`
        : 'Игровые номера уникальны',
    },
    {
      key: 'gk',
      ok: gkOk,
      text: `Вратари: ${gkCount.value}/1–2`,
    },
    {
      key: 'field',
      ok: fldOk,
      text: `Полевые: ${fieldCount.value}/5–20`,
    },
    {
      key: 'captain',
      ok: hasCaptain.value,
      text: 'Капитан выбран',
    },
    {
      key: 'staffAny',
      ok: hasAnyStaff.value,
      text: `Представители: ${staffCount}/1+`,
    },
    {
      key: 'headCoach',
      ok: hasHeadCoachSelected.value,
      text: 'Назначен главный тренер (роль)',
    },
    {
      key: 'staffLimit',
      ok: !staffOverLimit.value,
      text: `Лимит представителей: ${Math.min(staffCount, 8)}/≤8`,
    },
  ];
});
const exportBlocking = computed(() =>
  exportRequirements.value.filter((r) => !r.ok).map((r) => r.text)
);
// Export readiness modal
let exportModal;
const exportModalEl = ref(null);
function onModalReady(el) {
  exportModalEl.value = el;
  if (el) exportModal = new Modal(el);
}

function normalize(str) {
  return (str || '').toString().toLowerCase();
}

function applyFromResponse(d) {
  data.value = d;
  roles.value = Array.isArray(d.roles) ? d.roles : [];
  // Determine editable team
  if (d.is_home && d.team1_id) activeTeam.value = d.team1_id;
  else if (d.is_away && d.team2_id) activeTeam.value = d.team2_id;
  else activeTeam.value = d.team1_id || d.team2_id || '';
  // Set revision for current team
  if (activeTeam.value === d.team2_id) teamRev.value = d.away_rev || '';
  else teamRev.value = d.home_rev || '';
  // Preselect already saved players from the server
  const all = [...(d.home?.players || []), ...(d.away?.players || [])];
  selected.value = new Set(
    all.filter((p) => p.selected).map((p) => p.team_player_id)
  );
  // Prefill edits with match overrides or defaults
  const num = {};
  const rol = {};
  const sq = {};
  const both = {};
  for (const p of all) {
    num[p.team_player_id] = p.match_number ?? p.number ?? null;
    rol[p.team_player_id] = p.match_role?.id ?? p.role?.id ?? null;
    sq[p.team_player_id] = p.squad_no ?? null;
    both[p.team_player_id] = Boolean(p.squad_both ?? false);
  }
  editedNumber.value = num;
  editedRole.value = rol;
  editedSquad.value = sq;
  editedBoth.value = both;
  // Prefill leadership for the current editable team
  const pool =
    activeTeam.value === d.team2_id
      ? d.away?.players || []
      : d.home?.players || [];
  const cap = pool.find((p) => p.is_captain);
  captainId.value = cap ? cap.team_player_id : '';
  assistants.value = new Set(
    pool
      .filter((p) => p.assistant_order != null)
      .sort((a, b) => (a.assistant_order || 0) - (b.assistant_order || 0))
      .map((p) => p.team_player_id)
  );
}

const canEdit = computed(() => {
  if (!data.value) return false;
  // ADMIN can edit any side
  const isAdmin = Boolean(data.value.is_admin);
  if (isAdmin) return true;
  if (activeTeam.value === data.value.team1_id) return !!data.value.is_home;
  if (activeTeam.value === data.value.team2_id) return !!data.value.is_away;
  return false;
});

const roster = computed(() => {
  if (!data.value) return [];
  const pool =
    activeTeam.value === data.value.team2_id
      ? data.value.away?.players || []
      : data.value.home?.players || [];
  const term = normalize(search.value);
  if (!term) return pool;
  return pool.filter((p) => {
    const name = normalize(p.full_name);
    const num = (p.number ?? '').toString();
    const role = normalize(p.role?.name || '');
    return name.includes(term) || role.includes(term) || num === term;
  });
});

const groupedRoster = computed(() => {
  const gkName = 'Вратарь';
  const list = roster.value.slice();
  const numVal = (p) => {
    const v = p.match_number ?? p.number;
    return Number.isFinite(v) ? v : 999;
  };
  const groups = new Map();
  for (const p of list) {
    const key = p.match_role?.name || p.role?.name || 'Без амплуа';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const out = [];
  // GK group first
  if (groups.has(gkName)) {
    const arr = groups
      .get(gkName)
      .slice()
      .sort((a, b) => numVal(a) - numVal(b));
    out.push({ group: gkName, players: arr });
    groups.delete(gkName);
  }
  // Other groups sorted by name; inside group by number asc then name
  const rest = Array.from(groups.entries()).sort(([a], [b]) =>
    String(a).localeCompare(String(b), 'ru')
  );
  for (const [group, arr] of rest) {
    arr.sort((a, b) =>
      numVal(a) === numVal(b)
        ? (a.full_name || '').localeCompare(b.full_name || '', 'ru')
        : numVal(a) - numVal(b)
    );
    out.push({ group, players: arr });
  }
  return out;
});

const missingRoles = computed(() => {
  if (!data.value) return false;
  const pool =
    activeTeam.value === data.value.team2_id
      ? data.value.away?.players || []
      : data.value.home?.players || [];
  for (const p of pool) {
    if (selected.value.has(p.team_player_id)) {
      const r = editedRole.value[p.team_player_id] ?? null;
      if (!r) return true;
    }
  }
  return false;
});

function toggle(p) {
  const id = p.team_player_id;
  const s = new Set(selected.value);
  if (s.has(id)) {
    s.delete(id);
    selected.value = s;
    // clear leadership if unselecting
    if (isDouble.value) {
      if (captain1Id.value === id) captain1Id.value = '';
      if (captain2Id.value === id) captain2Id.value = '';
      if (assistants1.value.has(id)) {
        const ns = new Set(assistants1.value);
        ns.delete(id);
        assistants1.value = ns;
      }
      if (assistants2.value.has(id)) {
        const ns = new Set(assistants2.value);
        ns.delete(id);
        assistants2.value = ns;
      }
    } else {
      if (captainId.value === id) captainId.value = '';
      if (assistants.value.has(id)) {
        const ns = new Set(assistants.value);
        ns.delete(id);
        assistants.value = ns;
      }
    }
    // Immediate save for removal regardless of missing roles
    save(true);
    return;
  } else {
    // In double protocol, enforce per-squad caps if squad is known
    if (isDouble.value) {
      const sq = editedSquad.value[id] ?? p.squad_no ?? null;
      if (sq === 1 || sq === 2) {
        const cnt = sq === 1 ? squad1.value : squad2.value;
        const willBeGk = isPlayerGk(p);
        if (willBeGk && cnt.gk >= 2) {
          error.value = `Состав ${sq} — максимум 2 вратаря`;
          return;
        }
        if (!willBeGk && cnt.field >= 13) {
          error.value = `Состав ${sq} — максимум 13 полевых игроков`;
          return;
        }
      }
    } else {
      const willBeGk = isPlayerGk(p);
      if (willBeGk && gkCount.value >= 2) {
        error.value = 'В составе на матч не может быть более двух вратарей';
        return;
      }
      if (!willBeGk && fieldCount.value >= 20) {
        error.value = 'Нельзя выбрать более 20 полевых игроков';
        return;
      }
    }
    s.add(id);
  }
  selected.value = s;
  // Prefill edits when selecting
  if (s.has(id)) {
    if (editedNumber.value[id] === undefined)
      editedNumber.value[id] = p.match_number ?? p.number ?? null;
    if (editedRole.value[id] === undefined)
      editedRole.value[id] = p.match_role?.id ?? p.role?.id ?? null;
  }
  // Persist immediately to avoid any UI/DB drift
  save(true);
  scheduleDraftPersist();
}

function allSelected() {
  return (
    roster.value.length > 0 &&
    roster.value.every((p) => selected.value.has(p.team_player_id))
  );
}

function toggleAll() {
  const s = new Set(selected.value);
  if (allSelected()) {
    roster.value.forEach((p) => s.delete(p.team_player_id));
    selected.value = s;
    // Immediate save for mass removal
    save(true);
    return;
  }
  if (isDouble.value) {
    // В double-потоке выделяем всех в текущем представлении
    roster.value.forEach((p) => s.add(p.team_player_id));
  } else {
    // Single: выделяем в пределах лимитов
    const list = roster.value.slice();
    const gks = list.filter((p) => isPlayerGk(p));
    const fields = list.filter((p) => !isPlayerGk(p));
    let gk = gkCount.value;
    let fld = fieldCount.value;
    for (const p of gks) {
      if (!s.has(p.team_player_id) && gk < 2) {
        s.add(p.team_player_id);
        gk += 1;
      }
    }
    for (const p of fields) {
      if (!s.has(p.team_player_id) && fld < 20) {
        s.add(p.team_player_id);
        fld += 1;
      }
    }
  }
  selected.value = s;
  // Persist immediately for bulk selection to keep DB in sync
  save(true);
  scheduleDraftPersist();
}

const initialSelectedKey = ref('');
function computeInitialKey(d) {
  const ids = [
    ...(d.home?.players || [])
      .filter((p) => p.selected)
      .map((p) => p.team_player_id),
    ...(d.away?.players || [])
      .filter((p) => p.selected)
      .map((p) => p.team_player_id),
  ];
  return ids.sort().join(',');
}

const hasChanges = computed(() => {
  if (!data.value) return false;
  // Selection change check
  const currentSelected = (
    activeTeam.value === data.value.team2_id
      ? data.value.away?.players || []
      : data.value.home?.players || []
  )
    .filter((p) => p.selected)
    .map((p) => p.team_player_id)
    .sort()
    .join(',');
  const poolIds = new Set(
    (
      (activeTeam.value === data.value.team2_id
        ? data.value.away?.players
        : data.value.home?.players) || []
    ).map((p) => p.team_player_id)
  );
  const newSelected = Array.from(selected.value)
    .filter((id) => poolIds.has(id))
    .sort()
    .join(',');
  if (currentSelected !== newSelected) return true;

  // Overrides change check for selected players
  const pool =
    activeTeam.value === data.value.team2_id
      ? data.value.away?.players || []
      : data.value.home?.players || [];
  for (const p of pool) {
    if (!selected.value.has(p.team_player_id)) continue;
    const id = p.team_player_id;
    const currNum = p.match_number ?? null;
    const currRole = p.match_role?.id ?? null;
    const currBoth = Boolean(p.squad_both ?? false);
    const currSq = p.squad_no ?? null;
    const newNum = editedNumber.value[id] ?? null;
    const newRole = editedRole.value[id] ?? null;
    const newBoth = Boolean(editedBoth.value[id] ?? p.squad_both ?? false);
    const newSq = editedSquad.value[id] ?? p.squad_no ?? null;
    if (String(currNum ?? '') !== String(newNum ?? '')) return true;
    if (String(currRole ?? '') !== String(newRole ?? '')) return true;
    if (currBoth !== newBoth) return true;
    // Detect squad changes (double protocol); ignore when GK is marked for both
    if (isDouble.value && !newBoth) {
      if (String(currSq ?? '') !== String(newSq ?? '')) return true;
    }
  }

  // Leadership change check
  if (isDouble.value) {
    const savedCap1 =
      (
        pool.find(
          (p) =>
            p.is_captain &&
            (editedSquad.value[p.team_player_id] ?? p.squad_no) === 1
        ) || {}
      ).team_player_id || '';
    const savedCap2 =
      (
        pool.find(
          (p) =>
            p.is_captain &&
            (editedSquad.value[p.team_player_id] ?? p.squad_no) === 2
        ) || {}
      ).team_player_id || '';
    const uiCap1 =
      captain1Id.value && selected.value.has(captain1Id.value)
        ? captain1Id.value
        : '';
    const uiCap2 =
      captain2Id.value && selected.value.has(captain2Id.value)
        ? captain2Id.value
        : '';
    if (String(savedCap1 || '') !== String(uiCap1 || '')) return true;
    if (String(savedCap2 || '') !== String(uiCap2 || '')) return true;
    const savedAs1 = pool
      .filter(
        (p) =>
          selected.value.has(p.team_player_id) &&
          p.assistant_order != null &&
          (editedSquad.value[p.team_player_id] ?? p.squad_no) === 1
      )
      .sort((a, b) => (a.assistant_order || 0) - (b.assistant_order || 0))
      .map((p) => p.team_player_id)
      .join(',');
    const savedAs2 = pool
      .filter(
        (p) =>
          selected.value.has(p.team_player_id) &&
          p.assistant_order != null &&
          (editedSquad.value[p.team_player_id] ?? p.squad_no) === 2
      )
      .sort((a, b) => (a.assistant_order || 0) - (b.assistant_order || 0))
      .map((p) => p.team_player_id)
      .join(',');
    const uiAs1 = Array.from(assistants1.value)
      .filter((id) => selected.value.has(id))
      .slice(0, 2)
      .join(',');
    const uiAs2 = Array.from(assistants2.value)
      .filter((id) => selected.value.has(id))
      .slice(0, 2)
      .join(',');
    if (savedAs1 !== uiAs1) return true;
    return savedAs2 !== uiAs2;
  }

  // Single protocol leadership
  const savedCap = (pool.find((p) => p.is_captain) || {}).team_player_id || '';
  const uiCap =
    captainId.value && selected.value.has(captainId.value)
      ? captainId.value
      : '';
  if (String(savedCap || '') !== String(uiCap || '')) return true;
  const savedAs = pool
    .filter(
      (p) => selected.value.has(p.team_player_id) && p.assistant_order != null
    )
    .sort((a, b) => (a.assistant_order || 0) - (b.assistant_order || 0))
    .map((p) => p.team_player_id)
    .join(',');
  const uiAs = Array.from(assistants.value)
    .filter((id) => selected.value.has(id))
    .slice(0, 2)
    .join(',');
  return savedAs !== uiAs;
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const d = await apiFetch(`/matches/${route.params.id}/lineups`);
    applyFromResponse(d);
    initialSelectedKey.value = computeInitialKey(d);
    // Load staff list
    const s = await apiFetch(`/matches/${route.params.id}/staff`);
    staffCategories.value = Array.isArray(s.categories) ? s.categories : [];
    const pool =
      (activeTeam.value === s.team2_id ? s.away?.staff : s.home?.staff) || [];
    staff.value = pool;
    // Set staff rev for the current team
    staffRev.value =
      activeTeam.value === s.team2_id ? s.away_rev || '' : s.home_rev || '';
    // Preselect already saved representatives
    staffSelected.value = new Set(
      pool.filter((x) => x.selected).map((x) => x.team_staff_id)
    );
    // Prefill role edits (prefer match override, then base role)
    const m = {};
    for (const r of pool) {
      m[r.team_staff_id] = r.match_role?.id ?? r.role?.id ?? null;
    }
    editedStaffRole.value = m;
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки данных';
  } finally {
    loading.value = false;
  }
}

let saveNext = false;
async function save() {
  if (!data.value) return;
  if (saving.value) {
    saveNext = true;
    return;
  }
  if (!hasChanges.value) return;
  saving.value = true;
  error.value = '';
  try {
    const pool =
      activeTeam.value === data.value.team2_id
        ? data.value.away?.players || []
        : data.value.home?.players || [];
    // assign assistant order by stable order (per squad in double mode)
    const asOrder1 = Array.from(assistants1.value);
    const asOrder2 = Array.from(assistants2.value);
    const payload = pool.map((p) => ({
      team_player_id: p.team_player_id,
      selected: selected.value.has(p.team_player_id),
      number: selected.value.has(p.team_player_id)
        ? (editedNumber.value[p.team_player_id] ?? null)
        : null,
      role_id: selected.value.has(p.team_player_id)
        ? (editedRole.value[p.team_player_id] ?? null)
        : null,
      squad_no: selected.value.has(p.team_player_id)
        ? (editedSquad.value[p.team_player_id] ?? p.squad_no ?? null)
        : null,
      squad_both:
        isDouble.value &&
        selected.value.has(p.team_player_id) &&
        isPlayerGk(p) &&
        gkCount.value === 3
          ? Boolean(editedBoth.value[p.team_player_id] ?? p.squad_both ?? false)
          : false,
      is_captain: (function () {
        if (!selected.value.has(p.team_player_id)) return false;
        if (isDouble.value) {
          const sq = editedSquad.value[p.team_player_id] ?? p.squad_no ?? null;
          return (
            (sq === 1 && captain1Id.value === p.team_player_id) ||
            (sq === 2 && captain2Id.value === p.team_player_id)
          );
        }
        return captainId.value === p.team_player_id;
      })(),
      assistant_order: (function () {
        if (!selected.value.has(p.team_player_id)) return null;
        if (isDouble.value) {
          const sq = editedSquad.value[p.team_player_id] ?? p.squad_no ?? null;
          if (sq === 1) {
            const i = asOrder1.indexOf(p.team_player_id);
            return i >= 0 ? i + 1 : null;
          }
          if (sq === 2) {
            const i = asOrder2.indexOf(p.team_player_id);
            return i >= 0 ? i + 1 : null;
          }
          return null;
        }
        const i = Array.from(assistants.value).indexOf(p.team_player_id);
        return i >= 0 ? i + 1 : null;
      })(),
    }));
    // Persist pending snapshot before attempting to save (for offline safety)
    setPending('players', { team_id: activeTeam.value, players: payload });
    const resp1 = await apiFetch(`/matches/${route.params.id}/lineups`, {
      method: 'POST',
      body: JSON.stringify({
        team_id: activeTeam.value,
        players: payload,
        if_match_rev: teamRev.value || undefined,
      }),
    });
    if (resp1 && resp1.team_rev) teamRev.value = resp1.team_rev;
    // Persist draft after a successful save
    persistDraft();
    clearDraft();
    clearPending('players');
    // Reflect saved state locally to avoid heavy reload
    const roleById = new Map((roles.value || []).map((r) => [String(r.id), r]));
    const updateLocal = (arr) => {
      for (const p of arr) {
        const sel = selected.value.has(p.team_player_id);
        p.selected = sel;
        if (sel) {
          const n = editedNumber.value[p.team_player_id] ?? null;
          const rid = editedRole.value[p.team_player_id] ?? null;
          const sq = editedSquad.value[p.team_player_id] ?? p.squad_no ?? null;
          p.match_number = n;
          p.match_role = rid
            ? {
                id: rid,
                name:
                  roleById.get(String(rid))?.name ||
                  p.match_role?.name ||
                  p.role?.name ||
                  null,
              }
            : null;
          p.is_captain = isDouble.value
            ? (sq === 1 && captain1Id.value === p.team_player_id) ||
              (sq === 2 && captain2Id.value === p.team_player_id)
            : captainId.value === p.team_player_id;
          if (isDouble.value) {
            if (sq === 1) {
              const i = asOrder1.indexOf(p.team_player_id);
              p.assistant_order = i >= 0 ? i + 1 : null;
            } else if (sq === 2) {
              const i = asOrder2.indexOf(p.team_player_id);
              p.assistant_order = i >= 0 ? i + 1 : null;
            } else {
              p.assistant_order = null;
            }
          } else {
            const i = Array.from(assistants.value).indexOf(p.team_player_id);
            p.assistant_order = i >= 0 ? i + 1 : null;
          }
          p.squad_no = sq;
          p.squad_both = Boolean(
            editedBoth.value[p.team_player_id] ?? p.squad_both ?? false
          );
        } else {
          p.match_number = null;
          p.match_role = null;
          p.is_captain = false;
          p.assistant_order = null;
          p.squad_no = null;
          p.squad_both = false;
        }
      }
    };
    if (activeTeam.value === data.value.team2_id)
      updateLocal(data.value.away.players);
    else updateLocal(data.value.home.players);
  } catch (e) {
    if (e?.code === 'player_not_in_team' || e?.code === 'team_not_in_match') {
      await load();
      error.value = 'Состав данных обновлён. Проверьте список игроков.';
    } else if (e?.code === 'conflict_lineup_version') {
      // Reload and retry once without If-Match to apply latest client snapshot
      try {
        await load();
        const resp2 = await apiFetch(`/matches/${route.params.id}/lineups`, {
          method: 'POST',
          body: JSON.stringify({
            team_id: activeTeam.value,
            players: getPending('players')?.players || payload,
          }),
        });
        if (resp2 && resp2.team_rev) teamRev.value = resp2.team_rev;
        clearPending('players');
        showToast('Обновили данные и применили ваши изменения');
      } catch (e2) {
        error.value = e2.message || 'Конфликт при сохранении состава';
      }
    } else {
      error.value = e.message || 'Не удалось сохранить состав';
    }
  } finally {
    saving.value = false;
    if (saveNext) {
      saveNext = false;
      save(false);
    }
  }
}

let saveTimer = null;
function scheduleAutoSave() {
  if (!canEdit.value) return;
  if (!hasChanges.value) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    save(false);
  }, 400);
}

function onNumberInput(p, e) {
  const val = e.target.value;
  editedNumber.value[p.team_player_id] =
    val === '' ? null : Math.max(0, Math.min(99, parseInt(val, 10) || 0));
  // Debounced autosave on input for immediate UX without flooding server
  scheduleAutoSave();
  scheduleDraftPersist();
}

async function onRoleChange(p, e) {
  const val = e.target.value || null;
  // If switching to GK, enforce the GK limit
  if (
    !isDouble.value &&
    val &&
    gkRoleId.value &&
    String(val) === String(gkRoleId.value)
  ) {
    if (
      selected.value.has(p.team_player_id) &&
      gkCount.value >= 2 &&
      !isPlayerGk(p)
    ) {
      error.value = 'В составе на матч не может быть более двух вратарей';
      e.target.value = editedRole.value[p.team_player_id] ?? '';
      return;
    }
  }
  // If switching to a field role, enforce field players limit
  if (
    !isDouble.value &&
    val &&
    (!gkRoleId.value || String(val) !== String(gkRoleId.value))
  ) {
    if (
      selected.value.has(p.team_player_id) &&
      !isPlayerGk(p) &&
      fieldCount.value >= 20
    ) {
      error.value = 'Нельзя выбрать более 20 полевых игроков';
      e.target.value = editedRole.value[p.team_player_id] ?? '';
      return;
    }
  }
  editedRole.value[p.team_player_id] = val;
  scheduleDraftPersist();
  await save(true);
}

function onSquadChange(p, e) {
  const val = e.target.value;
  const tp = p.team_player_id;
  const prevSq = editedSquad.value[tp] ?? p.squad_no ?? null;
  const prevBoth = Boolean(editedBoth.value[tp] ?? p.squad_both ?? false);
  if (val === '' || val == null) {
    editedSquad.value[tp] = null;
    if (isPlayerGk(p)) editedBoth.value[tp] = false;
  } else if (val === 'both') {
    // Only allowed for GK when exactly 3 GK selected
    if (!isPlayerGk(p) || gkCount.value !== 3) return;
    // Enforce single GK both
    const pool =
      activeTeam.value === data.value.team2_id
        ? data.value.away?.players || []
        : data.value.home?.players || [];
    const already = pool.some(
      (x) =>
        x.team_player_id !== tp &&
        selected.value.has(x.team_player_id) &&
        isPlayerGk(x) &&
        Boolean(editedBoth.value[x.team_player_id] ?? x.squad_both ?? false)
    );
    if (already) {
      error.value = 'Можно указать только одного вратаря для обоих составов';
      e.target.value = (editedSquad.value[tp] ?? p.squad_no ?? '') + '';
      return;
    }
    editedBoth.value[tp] = true;
    editedSquad.value[tp] = null;
  } else {
    editedSquad.value[tp] = Math.max(1, Math.min(2, parseInt(val, 10) || 0));
    if (isPlayerGk(p)) editedBoth.value[tp] = false;
  }
  // При смене состава — корректируем лидерство по отрядам
  if (isDouble.value) {
    const sq = editedSquad.value[tp] ?? p.squad_no ?? null;
    // Enforce per-squad player caps when changing squad for selected player
    if ((sq === 1 || sq === 2) && selected.value.has(tp)) {
      const cnt = sq === 1 ? squad1.value : squad2.value;
      const willBeGk = isPlayerGk(p);
      // Exclude current player if already counted in the target squad (or both previously)
      let targetGk = cnt.gk;
      let targetField = cnt.field;
      if (willBeGk) {
        if (prevBoth || prevSq === sq) targetGk = Math.max(0, targetGk - 1);
      } else {
        if (prevSq === sq) targetField = Math.max(0, targetField - 1);
      }
      if (willBeGk && targetGk > 2) {
        editedSquad.value[tp] = p.squad_no ?? null;
        e.target.value = p.squad_no ?? '';
        error.value = `Состав ${sq} — максимум 2 вратаря`;
        return;
      }
      if (!willBeGk && targetField > 13) {
        editedSquad.value[tp] = p.squad_no ?? null;
        e.target.value = p.squad_no ?? '';
        error.value = `Состав ${sq} — максимум 13 полевых игроков`;
        return;
      }
    }
    if (captain1Id.value === tp && sq !== 1) captain1Id.value = '';
    if (captain2Id.value === tp && sq !== 2) captain2Id.value = '';
    if (assistants1.value.has(tp) && sq !== 1) {
      const s = new Set(assistants1.value);
      s.delete(tp);
      assistants1.value = s;
    }
    if (assistants2.value.has(tp) && sq !== 2) {
      const s = new Set(assistants2.value);
      s.delete(tp);
      assistants2.value = s;
    }
  }
  // Сохраняем действие сразу
  save(true);
  scheduleDraftPersist();
}

// Опция "Оба состава" доступна через выпадающий список (значение 'both')

function canAssignLeadership(p) {
  return selected.value.has(p.team_player_id) && !isPlayerGk(p);
}
function toggleCaptain(p) {
  if (!canAssignLeadership(p)) return;
  const id = p.team_player_id;
  if (isDouble.value) {
    const sq = editedSquad.value[id] ?? p.squad_no ?? null;
    if (sq !== 1 && sq !== 2) {
      error.value = 'Сначала укажите состав игрока (1 или 2)';
      return;
    }
    if (sq === 1) {
      const isSame = captain1Id.value === id;
      if (!isSame) {
        if (assistants1.value.has(id)) {
          const ns = new Set(assistants1.value);
          ns.delete(id);
          assistants1.value = ns;
        }
        captain1Id.value = id;
      } else captain1Id.value = '';
    } else if (sq === 2) {
      const isSame = captain2Id.value === id;
      if (!isSame) {
        if (assistants2.value.has(id)) {
          const ns = new Set(assistants2.value);
          ns.delete(id);
          assistants2.value = ns;
        }
        captain2Id.value = id;
      } else captain2Id.value = '';
    }
  } else {
    const isSame = captainId.value === id;
    if (!isSame) {
      if (assistants.value.has(id)) {
        const ns = new Set(assistants.value);
        ns.delete(id);
        assistants.value = ns;
      }
    }
    captainId.value = isSame ? '' : id;
  }
  // immediate save like checkbox behavior
  save(true);
  scheduleDraftPersist();
}
function toggleAssistant(p) {
  if (!canAssignLeadership(p)) return;
  const id = p.team_player_id;
  if (isDouble.value) {
    const sq = editedSquad.value[id] ?? p.squad_no ?? null;
    if (sq !== 1 && sq !== 2) {
      error.value = 'Сначала укажите состав игрока (1 или 2)';
      return;
    }
    if (sq === 1) {
      const s = new Set(assistants1.value);
      if (s.has(id)) s.delete(id);
      else {
        if (captain1Id.value === id) captain1Id.value = '';
        if (s.size >= 2) {
          error.value = 'Нельзя выбрать более двух ассистентов капитана';
          return;
        }
        s.add(id);
      }
      assistants1.value = s;
    } else if (sq === 2) {
      const s = new Set(assistants2.value);
      if (s.has(id)) s.delete(id);
      else {
        if (captain2Id.value === id) captain2Id.value = '';
        if (s.size >= 2) {
          error.value = 'Нельзя выбрать более двух ассистентов капитана';
          return;
        }
        s.add(id);
      }
      assistants2.value = s;
    }
  } else {
    const s = new Set(assistants.value);
    if (s.has(id)) {
      s.delete(id);
    } else {
      // If player is captain, demote to assistant (respect limit)
      if (captainId.value === id) {
        if (s.size >= 2) {
          error.value = 'Нельзя выбрать более двух ассистентов капитана';
          return;
        }
        captainId.value = '';
        s.add(id);
      } else {
        if (s.size >= 2) {
          error.value = 'Нельзя выбрать более двух ассистентов капитана';
          return; // max two
        }
        s.add(id);
      }
    }
    assistants.value = s;
  }
  // immediate save like checkbox behavior
  save(true);
  scheduleDraftPersist();
}

async function exportPlayers() {
  // Preflight guard: always show modal instead of calling API when not ready
  if (exportDisabled.value) {
    if (!exportModal && exportModalRef.value)
      exportModal = new Modal(exportModalRef.value);
    exportModal?.show();
    return;
  }
  try {
    // Flush all pending changes before export to match server validations
    await save(true);
    await saveStaff();
    await flushPending(`/matches/${route.params.id}`);
    // Verify revisions are up-to-date
    const ok = await verifySync();
    if (!ok) {
      if (!exportModal && exportModalRef.value)
        exportModal = new Modal(exportModalRef.value);
      exportModal?.show();
      return;
    }
    // Recheck after save just in case
    if (exportDisabled.value) {
      if (!exportModal && exportModalRef.value)
        exportModal = new Modal(exportModalRef.value);
      exportModal?.show();
      return;
    }
    const { apiFetchBlob } = await import('../api.js');
    const blob = await apiFetchBlob(
      `/matches/${route.params.id}/lineups/export.pdf?team_id=${encodeURIComponent(activeTeam.value)}`
    );
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const teamName =
      activeTeam.value === data.value.team1_id
        ? data.value.team1_name || 'home'
        : data.value.team2_name || 'away';
    a.download = `lineup_${teamName}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    // For known gating errors, open the readiness modal instead of generic alert
    const gating = new Set([
      'team_id_required',
      'player_ids_must_be_array',
      'match_role_required',
      'too_many_goalkeepers',
      'too_many_field_players',
      'too_few_goalkeepers',
      'too_few_field_players',
      'squad_number_required',
      'too_few_or_many_goalkeepers',
      'invalid_field_players_for_double',
      'captain_required',
      'too_many_captains',
      'too_many_assistants',
      'captain_must_be_field_player',
      'assistant_must_be_field_player',
      'captain_cannot_be_assistant',
      'duplicate_match_numbers',
      'match_number_required',
      'too_many_officials',
      'head_coach_required',
      'too_many_goalkeepers_both',
      'gk_both_requires_three',
    ]);
    if (e && gating.has(e.code)) {
      if (!exportModal && exportModalRef.value)
        exportModal = new Modal(exportModalRef.value);
      exportModal?.show();
      return;
    }
    error.value = e.message || 'Не удалось экспортировать PDF';
  }
}

function exportDisabledReason() {
  if (saving.value) return 'Идёт сохранение изменений';
  if (pendingPlayers.value || pendingStaff.value)
    return 'Изменения ожидают синхронизации';
  if (!isOnline.value) return 'Нет подключения к интернету';
  if (!activeTeam.value) return 'Выберите команду';
  if (isDouble.value) {
    if (squadMissingCount.value > 0)
      return `Не указан состав у ${squadMissingCount.value} игрок(ов)`;
    const s1 = squad1.value;
    const s2 = squad2.value;
    if (!(s1.gk >= 1 && s1.gk <= 2 && s2.gk >= 1 && s2.gk <= 2))
      return 'В каждом составе 1–2 вратаря';
    if (!(s1.field >= 12 && s1.field <= 13 && s2.field >= 12 && s2.field <= 13))
      return 'В каждом составе 12–13 полевых игроков';
    if (missingRoles.value) return 'Выберите амплуа для всех выбранных игроков';
    if (hasDuplicateNumbers.value)
      return `Уникальные номера: дубли ${duplicateNumbers.value.join(', ')}`;
    if (staffOverLimit.value)
      return 'Нельзя выбрать более 8 официальных представителей';
    if (selectedCoachesCount.value < 2) return 'Минимум два тренера в заявке';
    // no per-squad coach limits
    if (!hasAnyStaff.value)
      return 'Выберите хотя бы одного представителя команды';
    if (!hasHeadCoachSelected.value)
      return 'Назначьте главного тренера команды';
    if (!captain1Id.value || !selected.value.has(captain1Id.value))
      return 'Состав 1 — выберите капитана';
    if (!captain2Id.value || !selected.value.has(captain2Id.value))
      return 'Состав 2 — выберите капитана';
    return 'Экспорт PDF';
  }
  if (gkCount.value < 1) return 'Минимум 1 вратарь в заявке';
  if (fieldCount.value < 5) return 'Минимум 5 полевых игроков в заявке';
  if (missingRoles.value) return 'Выберите амплуа для всех выбранных игроков';
  if (hasDuplicateNumbers.value)
    return `Уникальные номера: дубли ${duplicateNumbers.value.join(', ')}`;
  if (overLimit.value) return 'Лимит: максимум 2 вратаря и 20 полевых';
  if (staffOverLimit.value)
    return 'Нельзя выбрать более 8 официальных представителей';
  if (!hasCaptain.value) return 'Укажите капитана команды';
  if (!hasAnyStaff.value)
    return 'Выберите хотя бы одного представителя команды';
  if (!hasHeadCoachSelected.value) return 'Назначьте главного тренера команды';
  return 'Экспорт PDF';
}

function exportRepsDisabledReason() {
  if (!activeTeam.value) return 'Выберите команду';
  if (staffOverLimit.value)
    return 'Нельзя выбрать более 8 официальных представителей';
  return 'Экспорт представителей';
}

async function exportRepresentatives() {
  try {
    // Persist staff selection before export
    await saveStaff();
    const { apiFetchBlob } = await import('../api.js');
    const blob = await apiFetchBlob(
      `/matches/${route.params.id}/representatives/export.pdf?team_id=${encodeURIComponent(activeTeam.value)}`
    );
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const teamName =
      activeTeam.value === data.value.team1_id
        ? data.value.team1_name || 'home'
        : data.value.team2_name || 'away';
    a.download = `representatives_${teamName}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    error.value = e.message || 'Не удалось экспортировать PDF';
  }
}

function filteredStaff() {
  const term = normalize(search.value);
  if (!term) return staff.value;
  return staff.value.filter(
    (s) =>
      (s.full_name || '').toLowerCase().includes(term) ||
      (s.role?.name || '').toLowerCase().includes(term) ||
      (s.match_role?.name || '').toLowerCase().includes(term)
  );
}

const groupedStaff = computed(() => {
  const list = filteredStaff().slice();
  const groups = new Map();
  const roleName = (r) => r.match_role?.name || r.role?.name || 'Без должности';
  for (const r of list) {
    const key = roleName(r);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const out = [];
  // Head coach group first if present
  const hcName = 'Главный тренер';
  if (groups.has(hcName)) {
    out.push({ group: hcName, staff: groups.get(hcName).slice() });
    groups.delete(hcName);
  }
  const rest = Array.from(groups.entries()).sort(([a], [b]) =>
    String(a).localeCompare(String(b), 'ru')
  );
  for (const [group, arr] of rest) out.push({ group, staff: arr });
  return out;
});

function allStaffSelected() {
  const arr = filteredStaff();
  return (
    arr.length > 0 && arr.every((r) => staffSelected.value.has(r.team_staff_id))
  );
}

async function toggleAllStaff() {
  const arr = filteredStaff();
  const s = new Set(staffSelected.value);
  if (allStaffSelected()) {
    for (const r of arr) s.delete(r.team_staff_id);
  } else {
    for (const r of arr) {
      if (s.size >= 8) break; // enforce max 8
      s.add(r.team_staff_id);
    }
  }
  staffSelected.value = s;
  persistDraft();
  await saveStaff();
}

async function onStaffRoleChange(row, e) {
  const prev =
    editedStaffRole.value[row.team_staff_id] ?? row.match_role?.id ?? null;
  const next = e.target.value || null;
  if (next) {
    const roleNameById = new Map(
      (staffCategories.value || []).map((c) => [
        String(c.id),
        c.name.toLowerCase(),
      ])
    );
    const nm = roleNameById.get(String(next)) || '';
    // Global: only one head coach in team regardless of protocol
    if (nm === 'главный тренер') {
      const prevWasHead =
        prev && (roleNameById.get(String(prev)) || '') === 'главный тренер';
      if (!prevWasHead && headCoachCount.value >= 1) {
        e.target.value = prev || '';
        error.value = 'Главный тренер уже назначен';
        return;
      }
    }
  }
  editedStaffRole.value[row.team_staff_id] = next;
  persistDraft();
  await saveStaff();
}

// Состав для штаба не редактируется

async function toggleStaff(row) {
  const id = row.team_staff_id;
  const s = new Set(staffSelected.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  staffSelected.value = s;
  persistDraft();
  await saveStaff();
}

// Staff save, analogous to players
const staffHasChanges = computed(() => {
  for (const r of staff.value || []) {
    const selSaved = Boolean(r.selected);
    const selUi = staffSelected.value.has(r.team_staff_id);
    if (selSaved !== selUi) return true;
    const savedRole = r.match_role?.id ?? null;
    const uiRole = editedStaffRole.value[r.team_staff_id] ?? null;
    if (String(savedRole ?? '') !== String(uiRole ?? '')) return true;
  }
  return false;
});

async function saveStaff() {
  if (!data.value) return;
  const arr = staff.value || [];
  const payload = arr.map((r) => ({
    team_staff_id: r.team_staff_id,
    selected: staffSelected.value.has(r.team_staff_id),
    role_id: staffSelected.value.has(r.team_staff_id)
      ? (editedStaffRole.value[r.team_staff_id] ?? null)
      : null,
    squad_no: null,
  }));
  try {
    // Persist pending snapshot before attempting to save (offline safety)
    setPending('staff', { team_id: activeTeam.value, staff: payload });
    const respS1 = await apiFetch(`/matches/${route.params.id}/staff`, {
      method: 'POST',
      body: JSON.stringify({
        team_id: activeTeam.value,
        staff: payload,
        if_staff_rev: staffRev.value || undefined,
      }),
    });
    if (respS1 && respS1.team_rev) staffRev.value = respS1.team_rev;
    persistDraft();
    clearDraft();
    clearPending('staff');
    // Update local staff state
    const nameById = new Map(
      (staffCategories.value || []).map((c) => [String(c.id), c.name])
    );
    for (const r of arr) {
      const sel = staffSelected.value.has(r.team_staff_id);
      r.selected = sel;
      if (sel) {
        const rid = editedStaffRole.value[r.team_staff_id] ?? null;
        r.match_role = rid
          ? {
              id: rid,
              name:
                nameById.get(String(rid)) ||
                r.match_role?.name ||
                r.role?.name ||
                null,
            }
          : null;
        r.squad_no = null;
      } else {
        r.match_role = null;
        r.squad_no = null;
      }
    }
  } catch (e) {
    if (e?.code === 'staff_not_in_team' || e?.code === 'team_not_in_match') {
      await load();
      error.value = 'Данные обновлены. Проверьте список представителей.';
    } else if (e?.code === 'conflict_staff_version') {
      try {
        await load();
        const respS2 = await apiFetch(`/matches/${route.params.id}/staff`, {
          method: 'POST',
          body: JSON.stringify({
            team_id: activeTeam.value,
            staff: getPending('staff')?.staff || payload,
          }),
        });
        if (respS2 && respS2.team_rev) staffRev.value = respS2.team_rev;
        clearPending('staff');
        showToast('Обновили данные и применили ваши изменения');
      } catch (e2) {
        error.value = e2.message || 'Конфликт при сохранении представителей';
      }
    } else if (e?.code === 'too_many_officials') {
      error.value = 'Нельзя выбрать более 8 официальных представителей';
    } else if (e?.code === 'staff_role_required') {
      error.value = 'Укажите должность для всех выбранных представителей';
    } else {
      error.value = e.message || 'Не удалось сохранить представителей';
    }
  }
}

let staffSaveTimer = null;
function scheduleStaffAutoSave() {
  if (!canEdit.value) return;
  if (!staffHasChanges.value) return;
  if (staffSaveTimer) clearTimeout(staffSaveTimer);
  staffSaveTimer = setTimeout(() => {
    staffSaveTimer = null;
    saveStaff();
  }, 600);
}

onMounted(load);

onMounted(() => {
  // Online/offline tracking
  initNetworkListeners(() => flushPending(`/matches/${route.params.id}`));
  // Initialize pending flags based on storage and flush on entry
  initPendingFlagsFromStorage();
  flushPending(`/matches/${route.params.id}`);
});

// Ensure local revision matches server before export
async function verifySync() {
  try {
    const d = await apiFetch(`/matches/${route.params.id}/lineups`, {
      _ddosRetried: true,
    });
    const currentTeamRev =
      activeTeam.value === d.team2_id ? d.away_rev || '' : d.home_rev || '';
    const s = await apiFetch(`/matches/${route.params.id}/staff`, {
      _ddosRetried: true,
    });
    const currentStaffRev =
      activeTeam.value === s.team2_id ? s.away_rev || '' : s.home_rev || '';
    const playersOk =
      currentTeamRev &&
      teamRev.value &&
      String(currentTeamRev) === String(teamRev.value);
    const staffOk =
      currentStaffRev &&
      staffRev.value &&
      String(currentStaffRev) === String(staffRev.value);
    if (!playersOk || !staffOk) {
      await load();
      showToast(
        'Нашли обновления на сервере. Синхронизировали данные. Повторите экспорт.'
      );
      return false;
    }
    return true;
  } catch (_) {
    // If cannot verify, be safe and block export
    return false;
  }
}

// When GK count is not exactly 3, clear any transient "both" flags so UI re-enables squad select
watch(gkCount, (val) => {
  if (val !== 3) {
    const next = { ...editedBoth.value };
    let changed = false;
    for (const k of Object.keys(next)) {
      if (next[k]) {
        next[k] = false;
        changed = true;
      }
    }
    if (changed) editedBoth.value = next;
  }
});

function onExportClick() {
  if (exportDisabled.value) {
    if (!exportModal && exportModalRef.value)
      exportModal = new Modal(exportModalRef.value);
    exportModal?.show();
    return;
  }
  exportPlayers();
}

function onConfirmExportFromModal() {
  if (exportDisabled.value) return;
  exportModal?.hide();
  exportPlayers();
}

// flushPending implemented in lineupSync util

watch(activeTeam, async () => {
  // Recompute selected set limited to current team pool
  if (!data.value) return;
  // Preselect already saved players for the chosen team
  if (activeTeam.value === data.value.team2_id) {
    // Update revision for players when switching team
    teamRev.value = data.value.away_rev || '';
    selected.value = new Set(
      (data.value.away?.players || [])
        .filter((p) => p.selected)
        .map((p) => p.team_player_id)
    );
    const pool = data.value.away?.players || [];
    // Initialize leadership
    if (isDouble.value) {
      const cap1 = pool.find(
        (p) =>
          p.is_captain &&
          (editedSquad.value[p.team_player_id] ?? p.squad_no) === 1
      );
      const cap2 = pool.find(
        (p) =>
          p.is_captain &&
          (editedSquad.value[p.team_player_id] ?? p.squad_no) === 2
      );
      captain1Id.value = cap1 ? cap1.team_player_id : '';
      captain2Id.value = cap2 ? cap2.team_player_id : '';
      assistants1.value = new Set(
        pool
          .filter(
            (p) =>
              p.assistant_order != null &&
              (editedSquad.value[p.team_player_id] ?? p.squad_no) === 1
          )
          .sort((a, b) => (a.assistant_order || 0) - (b.assistant_order || 0))
          .map((p) => p.team_player_id)
      );
      assistants2.value = new Set(
        pool
          .filter(
            (p) =>
              p.assistant_order != null &&
              (editedSquad.value[p.team_player_id] ?? p.squad_no) === 2
          )
          .sort((a, b) => (a.assistant_order || 0) - (b.assistant_order || 0))
          .map((p) => p.team_player_id)
      );
      captainId.value = '';
      assistants.value = new Set();
    } else {
      const cap = pool.find((p) => p.is_captain);
      captainId.value = cap ? cap.team_player_id : '';
      assistants.value = new Set(
        pool
          .filter((p) => p.assistant_order != null)
          .sort((a, b) => (a.assistant_order || 0) - (b.assistant_order || 0))
          .map((p) => p.team_player_id)
      );
      captain1Id.value = '';
      captain2Id.value = '';
      assistants1.value = new Set();
      assistants2.value = new Set();
    }
  } else {
    teamRev.value = data.value.home_rev || '';
    selected.value = new Set(
      (data.value.home?.players || [])
        .filter((p) => p.selected)
        .map((p) => p.team_player_id)
    );
    const pool = data.value.home?.players || [];
    if (isDouble.value) {
      const cap1 = pool.find(
        (p) =>
          p.is_captain &&
          (editedSquad.value[p.team_player_id] ?? p.squad_no) === 1
      );
      const cap2 = pool.find(
        (p) =>
          p.is_captain &&
          (editedSquad.value[p.team_player_id] ?? p.squad_no) === 2
      );
      captain1Id.value = cap1 ? cap1.team_player_id : '';
      captain2Id.value = cap2 ? cap2.team_player_id : '';
      assistants1.value = new Set(
        pool
          .filter(
            (p) =>
              p.assistant_order != null &&
              (editedSquad.value[p.team_player_id] ?? p.squad_no) === 1
          )
          .sort((a, b) => (a.assistant_order || 0) - (b.assistant_order || 0))
          .map((p) => p.team_player_id)
      );
      assistants2.value = new Set(
        pool
          .filter(
            (p) =>
              p.assistant_order != null &&
              (editedSquad.value[p.team_player_id] ?? p.squad_no) === 2
          )
          .sort((a, b) => (a.assistant_order || 0) - (b.assistant_order || 0))
          .map((p) => p.team_player_id)
      );
      captainId.value = '';
      assistants.value = new Set();
    } else {
      const cap = pool.find((p) => p.is_captain);
      captainId.value = cap ? cap.team_player_id : '';
      assistants.value = new Set(
        pool
          .filter((p) => p.assistant_order != null)
          .sort((a, b) => (a.assistant_order || 0) - (b.assistant_order || 0))
          .map((p) => p.team_player_id)
      );
      captain1Id.value = '';
      captain2Id.value = '';
      assistants1.value = new Set();
      assistants2.value = new Set();
    }
  }
  // Reload staff for the current team
  try {
    const s = await apiFetch(`/matches/${route.params.id}/staff`);
    const staffPool =
      (activeTeam.value === s.team2_id ? s.away?.staff : s.home?.staff) || [];
    staff.value = staffPool;
    staffRev.value =
      activeTeam.value === s.team2_id ? s.away_rev || '' : s.home_rev || '';
    if (Array.isArray(s.categories)) staffCategories.value = s.categories;
    staffSelected.value = new Set(
      staffPool.filter((x) => x.selected).map((x) => x.team_staff_id)
    );
    const m = {};
    for (const r of staffPool) {
      m[r.team_staff_id] = r.match_role?.id ?? r.role?.id ?? null;
    }
    editedStaffRole.value = m;
  } catch (e) {
    // ignore
  }
});
</script>

<template>
  <div class="py-3 school-match-lineups-page">
    <div class="container">
      <Breadcrumbs
        :items="[
          { label: 'Главная', to: '/' },
          { label: 'Управление спортивной школой', disabled: true },
          { label: 'Матчи', to: '/school-matches' },
          { label: 'Матч', to: `/school-matches/${route.params.id}` },
          { label: 'Составы' },
        ]"
      />
      <h1 class="mb-3">Составы на матч</h1>

      <div v-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>

      <div v-if="loading" class="card section-card tile fade-in shadow-sm">
        <div
          class="card-body text-muted d-flex align-items-center"
          style="min-height: 120px"
        >
          <div
            class="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          ></div>
          Загрузка состава…
        </div>
      </div>

      <div v-else-if="!data" class="card section-card tile fade-in shadow-sm">
        <div class="card-body text-muted">Нет данных матча</div>
      </div>

      <div v-else class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <div
            class="d-flex flex-column flex-md-row align-items-md-end gap-3 mb-3"
          >
            <div class="flex-grow-1">
              <label for="search" class="form-label mb-1 small text-muted"
                >Поиск по ФИО, номеру, амплуа и должности</label
              >
              <input
                id="search"
                v-model="search"
                type="search"
                class="form-control"
                placeholder="Например: Иванов, 17, Вратарь, Тренер"
              />
            </div>
            <div
              v-if="
                data.team1_id &&
                data.team2_id &&
                (data.is_admin || (data.is_home && data.is_away))
              "
              class="ms-md-auto"
            >
              <label class="form-label mb-1 small text-muted"
                >Команда для редактирования</label
              >
              <select v-model="activeTeam" class="form-select">
                <option :value="data.team1_id">
                  {{ data.team1_name || 'Команда 1' }}
                </option>
                <option :value="data.team2_id">
                  {{ data.team2_name || 'Команда 2' }}
                </option>
              </select>
            </div>
          </div>

          <!-- Save status hint -->
          <SyncStatus
            :saving="saving"
            :pending-players="pendingPlayers"
            :pending-staff="pendingStaff"
            :is-online="isOnline"
          />

          <div class="section-heading mt-2 mb-2">
            <span class="text-muted small fw-semibold">Игроки</span>
          </div>

          <div class="row g-2 align-items-center mb-2">
            <div class="col">
              <div class="fw-semibold">
                Всего: {{ roster.length }}
                <span class="text-muted">•</span>
                Выбрано:
                {{
                  roster.filter((p) => selected.has(p.team_player_id)).length
                }}
              </div>
            </div>
            <div class="col-12 col-sm-auto d-flex justify-content-end gap-2">
              <button
                class="btn btn-sm btn-outline-secondary"
                type="button"
                :disabled="roster.length === 0"
                @click="toggleAll"
              >
                {{ allSelected() ? 'Снять все' : 'Выбрать все' }}
              </button>
              <button
                class="btn btn-sm btn-outline-primary"
                type="button"
                :title="exportDisabled ? exportDisabledReason() : 'Экспорт PDF'"
                @click="onExportClick"
              >
                Экспорт PDF
              </button>
            </div>
          </div>

          <div v-if="!canEdit" class="alert alert-warning py-2" role="alert">
            Вам недоступно редактирование состава этой команды.
          </div>

          <!-- Export readiness modal -->
          <ExportModal
            :export-requirements="exportRequirements"
            :export-disabled="exportDisabled"
            :on-confirm="onConfirmExportFromModal"
            :on-ready="onModalReady"
          />

          <!-- Removed inline select-all checkbox to reduce UI clutter -->
          <!-- Preferences controls removed per design review -->

          <!-- Desktop/tablet table view -->
          <div class="d-none d-md-block">
            <PlayersTable
              :grouped-roster="groupedRoster"
              :roster-length="roster.length"
              :selected="selected"
              :can-edit="canEdit"
              :is-double="isDouble"
              :roles="roles"
              :edited-number="editedNumber"
              :edited-role="editedRole"
              :edited-squad="editedSquad"
              :edited-both="editedBoth"
              :is-player-gk="isPlayerGk"
              :gk-count="gkCount"
              :duplicate-numbers-set="duplicateNumbersSet"
              :captain-id="captainId"
              :captain1-id="captain1Id"
              :captain2-id="captain2Id"
              :assistants="assistants"
              :assistants1="assistants1"
              :assistants2="assistants2"
              :on-toggle="toggle"
              :on-number-input="onNumberInput"
              :on-role-change="onRoleChange"
              :on-squad-change="onSquadChange"
              :on-toggle-captain="toggleCaptain"
              :on-toggle-assistant="toggleAssistant"
            />
          </div>

          <!-- Mobile list view -->
          <div class="d-block d-md-none">
            <PlayersListMobile
              :grouped-roster="groupedRoster"
              :roster-length="roster.length"
              :selected="selected"
              :can-edit="canEdit"
              :is-double="isDouble"
              :roles="roles"
              :edited-number="editedNumber"
              :edited-role="editedRole"
              :edited-squad="editedSquad"
              :edited-both="editedBoth"
              :is-player-gk="isPlayerGk"
              :gk-count="gkCount"
              :duplicate-numbers-set="duplicateNumbersSet"
              :captain-id="captainId"
              :captain1-id="captain1Id"
              :captain2-id="captain2Id"
              :assistants="assistants"
              :assistants1="assistants1"
              :assistants2="assistants2"
              :on-toggle="toggle"
              :on-number-input="onNumberInput"
              :on-role-change="onRoleChange"
              :on-squad-change="onSquadChange"
              :on-toggle-captain="toggleCaptain"
              :on-toggle-assistant="toggleAssistant"
            />
          </div>

          <hr class="my-4" />
          <StaffList
            :grouped-staff="groupedStaff"
            :filtered-count="filteredStaff().length"
            :staff-selected="staffSelected"
            :staff-categories="staffCategories"
            :can-edit="canEdit"
            :all-staff-selected="allStaffSelected"
            :toggle-all-staff="toggleAllStaff"
            :toggle-staff="toggleStaff"
            :on-staff-role-change="onStaffRoleChange"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.school-match-lineups-page .table tr {
  transition: background-color 0.15s ease-in-out;
}
.school-match-lineups-page .table tr:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

/* Section heading subtle style */
.section-heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.section-heading::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #d0d5dd;
}

/* Mobile fine-tuning */
@media (max-width: 575.98px) {
  .school-match-lineups-page .btn {
    white-space: nowrap;
  }
  .school-match-lineups-page .list-group-item {
    border-color: #edf2f7;
  }
}
</style>
