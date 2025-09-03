<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { RouterLink, useRoute } from 'vue-router';
import { apiFetch } from '../api.js';

const route = useRoute();
const error = ref('');
const loading = ref(true);
const saving = ref(false);
const data = ref(null); // result of GET /matches/:id/lineups
const search = ref('');
const activeTeam = ref(''); // team_id we're editing
const selected = ref(new Set()); // Set of team_player_id currently selected
const roles = ref([]); // available roles
const editedNumber = ref({}); // tpId -> number
const editedRole = ref({}); // tpId -> role_id|null
// Staff selection state
const staff = ref([]); // current team staff rows
const staffSelected = ref(new Set());
const staffCategories = ref([]);
const editedStaffRole = ref({});
// Global search is shared across players and staff
// Staff selection UX limits (server-side validation on export)
const staffSelectedCount = computed(() => staffSelected.value.size);
const staffOverLimit = computed(() => staffSelectedCount.value > 8);
const hasAnyStaff = computed(() => staffSelected.value.size > 0);
const hasHeadCoachSelected = computed(() => {
  const byId = new Map(
    (staffCategories.value || []).map((c) => [
      String(c.id),
      c.name.toLowerCase(),
    ])
  );
  for (const r of staff.value) {
    if (!staffSelected.value.has(r.team_staff_id)) continue;
    const rid =
      editedStaffRole.value[r.team_staff_id] || r.match_role?.id || null; // only match role
    const nm = rid ? byId.get(String(rid)) || '' : '';
    if (nm === 'главный тренер') return true;
  }
  return false;
});
// Leadership selection
const captainId = ref(''); // team_player_id of the captain
const assistants = ref(new Set()); // up to 2 team_player_id

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

// Duplicate numbers guard (selected players with the same match number)
const duplicateNumbers = computed(() => {
  if (!data.value) return [];
  const pool =
    activeTeam.value === data.value.team2_id
      ? data.value.away?.players || []
      : data.value.home?.players || [];
  const seen = new Map(); // number -> count
  for (const p of pool) {
    if (!selected.value.has(p.team_player_id)) continue;
    const n = editedNumber.value[p.team_player_id];
    if (n == null || Number.isNaN(n)) continue;
    const key = String(n);
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  return Array.from(seen.entries())
    .filter(([, cnt]) => cnt > 1)
    .map(([num]) => num);
});
const hasDuplicateNumbers = computed(() => duplicateNumbers.value.length > 0);
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
  return !!captainId.value && selected.value.has(captainId.value);
});

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
  const gkOk = gkCount.value >= 1 && gkCount.value <= 2;
  const fldOk = fieldCount.value >= 5 && fieldCount.value <= 20;
  return (
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
  const gkOk = gkCount.value >= 1 && gkCount.value <= 2;
  const fldOk = fieldCount.value >= 5 && fieldCount.value <= 20;
  const staffCount = staffSelectedCount.value;
  return [
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
const exportModalRef = ref(null);
let exportModal;

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
  // Preselect already saved players from the server
  const all = [...(d.home?.players || []), ...(d.away?.players || [])];
  selected.value = new Set(
    all.filter((p) => p.selected).map((p) => p.team_player_id)
  );
  // Prefill edits with match overrides or defaults
  const num = {};
  const rol = {};
  for (const p of all) {
    num[p.team_player_id] = p.match_number ?? p.number ?? null;
    rol[p.team_player_id] = p.match_role?.id ?? p.role?.id ?? null;
  }
  editedNumber.value = num;
  editedRole.value = rol;
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
  const isGK = (p) =>
    (p.match_role?.name || p.role?.name || '').toLowerCase() ===
    gkName.toLowerCase();
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
    if (captainId.value === id) captainId.value = '';
    if (assistants.value.has(id)) {
      const ns = new Set(assistants.value);
      ns.delete(id);
      assistants.value = ns;
    }
    // Immediate save for removal regardless of missing roles
    save(true);
    return;
  } else {
    // guard GK limit
    const willBeGk = isPlayerGk(p);
    if (willBeGk && gkCount.value >= 2) {
      error.value = 'В составе на матч не может быть более двух вратарей';
      return;
    }
    if (!willBeGk && fieldCount.value >= 20) {
      error.value = 'Нельзя выбрать более 20 полевых игроков';
      return;
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
  scheduleAutoSave();
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
  // Select within constraints: GKs first (max 2), then field players (max 20)
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
  selected.value = s;
  scheduleAutoSave();
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
    const currNum = p.match_number ?? null;
    const currRole = p.match_role?.id ?? null;
    const newNum = editedNumber.value[p.team_player_id] ?? null;
    const newRole = editedRole.value[p.team_player_id] ?? null;
    if (String(currNum ?? '') !== String(newNum ?? '')) return true;
    if (String(currRole ?? '') !== String(newRole ?? '')) return true;
  }

  // Leadership change check (captain and assistants)
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
    // Preselect already saved representatives
    staffSelected.value = new Set(
      pool.filter((x) => x.selected).map((x) => x.team_staff_id)
    );
    // Prefill role edits (prefer match override, then base role)
    const m = {};
    for (const r of pool)
      m[r.team_staff_id] = r.match_role?.id ?? r.role?.id ?? null;
    editedStaffRole.value = m;
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки данных';
  } finally {
    loading.value = false;
  }
}

