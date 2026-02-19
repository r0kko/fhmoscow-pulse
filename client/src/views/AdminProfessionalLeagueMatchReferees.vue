<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import InfoItem from '../components/InfoItem.vue';
import { apiFetch } from '../api';
import { formatKickoff, isMskMidnight } from '../utils/time';

const route = useRoute();

const matchCard = ref(null);
const matchRecord = ref(null);
const roleGroups = ref([]);
const referees = ref([]);
const dayMatches = ref([]);
const assignmentSheet = ref(null);

const loading = ref(true);
const loadingReferees = ref(false);
const loadingSheetStatus = ref(false);
const error = ref('');

const saving = ref(false);
const publishing = ref(false);
const generatingSheet = ref(false);
const actionError = ref('');
const actionSuccess = ref('');

const selectedDateKey = ref('');
const drafts = ref({});
const initialDraftSignature = ref('');

const matchId = computed(() => String(route.params.id || ''));

const breadcrumbs = computed(() => [
  { label: 'Главная', to: '/' },
  { label: 'Администрирование', to: '/admin' },
  {
    label: 'Назначение судей (профлиги)',
    to: '/admin/professional-leagues/referee-assignments',
  },
  {
    label: 'Матч',
    to: `/admin/professional-leagues/matches/${matchId.value}`,
  },
  { label: 'Судьи матча', disabled: true },
]);

const matchTitle = computed(() => {
  const home = matchCard.value?.team1 || '—';
  const away = matchCard.value?.team2 || '—';
  return `${home} — ${away}`;
});

const kickoff = computed(() =>
  formatKickoff(matchCard.value?.date_start || null)
);
const kickoffHeader = computed(() => {
  const iso = matchCard.value?.date_start || null;
  if (!iso) return '';
  if (isMskMidnight(iso)) return kickoff.value.date;
  return `${kickoff.value.time} • ${kickoff.value.date}`;
});

const requiredCountByRole = computed(() => {
  const map = new Map();
  (matchRecord.value?.referee_requirements || []).forEach((group) => {
    (group.roles || []).forEach((role) => {
      if (Number.isFinite(role.count) && role.count > 0) {
        map.set(role.id, role.count);
      }
    });
  });
  return map;
});

const requiredGroupIds = computed(
  () =>
    new Set(
      (matchRecord.value?.referee_requirements || [])
        .map((group) => group?.id)
        .filter(Boolean)
    )
);

const activeRoleGroups = computed(() => {
  const requiredGroups = requiredGroupIds.value;
  return roleGroups.value.filter((group) => requiredGroups.has(group.id));
});

const roleGroupByRoleId = computed(() => {
  const map = new Map();
  roleGroups.value.forEach((group) => {
    (group.roles || []).forEach((role) => {
      if (role?.id) map.set(role.id, group.id);
    });
  });
  return map;
});

const roleColumns = computed(() => {
  const requiredMap = requiredCountByRole.value;
  const columns = [];
  activeRoleGroups.value.forEach((group) => {
    (group.roles || []).forEach((role) => {
      if (requiredMap.has(role.id)) {
        columns.push({
          id: role.id,
          name: role.name,
          group_id: group.id,
          count: requiredMap.get(role.id) || 0,
        });
      }
    });
  });
  return columns;
});

const hasDraftAssignments = computed(() =>
  (matchRecord.value?.assignments || []).some(
    (assignment) => assignment.status === 'DRAFT'
  )
);

const canEdit = computed(() => {
  if (!matchRecord.value) return false;
  if (
    matchRecord.value.schedule_missing ||
    matchRecord.value.duration_missing
  ) {
    return false;
  }
  return roleColumns.value.length > 0;
});

function normalizedDraftState(source = drafts.value) {
  const normalized = {};
  const roleEntries = Array.from(requiredCountByRole.value.entries()).sort(
    ([left], [right]) => String(left).localeCompare(String(right))
  );
  roleEntries.forEach(([roleId, count]) => {
    const list = Array.isArray(source[roleId]) ? source[roleId] : [];
    normalized[roleId] = Array.from({ length: count }, (_unused, index) => {
      const value = list[index];
      return value ? String(value) : '';
    });
  });
  return normalized;
}

const hasUnsavedChanges = computed(
  () =>
    JSON.stringify(normalizedDraftState(drafts.value)) !==
    initialDraftSignature.value
);

const isDraftComplete = computed(() => {
  const state = normalizedDraftState(drafts.value);
  return Object.entries(state).every(([_roleId, users]) =>
    users.every((userId) => Boolean(userId))
  );
});

const canPublish = computed(() => {
  if (!canEdit.value) return false;
  if (saving.value || publishing.value) return false;
  if (hasUnsavedChanges.value) return false;
  if (!isDraftComplete.value) return false;
  return hasDraftAssignments.value;
});

const canGenerateAssignmentsSheet = computed(() => {
  if (!canEdit.value) return false;
  if (saving.value || publishing.value || generatingSheet.value) return false;
  if (hasUnsavedChanges.value) return false;
  return (matchRecord.value?.assignments || []).length > 0;
});