async function save(force = false) {
  if (!data.value) return;
  if (saving.value) return;
  if (!force && missingRoles.value) return;
  if (!hasChanges.value) return;
  saving.value = true;
  error.value = '';
  try {
    const pool =
      activeTeam.value === data.value.team2_id
        ? data.value.away?.players || []
        : data.value.home?.players || [];
    // assign assistant order by stable order
    const asOrder = Array.from(assistants.value);
    const payload = pool.map((p) => ({
      team_player_id: p.team_player_id,
      selected: selected.value.has(p.team_player_id),
      number: selected.value.has(p.team_player_id)
        ? (editedNumber.value[p.team_player_id] ?? null)
        : null,
      role_id: selected.value.has(p.team_player_id)
        ? (editedRole.value[p.team_player_id] ?? null)
        : null,
      is_captain:
        selected.value.has(p.team_player_id) &&
        captainId.value === p.team_player_id,
      assistant_order: selected.value.has(p.team_player_id)
        ? asOrder.indexOf(p.team_player_id) >= 0
          ? asOrder.indexOf(p.team_player_id) + 1
          : null
        : null,
    }));
    await apiFetch(`/matches/${route.params.id}/lineups`, {
      method: 'POST',
      body: JSON.stringify({ team_id: activeTeam.value, players: payload }),
    });
    // Reflect saved state locally to avoid heavy reload
    const roleById = new Map((roles.value || []).map((r) => [String(r.id), r]));
    const updateLocal = (arr) => {
      for (const p of arr) {
        const sel = selected.value.has(p.team_player_id);
        p.selected = sel;
        if (sel) {
          const n = editedNumber.value[p.team_player_id] ?? null;
          const rid = editedRole.value[p.team_player_id] ?? null;
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
          p.is_captain = captainId.value === p.team_player_id;
          p.assistant_order =
            asOrder.indexOf(p.team_player_id) >= 0
              ? asOrder.indexOf(p.team_player_id) + 1
              : null;
        } else {
          p.match_number = null;
          p.match_role = null;
          p.is_captain = false;
          p.assistant_order = null;
        }
      }
    };
    if (activeTeam.value === data.value.team2_id)
      updateLocal(data.value.away.players);
    else updateLocal(data.value.home.players);
  } catch (e) {
    error.value = e.message || 'Не удалось сохранить состав';
  } finally {
    saving.value = false;
  }
}

let saveTimer = null;
function scheduleAutoSave() {
  if (!canEdit.value || missingRoles.value) return;
  if (!hasChanges.value) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    save(false);
  }, 600);
}

function onNumberInput(p, e) {
  const val = e.target.value;
  editedNumber.value[p.team_player_id] =
    val === '' ? null : Math.max(0, Math.min(99, parseInt(val, 10) || 0));
  // Block autosave if duplicate numbers present; let user resolve
  if (!hasDuplicateNumbers.value) scheduleAutoSave();
}

function onRoleChange(p, e) {
  const val = e.target.value || null;
  // If switching to GK, enforce the GK limit
  if (val && gkRoleId.value && String(val) === String(gkRoleId.value)) {
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
  if (val && (!gkRoleId.value || String(val) !== String(gkRoleId.value))) {
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
  scheduleAutoSave();
}

function canAssignLeadership(p) {
  return selected.value.has(p.team_player_id) && !isPlayerGk(p);
}
function toggleCaptain(p) {
  if (!canAssignLeadership(p)) return;
  const id = p.team_player_id;
  const isSame = captainId.value === id;
  // If making this player captain, ensure they are not an assistant
  if (!isSame) {
    if (assistants.value.has(id)) {
      const ns = new Set(assistants.value);
      ns.delete(id);
      assistants.value = ns;
    }
  }
  captainId.value = isSame ? '' : id;
  // immediate save like checkbox behavior
  save(true);
}
function toggleAssistant(p) {
  if (!canAssignLeadership(p)) return;
  const id = p.team_player_id;
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
  // immediate save like checkbox behavior
  save(true);
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
  if (!activeTeam.value) return 'Выберите команду';
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

function toggleAllStaff() {
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
  scheduleStaffAutoSave();
}

function onStaffRoleChange(row, e) {
  editedStaffRole.value[row.team_staff_id] = e.target.value || null;
  scheduleStaffAutoSave();
}

async function toggleStaff(row) {
  const id = row.team_staff_id;
  const s = new Set(staffSelected.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  staffSelected.value = s;
  scheduleStaffAutoSave();
}

// Staff save, analogous to players
const staffHasChanges = computed(() => {
  const current = new Map((staff.value || []).map((r) => [r.team_staff_id, r]));
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
  }));
  try {
    await apiFetch(`/matches/${route.params.id}/staff`, {
      method: 'POST',
      body: JSON.stringify({ team_id: activeTeam.value, staff: payload }),
    });
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
      } else {
        r.match_role = null;
      }
    }
  } catch (e) {
    error.value = e.message || 'Не удалось сохранить представителей';
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
  // Init export modal
  if (exportModalRef.value) exportModal = new Modal(exportModalRef.value);
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

watch(activeTeam, async () => {
  // Recompute selected set limited to current team pool
  if (!data.value) return;
  // Preselect already saved players for the chosen team
  if (activeTeam.value === data.value.team2_id) {
    selected.value = new Set(
      (data.value.away?.players || [])
        .filter((p) => p.selected)
        .map((p) => p.team_player_id)
    );
    const pool = data.value.away?.players || [];
    const cap = pool.find((p) => p.is_captain);
    captainId.value = cap ? cap.team_player_id : '';
    assistants.value = new Set(
      pool
        .filter((p) => p.assistant_order != null)
        .sort((a, b) => (a.assistant_order || 0) - (b.assistant_order || 0))
        .map((p) => p.team_player_id)
    );
  } else {
    selected.value = new Set(
      (data.value.home?.players || [])
        .filter((p) => p.selected)
        .map((p) => p.team_player_id)
    );
    const pool = data.value.home?.players || [];
    const cap = pool.find((p) => p.is_captain);
    captainId.value = cap ? cap.team_player_id : '';
    assistants.value = new Set(
      pool
        .filter((p) => p.assistant_order != null)
        .sort((a, b) => (a.assistant_order || 0) - (b.assistant_order || 0))
        .map((p) => p.team_player_id)
    );
  }
  // Reload staff for the current team
  try {
    const s = await apiFetch(`/matches/${route.params.id}/staff`);
    const staffPool =
      (activeTeam.value === s.team2_id ? s.away?.staff : s.home?.staff) || [];
    staff.value = staffPool;
    if (Array.isArray(s.categories)) staffCategories.value = s.categories;
    staffSelected.value = new Set(
      staffPool.filter((x) => x.selected).map((x) => x.team_staff_id)
    );
    const m = {};
    for (const r of staffPool)
      m[r.team_staff_id] = r.match_role?.id ?? r.role?.id ?? null;
    editedStaffRole.value = m;
  } catch (e) {
    // ignore
  }
});
</script>

<template>
  <div class="py-3 school-match-lineups-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/">Главная</RouterLink>
          </li>
          <li class="breadcrumb-item">Управление спортивной школой</li>
          <li class="breadcrumb-item">
            <RouterLink to="/school-matches">Матчи</RouterLink>
          </li>
          <li class="breadcrumb-item">
            <RouterLink :to="`/school-matches/${route.params.id}`"
              >Матч</RouterLink
            >
          </li>
          <li class="breadcrumb-item active" aria-current="page">Составы</li>
        </ol>
      </nav>
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
                data.team1_id && data.team2_id && data.is_home && data.is_away
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

          <div class="d-flex justify-content-between align-items-center mb-2">
            <div class="fw-semibold">
              Всего: {{ roster.length }}
              <span class="text-muted">•</span>
              Выбрано:
              {{ roster.filter((p) => selected.has(p.team_player_id)).length }}
            </div>
            <div class="d-flex gap-2 flex-wrap">
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
          <div
            ref="exportModalRef"
            class="modal fade"
            tabindex="-1"
            aria-hidden="true"
          >
            <div
              class="modal-dialog modal-dialog-centered modal-dialog-scrollable"
            >
              <div class="modal-content">
                <div class="modal-header">
                  <h2 class="modal-title h5">Готовность к выгрузке заявки</h2>
                  <button
                    type="button"
                    class="btn-close"
                    data-bs-dismiss="modal"
                    aria-label="Close"
                  ></button>
                </div>
                <div class="modal-body">
                  <div
                    class="mb-2"
                    :class="
                      exportBlocking.length === 0
                        ? 'text-success'
                        : 'text-muted'
                    "
                  >
                    <span v-if="exportBlocking.length === 0"
                      >Все условия выполнены. Можно выгружать PDF.</span
                    >
                    <span v-else
                      >Чтобы выгрузить PDF, выполните условия ниже:</span
                    >
                  </div>
                  <ul class="mb-0 ps-3">
                    <li
                      v-for="r in exportRequirements"
                      :key="r.key"
                      :class="r.ok ? 'text-success' : 'text-danger'"
                    >
                      <span class="me-1">{{ r.ok ? '✔' : '✖' }}</span
                      >{{ r.text }}
                    </li>
                  </ul>
                </div>
                <div class="modal-footer">
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    data-bs-dismiss="modal"
                  >
                    Закрыть
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary"
                    :disabled="exportDisabled"
                    @click="onConfirmExportFromModal"
                  >
                    Экспорт PDF
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="table-responsive">
            <table class="table align-middle">
              <thead>
                <tr class="text-muted small">
                  <th style="width: 44px" class="text-center">
                    <input
                      class="form-check-input"
                      type="checkbox"
                      :checked="allSelected()"
                      :aria-label="allSelected() ? 'Снять все' : 'Выбрать все'"
                      @change="toggleAll"
                    />
                  </th>
                  <th>Игрок</th>
                  <th style="width: 120px">Д.р.</th>
                  <th style="width: 120px">№ на матч</th>
                  <th style="width: 220px">Амплуа на матч</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="grp in groupedRoster" :key="grp.group">
                  <tr class="table-light">
                    <td colspan="5" class="fw-semibold">{{ grp.group }}</td>
                  </tr>
                  <tr
                    v-for="p in grp.players"
                    :key="p.team_player_id"
                    class="fade-in"
                  >
                    <td class="text-center">
                      <input
                        class="form-check-input"
                        type="checkbox"
                        :checked="selected.has(p.team_player_id)"
                        :disabled="!canEdit"
                        :aria-label="`Выбрать игрока ${p.full_name}`"
                        @change="() => toggle(p)"
                      />
                    </td>
                    <td>
                      <div
                        class="d-flex align-items-center justify-content-between gap-2"
                      >
                        <div class="fw-semibold">{{ p.full_name }}</div>
                        <div
                          v-if="
                            canEdit &&
                            selected.has(p.team_player_id) &&
                            !isPlayerGk(p)
                          "
                          class="d-flex gap-1"
                        >
                          <button
                            class="btn btn-xs btn-outline-secondary"
                            type="button"
                            :class="{ active: captainId === p.team_player_id }"
                            title="Капитан"
                            @click="() => toggleCaptain(p)"
                          >
                            К
                          </button>
                          <button
                            class="btn btn-xs btn-outline-secondary"
                            type="button"
                            :class="{
                              active: assistants.has(p.team_player_id),
                            }"
                            title="Ассистент"
                            @click="() => toggleAssistant(p)"
                          >
                            A
                          </button>
                        </div>
                        <div
                          v-else
                          class="text-muted small"
                          style="min-width: 16px; text-align: right"
                        >
                          <span v-if="captainId === p.team_player_id">К</span>
                          <span v-else-if="assistants.has(p.team_player_id)"
                            >A</span
                          >
                        </div>
                      </div>
                    </td>
                    <td class="text-muted">
                      <span v-if="p.date_of_birth">{{
                        new Date(p.date_of_birth).toLocaleDateString('ru-RU')
                      }}</span>
                      <span v-else>—</span>
                    </td>
                    <td style="max-width: 140px">
                      <div class="input-group input-group-sm">
                        <input
                          type="number"
                          class="form-control"
                          min="0"
                          max="99"
                          :disabled="
                            !canEdit || !selected.has(p.team_player_id)
                          "
                          :value="editedNumber[p.team_player_id] ?? ''"
                          aria-label="Номер в матче"
                          placeholder="—"
                          @input="(e) => onNumberInput(p, e)"
                        />
                      </div>
                    </td>
                    <td>
                      <select
                        class="form-select form-select-sm"
                        :disabled="!canEdit || !selected.has(p.team_player_id)"
                        :value="editedRole[p.team_player_id] ?? ''"
                        aria-label="Амплуа в матче"
                        @change="(e) => onRoleChange(p, e)"
                      >
                        <option v-for="r in roles" :key="r.id" :value="r.id">
                          {{ r.name }}
                        </option>
                      </select>
                    </td>
                  </tr>
                </template>
                <tr v-if="roster.length === 0">
                  <td colspan="5" class="text-muted py-4">
                    Нет игроков по текущему фильтру
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <hr class="my-4" />
          <div class="section-heading mt-2 mb-2">
            <span class="text-muted small fw-semibold"
              >Представители команды</span
            >
          </div>
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div class="fw-semibold">
              Всего: {{ filteredStaff().length }}
              <span class="text-muted">•</span>
              Выбрано:
              {{
                Array.from(staffSelected).filter((id) =>
                  filteredStaff().some((r) => r.team_staff_id === id)
                ).length
              }}
            </div>
            <div class="d-flex gap-2 flex-wrap">
              <button
                class="btn btn-sm btn-outline-secondary"
                type="button"
                :disabled="filteredStaff().length === 0"
                @click="toggleAllStaff"
              >
                {{ allStaffSelected() ? 'Снять все' : 'Выбрать все' }}
              </button>
            </div>
          </div>
          <!-- Desktop/tablet view -->
          <div class="table-responsive d-none d-md-block">
            <table class="table align-middle">
              <thead>
                <tr class="text-muted small">
                  <th style="width: 44px" class="text-center"></th>
                  <th>ФИО</th>
                  <th style="width: 220px">Должность на матч</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="grp in groupedStaff" :key="grp.group">
                  <tr class="table-light">
                    <td colspan="3" class="fw-semibold">{{ grp.group }}</td>
                  </tr>
                  <tr
                    v-for="r in grp.staff"
                    :key="r.team_staff_id"
                    class="fade-in"
                  >
                    <td class="text-center">
                      <input
                        class="form-check-input"
                        type="checkbox"
                        :checked="staffSelected.has(r.team_staff_id)"
                        @change="() => toggleStaff(r)"
                      />
                    </td>
                    <td>
                      <div class="fw-semibold">{{ r.full_name }}</div>
                    </td>
                    <td>
                      <select
                        class="form-select form-select-sm"
                        :disabled="
                          !canEdit || !staffSelected.has(r.team_staff_id)
                        "
                        :value="
                          editedStaffRole[r.team_staff_id] ??
                          r.match_role?.id ??
                          ''
                        "
                        aria-label="Должность представителя на матч"
                        @change="(e) => onStaffRoleChange(r, e)"
                      >
                        <option
                          v-for="c in staffCategories"
                          :key="c.id"
                          :value="c.id"
                        >
                          {{ c.name }}
                        </option>
                      </select>
                    </td>
                  </tr>
                </template>
                <tr v-if="filteredStaff().length === 0">
                  <td colspan="3" class="text-muted py-3">
                    Нет представителей по текущему фильтру
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile view -->
          <div class="d-block d-md-none">
            <div
              v-if="filteredStaff().length === 0"
              class="text-muted py-2 small"
            >
              Нет представителей по текущему фильтру
            </div>
            <div v-for="grp in groupedStaff" :key="grp.group" class="mb-2">
              <div class="text-muted small fw-semibold mb-1">
                {{ grp.group }}
              </div>
              <div class="list-group">
                <div
                  v-for="r in grp.staff"
                  :key="r.team_staff_id"
                  class="list-group-item py-2"
                >
                  <div class="d-flex align-items-start gap-2">
                    <input
                      class="form-check-input mt-1"
                      type="checkbox"
                      :checked="staffSelected.has(r.team_staff_id)"
                      aria-label="Выбрать представителя"
                      @change="() => toggleStaff(r)"
                    />
                    <div class="flex-grow-1">
                      <div class="fw-semibold">{{ r.full_name }}</div>
                      <div class="mt-1">
                        <select
                          class="form-select form-select-sm"
                          :disabled="
                            !canEdit || !staffSelected.has(r.team_staff_id)
                          "
                          :value="
                            editedStaffRole[r.team_staff_id] ??
                            r.match_role?.id ??
                            ''
                          "
                          aria-label="Должность представителя на матч"
                          @change="(e) => onStaffRoleChange(r, e)"
                        >
                          <option
                            v-for="c in staffCategories"
                            :key="c.id"
                            :value="c.id"
                          >
                            {{ c.name }}
                          </option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
@media (max-width: 576px) {
  .school-match-lineups-page .btn {
    white-space: nowrap;
  }
  .school-match-lineups-page .list-group-item {
    border-color: #edf2f7;
  }
}
</style>