const roleGroupNameByRoleId = computed(() => {
  const map = new Map();
  roleGroups.value.forEach((group) => {
    (group.roles || []).forEach((role) => {
      if (role?.id) {
        map.set(role.id, String(group?.name || '').trim());
      }
    });
  });
  return map;
});

function isLeadershipRole(role) {
  const groupName = String(roleGroupNameByRoleId.value.get(role.id) || '')
    .trim()
    .toLowerCase();
  const roleName = String(role?.name || '')
    .trim()
    .toLowerCase();

  // Group-level classification has top priority.
  if (/бригад/.test(groupName)) return false;
  if (/руковод/.test(groupName)) return true;

  // Secretary roles should remain in the brigade block unless explicitly grouped as leadership.
  if (/секретар/.test(roleName)) return false;

  // Fallback for legacy role names without stable groups.
  return /руковод|инспектор|комиссар/.test(roleName);
}

const leadershipRoleColumns = computed(() =>
  roleColumns.value.filter((role) => isLeadershipRole(role))
);

const brigadeRoleColumns = computed(() =>
  roleColumns.value.filter((role) => !isLeadershipRole(role))
);

const assignmentSheetStatus = computed(() => {
  const alias = String(assignmentSheet.value?.status?.alias || '').toUpperCase();
  if (!assignmentSheet.value) {
    return {
      label: 'Не сформирован',
      badgeClass: 'bg-secondary-subtle text-secondary border',
    };
  }
  if (alias === 'AWAITING_SIGNATURE') {
    return {
      label: 'Ожидает подписания',
      badgeClass: 'bg-warning-subtle text-warning border',
    };
  }
  if (alias === 'SIGNED') {
    return {
      label: 'Подписан',
      badgeClass: 'bg-success-subtle text-success border',
    };
  }
  return {
    label: assignmentSheet.value?.status?.name || 'Сформирован',
    badgeClass: 'bg-info-subtle text-info border',
  };
});

const assignmentSheetActionLabel = computed(() =>
  assignmentSheet.value ? 'Переформировать лист' : 'Сформировать лист'
);

function splitAssignmentsByGroup(assignments = []) {
  const byGroup = new Map();
  const ungrouped = [];
  assignments.forEach((assignment) => {
    const groupId = assignment.role?.group_id;
    if (!groupId) {
      ungrouped.push(assignment);
      return;
    }
    if (!byGroup.has(groupId)) {
      byGroup.set(groupId, { drafts: [], published: [] });
    }
    const bucket = byGroup.get(groupId);
    if (assignment.status === 'DRAFT') {
      bucket.drafts.push(assignment);
      return;
    }
    if (
      assignment.status === 'PUBLISHED' ||
      assignment.status === 'CONFIRMED'
    ) {
      bucket.published.push(assignment);
    }
  });
  return { byGroup, ungrouped };
}

function effectiveAssignments(match) {
  if (!match) return [];
  const assignments = match.assignments || [];
  const clearGroups = new Set(match.draft_clear_group_ids || []);
  const { byGroup, ungrouped } = splitAssignmentsByGroup(assignments);
  const result = [...ungrouped];
  byGroup.forEach((bucket, groupId) => {
    const useDraft = clearGroups.has(groupId) || bucket.drafts.length > 0;
    result.push(...(useDraft ? bucket.drafts : bucket.published));
  });
  return result;
}

const assignmentWindowsByUser = computed(() => {
  const map = new Map();
  dayMatches.value.forEach((match) => {
    const window = matchTimeWindow(match);
    const dateKey = String(match?.msk_date || '').trim();
    if (!window || !dateKey) return;
    effectiveAssignments(match).forEach((assignment) => {
      const userId = assignment.user?.id;
      if (!userId) return;
      if (!map.has(userId)) map.set(userId, []);
      map.get(userId).push({
        matchId: match.id,
        dateKey,
        start: window.start,
        end: window.end,
      });
    });
  });
  return map;
});

const currentAssignments = computed(() => {
  const activeGroupIds = requiredGroupIds.value;
  const list = effectiveAssignments(matchRecord.value).filter((assignment) => {
    const groupId = assignment.role?.group_id;
    return !groupId || activeGroupIds.has(groupId);
  });
  return list.sort((left, right) => {
    const groupLeft = left.role?.group_name || '';
    const groupRight = right.role?.group_name || '';
    const groupCompare = groupLeft.localeCompare(groupRight, 'ru', {
      sensitivity: 'base',
    });
    if (groupCompare !== 0) return groupCompare;
    const roleLeft = left.role?.name || '';
    const roleRight = right.role?.name || '';
    const roleCompare = roleLeft.localeCompare(roleRight, 'ru', {
      sensitivity: 'base',
    });
    if (roleCompare !== 0) return roleCompare;
    const nameLeft = refereeLabel(left.user);
    const nameRight = refereeLabel(right.user);
    return nameLeft.localeCompare(nameRight, 'ru', { sensitivity: 'base' });
  });
});

const matchOptions = computed(() => {
  if (!matchRecord.value) return [];
  const base = referees.value.filter((referee) =>
    isRefereeAvailable(referee, matchRecord.value)
  );
  const byId = new Map(referees.value.map((referee) => [referee.id, referee]));
  const selected = new Set();
  Object.values(drafts.value).forEach((users) => {
    (users || []).forEach((userId) => {
      if (userId) selected.add(userId);
    });
  });
  const extras = [];
  selected.forEach((userId) => {
    if (base.some((entry) => entry.id === userId)) return;
    const known = byId.get(userId);
    if (known) {
      extras.push(known);
      return;
    }
    const assigned = (matchRecord.value?.assignments || []).find(
      (assignment) => assignment.user?.id === userId
    );
    if (!assigned?.user) return;
    extras.push({
      id: assigned.user.id,
      last_name: assigned.user.last_name,
      first_name: assigned.user.first_name,
      patronymic: assigned.user.patronymic,
      availability: { status: 'FREE' },
      availability_by_date: {},
    });
  });
  return [...base, ...extras].sort((left, right) =>
    refereeLabel(left).localeCompare(refereeLabel(right), 'ru', {
      sensitivity: 'base',
    })
  );
});

function toMoscowDateKey(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(date)
    .reduce((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
  if (!parts.year || !parts.month || !parts.day) return '';
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseTimeSeconds(value) {
  if (!value) return null;
  const text = String(value).trim();
  const parts = text.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const [hourPart, minutePart, secondPart] = parts;
  if (!/^\d{1,2}$/.test(hourPart) || !/^\d{2}$/.test(minutePart)) {
    return null;
  }
  if (secondPart !== undefined && !/^\d{2}$/.test(secondPart)) return null;
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  const second = secondPart ? Number(secondPart) : 0;
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(second) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }
  return hour * 3600 + minute * 60 + second;
}

function derivePartialMode(fromTime, toTime) {
  if (fromTime && toTime) {
    const from = parseTimeSeconds(fromTime);
    const to = parseTimeSeconds(toTime);
    if (from === null || to === null) return null;
    return from > to ? 'SPLIT' : 'WINDOW';
  }
  if (toTime && !fromTime) return 'BEFORE';
  if (fromTime && !toTime) return 'AFTER';
  return null;
}

function availabilityAllowsInterval(availability, startSeconds, endSeconds) {
  if (startSeconds === null || endSeconds === null) return false;
  if (!availability || normalizeAvailabilityStatus(availability) === 'FREE') {
    return true;
  }
  if (normalizeAvailabilityStatus(availability) === 'BUSY') {
    return false;
  }
  const from = parseTimeSeconds(availability.from_time);
  const to = parseTimeSeconds(availability.to_time);
  const mode = derivePartialMode(availability.from_time, availability.to_time);
  if (from === null && to === null) return true;
  if (mode === 'BEFORE') return to !== null && endSeconds <= to;
  if (mode === 'AFTER') return from !== null && startSeconds >= from;
  if (mode === 'WINDOW') {
    return (
      from !== null && to !== null && startSeconds >= from && endSeconds <= to
    );
  }
  if (mode === 'SPLIT') {
    return (
      from !== null && to !== null && (endSeconds <= to || startSeconds >= from)
    );
  }
  if (from !== null && to !== null) {
    if (from > to) return endSeconds <= to || startSeconds >= from;
    return startSeconds >= from && endSeconds <= to;
  }
  if (from !== null) return startSeconds >= from;
  if (to !== null) return endSeconds <= to;
  return false;
}

function intervalOverlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function matchTimeWindow(match) {
  const start = parseTimeSeconds(match?.msk_start_time);
  const end = parseTimeSeconds(match?.msk_end_time);
  if (start === null || end === null) return null;
  return { start, end };
}

function normalizeAvailabilityStatus(availability) {
  return String(availability?.status || '')
    .trim()
    .toUpperCase();
}

function hasConflict(
  userId,
  currentMatchId,
  dateKey,
  startSeconds,
  endSeconds
) {
  const windows = assignmentWindowsByUser.value.get(userId) || [];
  return windows.some(
    (window) =>
      window.dateKey === dateKey &&
      window.matchId !== currentMatchId &&
      intervalOverlaps(startSeconds, endSeconds, window.start, window.end)
  );
}

function resolveRefereeMatchAvailability(referee, match) {
  if (!referee || !match) return { available: false };
  if (match.schedule_missing || match.duration_missing) {
    return { available: false };
  }
  const dateKey = String(match?.msk_date || '').trim();
  const availabilityByDate = referee?.availability_by_date || {};
  const availability = availabilityByDate[dateKey] || referee?.availability;
  if (!availability) return { available: false };
  const status = normalizeAvailabilityStatus(availability);
  if (status !== 'FREE' && status !== 'PARTIAL') {
    return { available: false };
  }
  const window = matchTimeWindow(match);
  if (!window) return { available: false };
  if (hasConflict(referee.id, match.id, dateKey, window.start, window.end)) {
    return { available: false };
  }
  if (!availabilityAllowsInterval(availability, window.start, window.end)) {
    return { available: false };
  }
  return { available: true };
}

function isRefereeAvailable(referee, match) {
  return resolveRefereeMatchAvailability(referee, match).available;
}

function refereeLabel(user) {
  if (!user) return '—';
  const last = user.last_name || '';
  const first = user.first_name || '';
  const patronymic = user.patronymic || '';
  const initials = [first, patronymic]
    .filter(Boolean)
    .map((part) => `${part.charAt(0)}.`)
    .join(' ');
  return [last, initials].filter(Boolean).join(' ').trim() || '—';
}

function roleGroupIdForRole(roleId) {
  return roleGroupByRoleId.value.get(roleId) || null;
}

function currentRoleSelections(roleId) {
  const roleMap = drafts.value || {};
  const list = roleMap[roleId] || [];
  return Array.isArray(list) ? list : [];
}

function slotValue(roleId, index) {
  const list = currentRoleSelections(roleId);
  return list[index] || '';
}

function assignmentStatus(roleId, userId) {
  if (!roleId || !userId || !matchRecord.value) return null;
  const list = (matchRecord.value.assignments || []).filter(
    (assignment) =>
      assignment.role?.id === roleId && assignment.user?.id === userId
  );
  if (!list.length) return null;
  const priority = ['CONFIRMED', 'PUBLISHED', 'DRAFT'];
  for (const alias of priority) {
    if (list.some((entry) => entry.status === alias)) return alias;
  }
  return list[0]?.status || null;
}

function slotClass(roleId, index) {
  const userId = slotValue(roleId, index);
  if (!userId) return 'select-empty';
  const status = assignmentStatus(roleId, userId);
  if (status === 'CONFIRMED') return 'select-confirmed';
  if (status === 'PUBLISHED') return 'select-published';
  return 'select-draft';
}

function setSlotValue(roleId, index, value) {
  if (!canEdit.value) return;
  const normalized = value || '';
  const next = { ...drafts.value };
  const roleList = [...(next[roleId] || [])];
  while (roleList.length <= index) roleList.push('');
  roleList[index] = normalized;
  next[roleId] = roleList;

  if (normalized) {
    Object.keys(next).forEach((otherRoleId) => {
      const current = [...(next[otherRoleId] || [])];
      const deduplicated = current.map((entry, entryIndex) => {
        if (otherRoleId === roleId && entryIndex === index) return entry;
        return entry === normalized ? '' : entry;
      });
      next[otherRoleId] = deduplicated;
    });
  }

  drafts.value = next;
  actionError.value = '';
  actionSuccess.value = '';
}

function buildRoleMapFromAssignments(assignments = []) {
  const groupIds = requiredGroupIds.value;
  const draftByRole = new Map();
  const publishedByRole = new Map();

  assignments.forEach((assignment) => {
    const groupId = assignment.role?.group_id;
    const roleId = assignment.role?.id;
    const userId = assignment.user?.id;
    if (!groupId || !groupIds.has(groupId) || !roleId || !userId) return;
    if (assignment.status === 'DRAFT') {
      if (!draftByRole.has(roleId)) draftByRole.set(roleId, []);
      draftByRole.get(roleId).push(userId);
      return;
    }
    if (
      assignment.status === 'PUBLISHED' ||
      assignment.status === 'CONFIRMED'
    ) {
      if (!publishedByRole.has(roleId)) publishedByRole.set(roleId, []);
      publishedByRole.get(roleId).push(userId);
    }
  });

  const roleMap = {};
  const roleIds = new Set([...draftByRole.keys(), ...publishedByRole.keys()]);
  roleIds.forEach((roleId) => {
    const source = draftByRole.has(roleId) ? draftByRole : publishedByRole;
    roleMap[roleId] = [...(source.get(roleId) || [])];
  });

  const clearGroups = new Set(matchRecord.value?.draft_clear_group_ids || []);
  activeRoleGroups.value.forEach((group) => {
    if (!clearGroups.has(group.id)) return;
    (group.roles || []).forEach((role) => {
      roleMap[role.id] = [];
    });
  });

  return roleMap;
}

function initDraftsFromMatch() {
  const roleMap = buildRoleMapFromAssignments(
    matchRecord.value?.assignments || []
  );
  drafts.value = roleMap;
  initialDraftSignature.value = JSON.stringify(normalizedDraftState(roleMap));
}

function roleIdsForGroup(groupId) {
  return roleColumns.value
    .filter((role) => role.group_id === groupId)
    .map((role) => role.id);
}

function buildAssignmentsPayload(groupId) {
  const roleIds = new Set(roleIdsForGroup(groupId));
  const payload = [];
  Object.entries(drafts.value).forEach(([roleId, users]) => {
    if (!roleIds.has(roleId)) return;
    (users || []).forEach((userId) => {
      if (!userId) return;
      payload.push({ role_id: roleId, user_id: userId });
    });
  });
  return payload;
}

function normalizeMatches(list = []) {
  return list.map((match) => ({
    ...match,
    assignments: match.assignments || [],
    referee_requirements: match.referee_requirements || [],
    draft_clear_group_ids: match.draft_clear_group_ids || [],
  }));
}

async function loadRoleGroups() {
  const data = await apiFetch('/referee-assignments/role-groups');
  roleGroups.value = data.groups || [];
}

async function loadMatchCard() {
  const data = await apiFetch(`/matches/${matchId.value}`);
  matchCard.value = data.match || null;
}

async function loadRefereesByDate(dateKey) {
  loadingReferees.value = true;
  try {
    const params = new URLSearchParams({
      date: dateKey,
      limit: '0',
      role_alias: 'BRIGADE_REFEREE',
      competition_alias: 'PRO',
      only_leagues_access: '1',
    });
    const data = await apiFetch(`/referee-assignments/referees?${params}`);
    referees.value = data.referees || [];
  } finally {
    loadingReferees.value = false;
  }
}

async function loadAssignmentsSheetStatus() {
  loadingSheetStatus.value = true;
  try {
    const data = await apiFetch(
      `/referee-assignments/matches/${matchId.value}/assignment-sheet`
    );
    assignmentSheet.value = data?.sheet || null;
  } catch {
    assignmentSheet.value = null;
  } finally {
    loadingSheetStatus.value = false;
  }
}

function formatSheetDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const datePart = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
  const timePart = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${datePart} ${timePart}`;
}

async function refreshMatchFromDate(dateKey) {
  const params = new URLSearchParams({
    date: dateKey,
    competition_alias: 'PRO',
  });
  const data = await apiFetch(`/referee-assignments/matches?${params}`);
  dayMatches.value = normalizeMatches(data.matches || []);
  matchRecord.value =
    dayMatches.value.find((match) => String(match.id) === matchId.value) ||
    null;
  if (!matchRecord.value) {
    throw new Error(
      'Матч не найден в списке назначений профлиг за выбранный день'
    );
  }
}

function formatPublishNotificationSummary(stats) {
  if (!stats || stats.error) return '';
  const parts = [];
  if (Number.isFinite(stats.queued) && stats.queued > 0) {
    parts.push(`отправлено: ${stats.queued}`);
  }
  if (Number.isFinite(stats.published) || Number.isFinite(stats.cancelled)) {
    const publishedCount = Number.isFinite(stats.published)
      ? stats.published
      : 0;
    const cancelledCount = Number.isFinite(stats.cancelled)
      ? stats.cancelled
      : 0;
    if (publishedCount || cancelledCount) {
      parts.push(`новые: ${publishedCount}, отмены: ${cancelledCount}`);
    }
  }
  if (Number.isFinite(stats.failed) && stats.failed > 0) {
    parts.push(`ошибки: ${stats.failed}`);
  }
  return parts.join(', ');
}

async function saveDraftAssignments() {
  if (!canEdit.value || !matchRecord.value) return;
  saving.value = true;
  actionError.value = '';
  actionSuccess.value = '';
  try {
    const groupIds = Array.from(
      new Set(roleColumns.value.map((role) => role.group_id).filter(Boolean))
    );
    for (const groupId of groupIds) {
      const assignments = buildAssignmentsPayload(groupId);
      const data = await apiFetch(
        `/referee-assignments/matches/${matchId.value}/referees`,
        {
          method: 'PUT',
          body: JSON.stringify({
            assignments,
            role_group_id: groupId,
            clear_published: assignments.length === 0,
          }),
        }
      );
      matchRecord.value = {
        ...(matchRecord.value || {}),
        assignments: data.assignments || [],
        draft_clear_group_ids: data.draft_clear_group_ids || [],
      };
    }
    await refreshMatchFromDate(selectedDateKey.value);
    initDraftsFromMatch();
    actionSuccess.value = 'Черновик назначений сохранен.';
  } catch (e) {
    actionError.value = e.message || 'Не удалось сохранить черновик';
  } finally {
    saving.value = false;
  }
}

async function publishAssignments() {
  if (!canPublish.value) return;
  publishing.value = true;
  actionError.value = '';
  actionSuccess.value = '';
  try {
    const data = await apiFetch(
      `/referee-assignments/matches/${matchId.value}/publish`,
      {
        method: 'POST',
      }
    );
    const summary = formatPublishNotificationSummary(data?.notifications);
    actionSuccess.value = summary
      ? `Назначения отправлены. ${summary}.`
      : 'Назначения отправлены.';
    await refreshMatchFromDate(selectedDateKey.value);
    initDraftsFromMatch();
  } catch (e) {
    actionError.value = e.message || 'Не удалось отправить назначения';
  } finally {
    publishing.value = false;
  }
}

async function createAssignmentsSheetDocument() {
  if (!canGenerateAssignmentsSheet.value) return;
  const hadSheet = Boolean(assignmentSheet.value?.id);
  generatingSheet.value = true;
  actionError.value = '';
  actionSuccess.value = '';
  try {
    const data = await apiFetch(
      `/referee-assignments/matches/${matchId.value}/assignment-sheet`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );
    const numberLabel = data?.document?.number
      ? `№ ${data.document.number}`
      : '';
    actionSuccess.value = hadSheet
      ? numberLabel
        ? `Лист назначений переформирован (${numberLabel}) и отправлен на подписание сотруднику федерации.`
        : 'Лист назначений переформирован и отправлен на подписание сотруднику федерации.'
      : numberLabel
        ? `Лист назначений сформирован (${numberLabel}) и отправлен на подписание сотруднику федерации.`
        : 'Лист назначений сформирован и отправлен на подписание сотруднику федерации.';
    await loadAssignmentsSheetStatus();
    if (data?.file?.url) {
      window.open(data.file.url, '_blank', 'noopener,noreferrer');
    }
  } catch (e) {
    actionError.value = e.message || 'Не удалось сформировать лист назначений';
  } finally {
    generatingSheet.value = false;
  }
}

async function loadPage() {
  loading.value = true;
  error.value = '';
  actionError.value = '';
  actionSuccess.value = '';
  try {
    await Promise.all([loadRoleGroups(), loadMatchCard()]);
    if (!matchCard.value) {
      throw new Error('Матч не найден');
    }
    if (matchCard.value.competition_type?.alias !== 'PRO') {
      throw new Error('Матч не относится к профессиональным соревнованиям');
    }
    const dateKey = toMoscowDateKey(matchCard.value.date_start);
    if (!dateKey) {
      throw new Error('У матча не задана дата в расписании');
    }
    selectedDateKey.value = dateKey;
    await Promise.all([
      refreshMatchFromDate(dateKey),
      loadRefereesByDate(dateKey),
      loadAssignmentsSheetStatus(),
    ]);
    initDraftsFromMatch();
  } catch (e) {
    error.value = e.message || 'Не удалось загрузить данные по матчу';
    matchRecord.value = null;
  } finally {
    loading.value = false;
  }
}

watch(
  () => route.params.id,
  () => {
    void loadPage();
  }
);

onMounted(() => {
  void loadPage();
});
</script>

<template>
  <div class="py-3 admin-pro-league-match-referees-page">
    <div class="container">
      <Breadcrumbs :items="breadcrumbs" />
      <h1 class="mb-3">{{ matchTitle }}</h1>

      <div v-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>

      <div v-else-if="loading" class="text-center py-3">
        <div
          class="spinner-border spinner-brand"
          role="status"
          aria-label="Загрузка"
        >
          <span class="visually-hidden">Загрузка…</span>
        </div>
      </div>

      <template v-else>
        <div class="card section-card tile fade-in shadow-sm mb-3">
          <div class="card-body">
            <div
              class="d-flex justify-content-between align-items-start flex-wrap gap-2"
            >
              <div class="kickoff-display m-0 lh-1">{{ kickoffHeader }}</div>
              <div class="d-flex align-items-center gap-2">
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-icon"
                  :disabled="
                    !canEdit || saving || publishing || !hasUnsavedChanges
                  "
                  aria-label="Сохранить черновик назначений"
                  title="Сохранить черновик"
                  @click="saveDraftAssignments"
                >
                  <span
                    v-if="saving"
                    class="spinner-border spinner-border-sm"
                    aria-hidden="true"
                  ></span>
                  <i v-else class="bi bi-floppy" aria-hidden="true"></i>
                </button>
                <button
                  type="button"
                  class="btn btn-primary btn-icon"
                  :disabled="!canPublish"
                  aria-label="Отправить назначения по матчу"
                  title="Отправить назначения"
                  @click="publishAssignments"
                >
                  <span
                    v-if="publishing"
                    class="spinner-border spinner-border-sm"
                    aria-hidden="true"
                  ></span>
                  <i v-else class="bi bi-send" aria-hidden="true"></i>
                </button>
              </div>
            </div>
            <div class="mt-2">
              <div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-2">
                <div v-if="matchCard?.season" class="col">
                  <InfoItem label="Сезон" :value="matchCard.season" />
                </div>
                <div v-if="matchCard?.tournament" class="col">
                  <InfoItem label="Турнир" :value="matchCard.tournament" />
                </div>
                <div v-if="matchCard?.stage" class="col">
                  <InfoItem label="Этап" :value="matchCard.stage" />
                </div>
                <div v-if="matchCard?.group" class="col">
                  <InfoItem label="Группа" :value="matchCard.group" />
                </div>
                <div v-if="matchCard?.tour" class="col">
                  <InfoItem label="Тур" :value="matchCard.tour" />
                </div>
              </div>
            </div>
            <div class="mt-2 small text-muted">
              Редактор судейской бригады для одного матча.
            </div>
          </div>
        </div>

        <div v-if="actionError" class="alert alert-danger" role="alert">
          {{ actionError }}
        </div>
        <div
          v-else-if="actionSuccess"
          class="alert alert-success"
          role="status"
          aria-live="polite"
        >
          {{ actionSuccess }}
        </div>

        <div class="card section-card tile fade-in shadow-sm mb-3">
          <div class="card-body">
            <div
              class="d-flex align-items-start justify-content-between gap-2 flex-wrap"
            >
              <div>
                <h2 class="h6 mb-1">Документы</h2>
                <div class="small text-muted">Лист назначений судей на матч</div>
              </div>
              <span class="badge" :class="assignmentSheetStatus.badgeClass">
                <span
                  v-if="loadingSheetStatus"
                  class="spinner-border spinner-border-sm me-1"
                  aria-hidden="true"
                ></span>
                {{ assignmentSheetStatus.label }}
              </span>
            </div>

            <div class="mt-2 small text-muted">
              <div v-if="assignmentSheet?.number">
                Номер: №{{ assignmentSheet.number }}
              </div>
              <div v-if="assignmentSheet?.documentDate">
                Дата: {{ formatSheetDate(assignmentSheet.documentDate) }}
              </div>
              <div class="mt-1">
                Подписать лист назначений может только сотрудник федерации.
              </div>
            </div>

            <div class="mt-3 d-flex align-items-center gap-2 flex-wrap">
              <button
                type="button"
                class="btn btn-outline-brand btn-sm d-inline-flex align-items-center gap-2"
                :disabled="!canGenerateAssignmentsSheet || generatingSheet"
                @click="createAssignmentsSheetDocument"
              >
                <span
                  v-if="generatingSheet"
                  class="spinner-border spinner-border-sm"
                  aria-hidden="true"
                ></span>
                <i
                  v-else
                  class="bi"
                  :class="assignmentSheet ? 'bi-arrow-repeat' : 'bi-file-earmark-plus'"
                  aria-hidden="true"
                ></i>
                {{ assignmentSheetActionLabel }}
              </button>

              <a
                v-if="assignmentSheet?.file?.url"
                class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2"
                :href="assignmentSheet.file.url"
                target="_blank"
                rel="noopener noreferrer"
              >
                <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i>
                Открыть документ
              </a>
            </div>
          </div>
        </div>

        <div
          v-if="!canEdit && matchRecord?.schedule_missing"
          class="alert alert-warning"
          role="alert"
        >
          У матча не указаны дата и время. Назначения недоступны.
        </div>
        <div
          v-else-if="!canEdit && matchRecord?.duration_missing"
          class="alert alert-warning"
          role="alert"
        >
          У группы матча не задана длительность. Назначения недоступны.
        </div>
        <div
          v-else-if="!roleColumns.length"
          class="alert alert-light"
          role="alert"
        >
          Для этого матча нет обязательных ролей судейской бригады.
        </div>

        <div v-if="canEdit" class="row g-3">
          <div class="col-12 col-xl-8">
            <div class="card section-card tile fade-in shadow-sm">
              <div class="card-body">
                <div
                  class="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-3"
                >
                  <h2 class="h5 mb-0">Доназначение руководства</h2>
                  <div class="d-flex align-items-center gap-2 small text-muted">
                    <span class="legend-pill select-draft">Черновик</span>
                    <span class="legend-pill select-published"
                      >Опубликовано</span
                    >
                    <span class="legend-pill select-confirmed"
                      >Подтверждено</span
                    >
                  </div>
                </div>

                <div class="assignment-section">
                  <h3 class="h6 mb-2">Руководство</h3>
                  <div
                    v-if="!leadershipRoleColumns.length"
                    class="small text-muted mb-3"
                  >
                    Для матча нет ролей руководства.
                  </div>
                  <div v-else class="row g-2 mb-3">
                    <div
                      v-for="role in leadershipRoleColumns"
                      :key="role.id"
                      class="col-12 col-lg-6"
                    >
                      <div class="role-card">
                        <div
                          class="d-flex align-items-center justify-content-between gap-2 mb-2"
                        >
                          <div class="role-title">{{ role.name }}</div>
                          <span class="badge bg-light text-dark"
                            >{{ role.count }} мест</span
                          >
                        </div>
                        <div class="d-grid gap-2">
                          <select
                            v-for="slotIndex in role.count"
                            :key="`${role.id}-${slotIndex}`"
                            :value="slotValue(role.id, slotIndex - 1)"
                            class="form-select form-select-sm referee-select"
                            :class="slotClass(role.id, slotIndex - 1)"
                            :disabled="saving || publishing"
                            @change="
                              setSlotValue(
                                role.id,
                                slotIndex - 1,
                                $event.target.value
                              )
                            "
                          >
                            <option value="">Свободно</option>
                            <option
                              v-for="refereeOption in matchOptions"
                              :key="refereeOption.id"
                              :value="refereeOption.id"
                            >
                              {{ refereeLabel(refereeOption) }}
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <hr />

                <div class="assignment-section">
                  <h3 class="h6 mb-2">Судьи в бригаде</h3>
                  <div
                    v-if="!brigadeRoleColumns.length"
                    class="small text-muted mb-3"
                  >
                    Для матча нет ролей судей в бригаде.
                  </div>
                  <div v-else class="row g-2">
                    <div
                      v-for="role in brigadeRoleColumns"
                      :key="role.id"
                      class="col-12 col-lg-6"
                    >
                      <div class="role-card">
                        <div
                          class="d-flex align-items-center justify-content-between gap-2 mb-2"
                        >
                          <div class="role-title">{{ role.name }}</div>
                          <span class="badge bg-light text-dark"
                            >{{ role.count }} мест</span
                          >
                        </div>
                        <div class="d-grid gap-2">
                          <select
                            v-for="slotIndex in role.count"
                            :key="`${role.id}-${slotIndex}`"
                            :value="slotValue(role.id, slotIndex - 1)"
                            class="form-select form-select-sm referee-select"
                            :class="slotClass(role.id, slotIndex - 1)"
                            :disabled="saving || publishing"
                            @change="
                              setSlotValue(
                                role.id,
                                slotIndex - 1,
                                $event.target.value
                              )
                            "
                          >
                            <option value="">Свободно</option>
                            <option
                              v-for="refereeOption in matchOptions"
                              :key="refereeOption.id"
                              :value="refereeOption.id"
                            >
                              {{ refereeLabel(refereeOption) }}
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="mt-3 d-flex align-items-center gap-2 flex-wrap">
                  <span
                    v-if="hasUnsavedChanges"
                    class="badge bg-warning-subtle text-warning-emphasis"
                  >
                    Есть несохраненные изменения
                  </span>
                  <span
                    v-else
                    class="badge bg-success-subtle text-success-emphasis"
                  >
                    Изменения сохранены
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="col-12 col-xl-4">
            <div class="card section-card tile fade-in shadow-sm h-100">
              <div class="card-body">
                <div
                  class="d-flex align-items-center justify-content-between gap-2 mb-2"
                >
                  <h2 class="h6 mb-0">Текущие назначения</h2>
                  <span class="badge bg-light text-dark">{{
                    currentAssignments.length
                  }}</span>
                </div>

                <div v-if="!currentAssignments.length" class="text-muted small">
                  Назначения отсутствуют.
                </div>
                <ul v-else class="list-unstyled current-list mb-0">
                  <li
                    v-for="assignment in currentAssignments"
                    :key="assignment.id"
                    class="current-item"
                  >
                    <div class="current-role">
                      {{ assignment.role?.name || 'Роль' }}
                    </div>
                    <div class="current-user">
                      {{ refereeLabel(assignment.user) }}
                    </div>
                    <span
                      class="badge status-badge"
                      :class="{
                        'bg-primary-subtle text-primary':
                          assignment.status === 'DRAFT',
                        'bg-warning-subtle text-warning':
                          assignment.status === 'PUBLISHED',
                        'bg-success-subtle text-success':
                          assignment.status === 'CONFIRMED',
                      }"
                    >
                      {{
                        assignment.status === 'DRAFT'
                          ? 'Черновик'
                          : assignment.status === 'PUBLISHED'
                            ? 'Опубликовано'
                            : assignment.status === 'CONFIRMED'
                              ? 'Подтверждено'
                              : assignment.status || '—'
                      }}
                    </span>
                  </li>
                </ul>

                <hr />

                <div
                  class="d-flex align-items-center justify-content-between gap-2 mb-2"
                >
                  <h3 class="h6 mb-0">Доступные судьи</h3>
                  <span class="badge bg-light text-dark">{{
                    matchOptions.length
                  }}</span>
                </div>
                <div v-if="loadingReferees" class="text-muted small">
                  Обновляем список судей...
                </div>
                <div v-else-if="!matchOptions.length" class="text-muted small">
                  Нет доступных судей.
                </div>
                <ul v-else class="list-unstyled referee-list mb-0">
                  <li
                    v-for="referee in matchOptions"
                    :key="referee.id"
                    class="referee-item"
                  >
                    {{ refereeLabel(referee) }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.kickoff-display {
  font-size: clamp(1rem, 2.2vw, 1.25rem);
  font-weight: 400;
}

.btn-icon {
  width: 2.25rem;
  height: 2.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.role-card {
  border: 1px solid var(--border-subtle);
  border-radius: 0.65rem;
  padding: 0.65rem;
  background: #fff;
}

.role-title {
  font-size: 0.88rem;
  font-weight: 600;
}

.referee-select.select-empty {
  background-color: #f3f4f6;
  border-color: #e2e8f0;
  color: #6b7280;
}

.referee-select.select-draft {
  background-color: #e7f0ff;
  border-color: #9ab7f5;
}

.referee-select.select-published {
  background-color: #fff7d6;
  border-color: #f5d57a;
}

.referee-select.select-confirmed {
  background-color: #e6f6ea;
  border-color: #7bd59a;
}

.legend-pill {
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 0.72rem;
  padding: 0.1rem 0.45rem;
}

.current-list,
.referee-list {
  display: grid;
  gap: 0.45rem;
}

.current-item,
.referee-item {
  border: 1px solid var(--border-subtle);
  border-radius: 0.55rem;
  padding: 0.45rem 0.55rem;
  background: #fff;
}

.current-role {
  font-size: 0.72rem;
  color: #6b7280;
}

.current-user {
  font-size: 0.84rem;
  font-weight: 600;
}

.status-badge {
  margin-top: 0.35rem;
}

@media (max-width: 575.98px) {
  .btn-icon {
    width: 2.5rem;
    height: 2.5rem;
  }
}
</style>
