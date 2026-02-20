<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { apiFetch } from '../api';

const roleGroups = ref([]);
const matches = ref([]);
const referees = ref([]);
const matchSearch = ref('');
const selectedGroups = ref([]);
const loadingMatches = ref(false);
const loadingReferees = ref(false);
const error = ref('');
const drafts = ref({});
const savingByMatch = ref({});
const saveErrors = ref({});
const publishingDay = ref(false);
const publishError = ref('');
const publishSuccess = ref('');
const loadingProgressCurrent = ref(0);
const loadingProgressTotal = ref(0);
const loadingProgressLabel = ref('');

const loadingProgressPercent = computed(() => {
  if (!loadingProgressTotal.value) return 0;
  const total = Math.max(1, loadingProgressTotal.value);
  return Math.round((loadingProgressCurrent.value / total) * 100);
});

const loadingProgressVisible = computed(() => loadingProgressTotal.value > 0);

const hasAnyMatches = computed(() => matches.value.length > 0);
const hasActiveMatchFilters = computed(
  () => String(matchSearch.value || '').trim().length > 0
);
const canAssignGroup = computed(() => selectedGroups.value.length > 0);
const selectedGroupIds = computed(
  () => new Set(selectedGroups.value.filter(Boolean))
);
const selectedRoleGroups = computed(() =>
  roleGroups.value.filter((g) => selectedGroupIds.value.has(g.id))
);

const roleGroupByRoleId = computed(() => {
  const map = new Map();
  roleGroups.value.forEach((group) => {
    (group.roles || []).forEach((role) => {
      if (role?.id) map.set(role.id, group.id);
    });
  });
  return map;
});

const roleIdByGroupId = computed(() => {
  const map = new Map();
  roleGroups.value.forEach((group) => {
    if (!group?.id || map.has(group.id)) return;
    const firstRole = (group.roles || []).find((role) => role?.id);
    if (firstRole?.id) map.set(group.id, firstRole.id);
  });
  return map;
});

const requirementsByMatch = computed(() => {
  const map = new Map();
  const activeGroups = selectedGroupIds.value;
  matches.value.forEach((match) => {
    const groupMap = new Map();
    if (activeGroups.size) {
      (match.referee_requirements || []).forEach((group) => {
        if (!activeGroups.has(group.id)) return;
        const roleMap = new Map();
        (group.roles || []).forEach((role) => {
          if (Number.isFinite(role.count) && role.count > 0) {
            roleMap.set(role.id, role.count);
          }
        });
        if (roleMap.size) groupMap.set(group.id, roleMap);
      });
    }
    map.set(match.id, groupMap);
  });
  return map;
});

const roleColumns = computed(() => {
  const groups = selectedRoleGroups.value;
  if (!groups.length) return [];
  const columns = [];
  groups.forEach((group) => {
    (group.roles || []).forEach((role) => {
      const used = filteredMatches.value.some(
        (match) => requiredCount(match, role.id) > 0
      );
      if (used) {
        columns.push({ id: role.id, name: role.name, group_id: group.id });
      }
    });
  });
  return columns;
});

const assignmentCountsByReferee = computed(() => {
  const rank = {
    DRAFT: 3,
    CONFIRMED: 2,
    PUBLISHED: 1,
  };
  const perUserMatch = new Map();
  const activeGroups = selectedGroupIds.value;
  matches.value.forEach((match) => {
    effectiveAssignments(match, activeGroups).forEach((assignment) => {
      if (activeGroups.size && !activeGroups.has(assignment.role?.group_id)) {
        return;
      }
      const userId = assignment.user?.id;
      const status = assignment.status;
      if (!userId || !rank[status]) return;
      if (!perUserMatch.has(userId)) {
        perUserMatch.set(userId, new Map());
      }
      const matchMap = perUserMatch.get(userId);
      const current = matchMap.get(match.id);
      if (!current || rank[status] > rank[current]) {
        matchMap.set(match.id, status);
      }
    });
  });
  const counts = new Map();
  for (const [userId, matchMap] of perUserMatch.entries()) {
    const entry = { draft: 0, published: 0, confirmed: 0, total: 0 };
    matchMap.forEach((status) => {
      if (status === 'CONFIRMED') entry.confirmed += 1;
      else if (status === 'PUBLISHED') entry.published += 1;
      else if (status === 'DRAFT') entry.draft += 1;
      entry.total += 1;
    });
    counts.set(userId, entry);
  }
  return counts;
});

const allowedRefereeRoles = computed(() => {
  return new Set(['BRIGADE_REFEREE']);
});

function normalizeAvailabilityStatus(availability) {
  return String(availability?.status || '')
    .trim()
    .toUpperCase();
}

function formatDayShort(dateKey) {
  if (!dateKey) return 'без даты';
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

function joinHumanList(items = []) {
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} и ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} и ${items[items.length - 1]}`;
}

function partialBusyLabel(availability) {
  const from = formatTimeShort(availability?.from_time);
  const to = formatTimeShort(availability?.to_time);
  const mode =
    availability?.partial_mode ||
    derivePartialMode(availability?.from_time, availability?.to_time);
  if (mode === 'BEFORE' && to) return `частично: занят после ${to}`;
  if (mode === 'AFTER' && from) return `частично: занят до ${from}`;
  if (mode === 'WINDOW' && from && to)
    return `частично: занят до ${from} и после ${to}`;
  if (mode === 'SPLIT' && from && to)
    return `частично: занят с ${to} до ${from}`;
  if (from && to) return `частично: занят до ${from} и после ${to}`;
  if (from) return `частично: занят до ${from}`;
  if (to) return `частично: занят после ${to}`;
  return 'частично занят';
}

function professionalAvailabilityLabel(referee, matchDateKeys = []) {
  if (!matchDateKeys.length) {
    return 'Свободен все дни';
  }
  const availabilityByDate = referee?.availability_by_date || {};
  const busyDays = [];
  let fullBusyDays = 0;

  matchDateKeys.forEach((dateKey) => {
    const availability =
      availabilityByDate?.[dateKey] || referee?.availability || null;
    const status = normalizeAvailabilityStatus(availability);
    const dayLabel = formatDayShort(dateKey);
    if (status === 'FREE') return;
    if (status === 'BUSY') {
      busyDays.push(dayLabel);
      fullBusyDays += 1;
      return;
    }
    if (status === 'PARTIAL') {
      busyDays.push(`${dayLabel} (${partialBusyLabel(availability)})`);
      return;
    }
    busyDays.push(`${dayLabel} (нет данных по занятости)`);
  });

  if (!busyDays.length) {
    return 'Свободен все дни';
  }
  if (fullBusyDays === matchDateKeys.length) {
    return 'Занят всегда';
  }
  return `Занят ${joinHumanList(busyDays)}`;
}

const availableReferees = computed(() => {
  const countsMap = assignmentCountsByReferee.value;
  const roleAliases = allowedRefereeRoles.value;
  const matchDateKeys = Array.from(
    new Set(
      matches.value
        .map((match) => String(match?.msk_date || '').trim())
        .filter(Boolean)
    )
  ).sort();

  return referees.value
    .filter((ref) => {
      if (!roleAliases.size) return true;
      const refRoles = new Set(ref.roles || []);
      return Array.from(roleAliases).some((alias) => refRoles.has(alias));
    })
    .map((ref) => ({
      ...ref,
      availabilityLabel: professionalAvailabilityLabel(ref, matchDateKeys),
      counts: countsMap.get(ref.id) || {
        draft: 0,
        published: 0,
        confirmed: 0,
        total: 0,
      },
    }))
    .sort((a, b) => {
      if (b.counts.total !== a.counts.total) {
        return b.counts.total - a.counts.total;
      }
      const lastA = a.last_name || '';
      const lastB = b.last_name || '';
      const lastCompare = lastA.localeCompare(lastB, 'ru', {
        sensitivity: 'base',
      });
      if (lastCompare !== 0) return lastCompare;
      const firstA = a.first_name || '';
      const firstB = b.first_name || '';
      return firstA.localeCompare(firstB, 'ru', { sensitivity: 'base' });
    });
});

const assignmentsGridStyle = computed(() => {
  const roleCount = roleColumns.value.length;
  const timeWidth = 54;
  const arenaWidth = 122;
  const matchWidth = 212;
  const roleWidth = 144;
  const template = [
    `minmax(${timeWidth}px, 0.4fr)`,
    `minmax(${arenaWidth}px, 0.9fr)`,
    `minmax(${matchWidth}px, 1.9fr)`,
    ...Array.from({ length: roleCount }, () => `minmax(${roleWidth}px, 1fr)`),
  ].join(' ');
  const minWidth = timeWidth + arenaWidth + matchWidth + roleCount * roleWidth;
  return {
    '--assign-grid': template,
    minWidth: `${minWidth}px`,
  };
});

const MONTH_LOOKAHEAD_DAYS = 30;
const MATCH_DAY_KEY_TODAY_LABEL = 'Без даты';

function toDayTimestamp(dateKey) {
  const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  return Date.UTC(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText),
    0,
    0,
    0,
    0
  );
}

function professionalMatchTo(match) {
  const dayTimestamp = toDayTimestamp(match?.msk_date);
  if (!dayTimestamp) {
    return `/admin/professional-leagues/matches/${match.id}`;
  }
  return {
    path: `/admin/professional-leagues/matches/${match.id}`,
    query: { day: String(dayTimestamp) },
  };
}

const dateWindowKeys = computed(() => {
  const start = todayKey();
  const keys = [];
  for (let offset = 0; offset <= MONTH_LOOKAHEAD_DAYS; offset += 1) {
    keys.push(shiftDateKey(start, offset));
  }
  return keys;
});

const dateWindowRange = computed(() => {
  const keys = dateWindowKeys.value;
  if (!keys.length) {
    return { from: '', to: '' };
  }
  return {
    from: keys[0],
    to: keys[keys.length - 1],
  };
});

const publicationDateKeys = computed(() => {
  const keys = new Set();
  matches.value.forEach((match) => {
    if (!isMatchAssignable(match)) return;
    const status = matchStatusForGroups(match);
    if (!status.hasDraft) return;
    const key = String(match?.msk_date || '').trim();
    if (key) keys.add(key);
  });
  return Array.from(keys).sort();
});

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .trim();
}

function buildMatchSearchIndex(match) {
  return normalizeSearchText(
    [
      match.match_number,
      match.team1?.name,
      match.team2?.name,
      match.tournament?.short_name,
      match.tournament?.name,
      match.tournament?.competition_type?.name,
      match.stage?.name,
      match.group?.name,
      match.tour?.name,
      match.ground?.name,
    ]
      .filter(Boolean)
      .join(' ')
  );
}

const filteredMatches = computed(() => {
  const term = normalizeSearchText(matchSearch.value);
  return matches.value.filter((match) =>
    term ? buildMatchSearchIndex(match).includes(term) : true
  );
});

const hasMatches = computed(() => filteredMatches.value.length > 0);

const groupedMatches = computed(() => {
  const list = [...filteredMatches.value];
  list.sort((a, b) => {
    const dateA = (a.msk_date || '9999-12-31').trim();
    const dateB = (b.msk_date || '9999-12-31').trim();
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const timeA =
      parseTimeSeconds(a.msk_start_time) ?? Number.POSITIVE_INFINITY;
    const timeB =
      parseTimeSeconds(b.msk_start_time) ?? Number.POSITIVE_INFINITY;
    if (timeA !== timeB) return timeA - timeB;
    const numA = Number.isFinite(a.match_number)
      ? a.match_number
      : Number.isFinite(a.external_id)
        ? a.external_id
        : Number.POSITIVE_INFINITY;
    const numB = Number.isFinite(b.match_number)
      ? b.match_number
      : Number.isFinite(b.external_id)
        ? b.external_id
        : Number.POSITIVE_INFINITY;
    if (numA !== numB) return numA - numB;
    return String(a.id).localeCompare(String(b.id));
  });
  const grouped = [];
  let current = null;
  list.forEach((match) => {
    const matchDate = (match.msk_date || 'Без даты').trim() || 'Без даты';
    if (!current || current.date !== matchDate) {
      current = {
        date: matchDate,
        dateLabel: matchDateLabel(matchDate),
        matches: [],
      };
      grouped.push(current);
    }
    current.matches.push(match);
  });
  return grouped;
});

function resetMatchFilters() {
  matchSearch.value = '';
}

const dayPublishState = computed(() => {
  if (!canAssignGroup.value) {
    return {
      disabled: true,
      message: 'Выберите группы амплуа',
      incomplete: 0,
      total: 0,
      hasDraft: false,
      daysToPublish: 0,
    };
  }
  const relevantMatches = matches.value.filter((match) =>
    isMatchAssignable(match)
  );
  if (!relevantMatches.length) {
    return {
      disabled: true,
      message: 'Нет матчей с требованиями',
      incomplete: 0,
      total: 0,
      hasDraft: false,
      daysToPublish: 0,
    };
  }
  let hasDraft = false;
  let incomplete = 0;
  relevantMatches.forEach((match) => {
    const status = matchStatusForGroups(match);
    if (status.hasDraft) hasDraft = true;
    if (!isDraftComplete(match)) incomplete += 1;
  });
  if (!hasDraft) {
    return {
      disabled: true,
      message: 'Нет черновиков для отправки',
      incomplete,
      total: relevantMatches.length,
      hasDraft,
      daysToPublish: 0,
    };
  }
  const daysToPublish = publicationDateKeys.value.length;
  if (!daysToPublish) {
    return {
      disabled: true,
      message: 'Нет измененных дней для отправки',
      incomplete,
      total: relevantMatches.length,
      hasDraft,
      daysToPublish: 0,
    };
  }
  if (incomplete > 0) {
    return {
      disabled: false,
      message: `К отправке ${daysToPublish} дн., есть незаполненные назначения: ${incomplete}`,
      incomplete,
      total: relevantMatches.length,
      hasDraft,
      daysToPublish,
    };
  }
  return {
    disabled: false,
    message: `К отправке ${daysToPublish} дн.`,
    incomplete,
    total: relevantMatches.length,
    hasDraft,
    daysToPublish,
  };
});

function resetMatchFlags(match) {
  match.has_draft = (match.assignments || []).some((a) => a.status === 'DRAFT');
  match.has_published = (match.assignments || []).some(
    (a) => a.status === 'PUBLISHED'
  );
}

function todayKey() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function shiftDateKey(baseDateKey, offset) {
  const parts = String(baseDateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return '';
  const [, yearText, monthText, dayText] = parts;
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const day = Number(dayText);
  const base = Date.UTC(year, monthIndex, day);
  return new Date(base + offset * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function matchDateLabel(dateValue) {
  if (!dateValue || dateValue === MATCH_DAY_KEY_TODAY_LABEL) {
    return MATCH_DAY_KEY_TODAY_LABEL;
  }
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }
  const dateString = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
  const today = todayKey();
  if (dateValue === today) {
    return `Сегодня, ${dateString}`;
  }
  const tomorrow = shiftDateKey(today, 1);
  if (dateValue === tomorrow) {
    return `Завтра, ${dateString}`;
  }
  return dateString;
}

function normalizeMatches(list = []) {
  return list.map((match) => {
    const normalized = {
      ...match,
      assignments: match.assignments || [],
      referee_requirements: match.referee_requirements || [],
      draft_clear_group_ids: match.draft_clear_group_ids || [],
    };
    resetMatchFlags(normalized);
    return normalized;
  });
}

function assignmentsForSelectedGroups(match) {
  const activeGroups = selectedGroupIds.value;
  if (!activeGroups.size) return [];
  return (match.assignments || []).filter((a) =>
    activeGroups.has(a.role?.group_id)
  );
}

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

function collectRoleAssignments(assignments = []) {
  const activeGroups = selectedGroupIds.value;
  const draftByRole = new Map();
  const publishedByRole = new Map();
  const groupIdByRole = new Map();
  if (!activeGroups.size) {
    return { draftByRole, publishedByRole, groupIdByRole };
  }
  assignments.forEach((assignment) => {
    const groupId = assignment.role?.group_id;
    if (!groupId || !activeGroups.has(groupId)) return;
    const roleId = assignment.role?.id;
    const userId = assignment.user?.id;
    if (!roleId || !userId) return;
    groupIdByRole.set(roleId, groupId);
    if (assignment.status === 'DRAFT') {
      if (!draftByRole.has(roleId)) draftByRole.set(roleId, []);
      draftByRole.get(roleId).push(assignment);
      return;
    }
    if (
      assignment.status === 'PUBLISHED' ||
      assignment.status === 'CONFIRMED'
    ) {
      if (!publishedByRole.has(roleId)) publishedByRole.set(roleId, []);
      publishedByRole.get(roleId).push(assignment);
    }
  });
  return { draftByRole, publishedByRole, groupIdByRole };
}

function buildRoleMapFromAssignments(assignments = []) {
  const { draftByRole, publishedByRole } = collectRoleAssignments(assignments);
  const roleMap = {};
  const roleIds = new Set([...draftByRole.keys(), ...publishedByRole.keys()]);
  roleIds.forEach((roleId) => {
    const source = draftByRole.has(roleId) ? draftByRole : publishedByRole;
    const list = source.get(roleId) || [];
    roleMap[roleId] = list
      .map((assignment) => assignment.user?.id)
      .filter(Boolean);
  });
  return roleMap;
}

function effectiveAssignments(match, groupIds = null) {
  const assignments = match?.assignments || [];
  const clearGroups = new Set(match?.draft_clear_group_ids || []);
  const { byGroup, ungrouped } = splitAssignmentsByGroup(assignments);
  const result = groupIds ? [] : [...ungrouped];
  const groupIdSet = groupIds ? new Set(groupIds) : null;
  const groupsToCheck = groupIdSet
    ? Array.from(groupIdSet.values())
    : Array.from(byGroup.keys());
  groupsToCheck.forEach((groupId) => {
    const bucket = byGroup.get(groupId);
    if (!bucket) return;
    const useDraft = clearGroups.has(groupId) || bucket.drafts.length > 0;
    const source = useDraft ? bucket.drafts : bucket.published;
    result.push(...source);
  });
  return result;
}

function matchStatusForGroups(match) {
  const list = assignmentsForSelectedGroups(match);
  const clearGroups = new Set(match.draft_clear_group_ids || []);
  const hasClear = Array.from(selectedGroupIds.value).some((groupId) =>
    clearGroups.has(groupId)
  );
  return {
    hasDraft: list.some((a) => a.status === 'DRAFT') || hasClear,
    hasPublished: list.some((a) => a.status === 'PUBLISHED'),
    hasConfirmed: list.some((a) => a.status === 'CONFIRMED'),
  };
}

function initDrafts(list = []) {
  const next = {};
  list.forEach((match) => {
    const roleMap = buildRoleMapFromAssignments(match.assignments || []);
    applyClearMarkers(match, roleMap);
    next[match.id] = roleMap;
  });
  drafts.value = next;
}

function setSaving(matchId, val) {
  savingByMatch.value = { ...savingByMatch.value, [matchId]: val };
}

function setSaveError(matchId, message) {
  saveErrors.value = { ...saveErrors.value, [matchId]: message };
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

function formatTimeShort(value) {
  if (!value) return '';
  const parts = String(value).trim().split(':');
  if (parts.length < 2) return value;
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
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
  if (endSeconds > 24 * 3600) return false;
  const availabilityStatus = normalizeAvailabilityStatus(availability);
  if (!availability || availabilityStatus === 'FREE') return true;
  if (availabilityStatus === 'BUSY') return false;
  if (availabilityStatus !== 'PARTIAL') return false;

  const from = parseTimeSeconds(availability.from_time);
  const to = parseTimeSeconds(availability.to_time);
  const mode = derivePartialMode(availability.from_time, availability.to_time);
  if (from === null && to === null) return true;

  if (mode === 'BEFORE') return to !== null && endSeconds <= to;
  if (mode === 'AFTER') return from !== null && startSeconds >= from;
  if (mode === 'WINDOW')
    return (
      from !== null && to !== null && startSeconds >= from && endSeconds <= to
    );
  if (mode === 'SPLIT')
    return (
      from !== null && to !== null && (endSeconds <= to || startSeconds >= from)
    );

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
  if (!match?.msk_start_time || !match?.msk_end_time) return null;
  const start = parseTimeSeconds(match.msk_start_time);
  const end = parseTimeSeconds(match.msk_end_time);
  if (start === null || end === null) return null;
  return { start, end };
}

const assignmentWindowsByUser = computed(() => {
  const map = new Map();
  matches.value.forEach((match) => {
    const window = matchTimeWindow(match);
    const dateKey = String(match?.msk_date || '').trim();
    if (!dateKey) return;
    if (!window) return;
    effectiveAssignments(match).forEach((a) => {
      const userId = a.user?.id;
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

function hasConflict(userId, matchId, dateKey, startSeconds, endSeconds) {
  const windows = assignmentWindowsByUser.value.get(userId) || [];
  return windows.some(
    (w) =>
      w.dateKey === dateKey &&
      w.matchId !== matchId &&
      intervalOverlaps(startSeconds, endSeconds, w.start, w.end)
  );
}

function resolveRefereeMatchAvailability(
  referee,
  match,
  { ignoreAvailability = false } = {}
) {
  if (!referee) return { available: false, reason: 'судья не найден' };
  if (!match) return { available: false, reason: 'матч не найден' };
  if (match.schedule_missing || match.duration_missing) {
    return { available: false, reason: 'не хватает времени матча' };
  }
  if (ignoreAvailability) {
    return { available: true, reason: '' };
  }
  const dateKey = match?.msk_date || '';
  const availabilityByDate = referee?.availability_by_date || null;
  const availability =
    dateKey && availabilityByDate?.[dateKey]
      ? availabilityByDate[dateKey]
      : referee.availability;
  if (!availability)
    return { available: false, reason: 'не указана занятость' };
  const availabilityStatus = normalizeAvailabilityStatus(availability);
  if (availabilityStatus !== 'FREE' && availabilityStatus !== 'PARTIAL') {
    return {
      available: false,
      reason:
        availabilityStatus === 'BUSY'
          ? 'занят'
          : `неизвестный статус занятости: ${availability.status}`,
    };
  }
  const window = matchTimeWindow(match);
  if (!window) return { available: false, reason: 'не указано время матча' };
  if (hasConflict(referee.id, match.id, dateKey, window.start, window.end)) {
    return { available: false, reason: 'занят другим матчем' };
  }
  if (!availabilityAllowsInterval(availability, window.start, window.end)) {
    return { available: false, reason: 'не попадает в окно занятости' };
  }
  return { available: true, reason: '' };
}

function isRefereeAvailable(referee, match, roleId = null) {
  return resolveRefereeMatchAvailability(referee, match, {
    ignoreAvailability: isLeadershipRoleId(roleId),
  }).available;
}

function refereeLabel(referee, match, roleId = null) {
  const last = referee?.last_name || '';
  const first = referee?.first_name || '';
  const patronymic = referee?.patronymic || '';
  const initials = [first, patronymic]
    .filter(Boolean)
    .map((part) => `${part.charAt(0)}.`)
    .join(' ');
  const base = [last, initials].filter(Boolean).join(' ').trim();
  if (!match) return base;
  const availability = resolveRefereeMatchAvailability(referee, match, {
    ignoreAvailability: isLeadershipRoleId(roleId),
  });
  if (availability.available) return base;
  return `${base} · недоступен (${availability.reason})`;
}

function currentRoleSelections(matchId, roleId) {
  const roleMap = drafts.value[matchId] || {};
  const list = roleMap[roleId] || [];
  return Array.isArray(list) ? list : [];
}

function slotValue(matchId, roleId, index) {
  const list = currentRoleSelections(matchId, roleId);
  return list[index] || '';
}

function assignmentStatus(match, roleId, userId) {
  if (!match || !roleId || !userId) return null;
  const assignments = match.assignments || [];
  const byRoleUser = assignments.filter(
    (a) => a.role?.id === roleId && a.user?.id === userId
  );
  if (!byRoleUser.length) return null;
  const priority = ['CONFIRMED', 'PUBLISHED', 'DRAFT'];
  for (const alias of priority) {
    if (byRoleUser.some((a) => a.status === alias)) return alias;
  }
  return byRoleUser[0]?.status || null;
}

function slotClass(match, roleId, index) {
  if (!match || !roleId) return '';
  if (isAssignmentDisabled(match)) return '';
  const userId = slotValue(match.id, roleId, index);
  if (!userId) return 'select-empty';
  const status = assignmentStatus(match, roleId, userId);
  if (status === 'CONFIRMED') return 'select-confirmed';
  if (status === 'PUBLISHED') return 'select-published';
  return 'select-draft';
}

function applyClearMarkers(match, roleMap) {
  if (!match || !roleMap) return;
  const clearGroups = new Set(match.draft_clear_group_ids || []);
  if (!clearGroups.size) return;
  selectedRoleGroups.value.forEach((group) => {
    if (!clearGroups.has(group.id)) return;
    (group.roles || []).forEach((role) => {
      roleMap[role.id] = [];
    });
  });
}

function reservedUserIds(match) {
  const activeGroups = selectedGroupIds.value;
  if (!activeGroups.size) return new Set();
  return new Set(
    effectiveAssignments(match)
      .filter(
        (assignment) =>
          assignment.role?.group_id &&
          !activeGroups.has(assignment.role.group_id)
      )
      .map((assignment) => assignment.user?.id)
      .filter(Boolean)
  );
}

function arraysEqual(left = [], right = []) {
  if (left.length !== right.length) return false;
  return left.every((value, idx) => value === right[idx]);
}

function setSlotValue(match, roleId, index, value) {
  if (!match || !roleId) return;
  if (!canAssignGroup.value) return;
  const normalized = value || '';
  if (normalized && reservedUserIds(match).has(normalized)) return;
  const matchId = match.id;
  const roleMap = { ...(drafts.value[matchId] || {}) };
  const list = [...(roleMap[roleId] || [])];
  while (list.length <= index) list.push('');
  list[index] = normalized;
  roleMap[roleId] = list;
  const updatedRoleIds = new Set([roleId]);
  if (normalized) {
    Object.keys(roleMap).forEach((key) => {
      const current = key === roleId ? list : roleMap[key] || [];
      const nextList = current.map((item, idx) => {
        if (key === roleId && idx === index) return normalized;
        return item === normalized ? '' : item;
      });
      if (!arraysEqual(current, nextList)) {
        updatedRoleIds.add(key);
      }
      roleMap[key] = nextList;
    });
  }
  drafts.value = { ...drafts.value, [matchId]: roleMap };
  const primaryGroupId = roleGroupIdForRole(roleId);
  const extraGroupIds = new Set();
  updatedRoleIds.forEach((changedRoleId) => {
    const groupId = roleGroupIdForRole(changedRoleId);
    if (groupId && groupId !== primaryGroupId) {
      extraGroupIds.add(groupId);
    }
  });
  const groupsToSave = [
    ...extraGroupIds.values(),
    ...(primaryGroupId ? [primaryGroupId] : []),
  ];
  if (!groupsToSave.length) return;
  (async () => {
    for (const groupId of groupsToSave) {
      const saveRoleId = roleIdByGroupId.value.get(groupId);
      if (!saveRoleId) continue;
      await saveMatchAssignments(match, saveRoleId);
    }
  })();
}

function requiredCount(match, roleId) {
  const groupMap = requirementsByMatch.value.get(match.id);
  if (!groupMap || !groupMap.size) return 0;
  for (const roleMap of groupMap.values()) {
    if (roleMap.has(roleId)) return roleMap.get(roleId) || 0;
  }
  return 0;
}

function allowedRolesForGroup(matchId, groupId) {
  const groupMap = requirementsByMatch.value.get(matchId);
  return groupMap?.get(groupId) || new Map();
}

function buildAssignmentsPayload(matchId, groupId) {
  if (!groupId) return [];
  const roleMap = drafts.value[matchId] || {};
  const allowedRoles = allowedRolesForGroup(matchId, groupId);
  const allowedIds = new Set(allowedRoles.keys());
  const payload = [];
  Object.entries(roleMap).forEach(([roleId, users]) => {
    if (!allowedIds.has(roleId)) return;
    (users || []).forEach((userId) => {
      if (!userId) return;
      payload.push({ role_id: roleId, user_id: userId });
    });
  });
  return payload;
}

function applyAssignmentsToDrafts(matchId, assignments) {
  const roleMap = buildRoleMapFromAssignments(assignments || []);
  const match = matches.value.find((item) => item.id === matchId);
  if (match) {
    applyClearMarkers(match, roleMap);
  }
  drafts.value = { ...drafts.value, [matchId]: roleMap };
}

function roleGroupIdForRole(roleId) {
  return roleGroupByRoleId.value.get(roleId) || null;
}

function isLeadershipRoleId(roleId) {
  if (!roleId) return false;
  const groupId = roleGroupIdForRole(roleId);
  if (!groupId) return false;
  const group = roleGroups.value.find((entry) => entry.id === groupId);
  const name = String(group?.name || '')
    .trim()
    .toLowerCase();
  return /руковод/.test(name);
}

async function saveMatchAssignments(match, roleId) {
  if (!match || !canAssignGroup.value) return;
  if (match.schedule_missing || match.duration_missing) return;
  const groupId = roleGroupIdForRole(roleId);
  if (!groupId) return;
  setSaving(match.id, true);
  setSaveError(match.id, '');
  try {
    const payload = buildAssignmentsPayload(match.id, groupId);
    const data = await apiFetch(
      `/referee-assignments/matches/${match.id}/referees`,
      {
        method: 'PUT',
        body: JSON.stringify({
          assignments: payload,
          role_group_id: groupId,
          clear_published: payload.length === 0,
        }),
      }
    );
    match.assignments = data.assignments || [];
    match.draft_clear_group_ids = data.draft_clear_group_ids || [];
    resetMatchFlags(match);
    applyAssignmentsToDrafts(match.id, match.assignments);
  } catch (e) {
    setSaveError(match.id, e.message || 'Ошибка сохранения');
  } finally {
    setSaving(match.id, false);
  }
}

function formatPublishNotificationSummary(stats) {
  if (!stats) return '';
  if (stats.error) return 'Отправка уведомлений завершилась ошибкой';
  const parts = [];
  if (Number.isFinite(stats.queued) && stats.queued > 0) {
    parts.push(`отправлено: ${stats.queued}`);
  }
  if (Number.isFinite(stats.published) || Number.isFinite(stats.cancelled)) {
    const published = Number.isFinite(stats.published) ? stats.published : 0;
    const cancelled = Number.isFinite(stats.cancelled) ? stats.cancelled : 0;
    if (published || cancelled) {
      parts.push(`новые: ${published}, отмены: ${cancelled}`);
    }
  }
  if (Number.isFinite(stats.skipped_no_email) && stats.skipped_no_email > 0) {
    parts.push(`без email: ${stats.skipped_no_email}`);
  }
  if (Number.isFinite(stats.failed) && stats.failed > 0) {
    parts.push(`ошибки: ${stats.failed}`);
  }
  if (!parts.length) return 'Уведомления не требуются';
  return `Уведомления: ${parts.join(', ')}`;
}

async function publishDay() {
  if (!canAssignGroup.value) return;
  if (dayPublishState.value.disabled) return;
  publishError.value = '';
  publishSuccess.value = '';
  publishingDay.value = true;
  const aggregate = {
    queued: 0,
    published: 0,
    cancelled: 0,
    skipped_no_email: 0,
    failed: 0,
    recipients: 0,
  };
  const dateKeys = publicationDateKeys.value;
  try {
    for (const dateKey of dateKeys) {
      const data = await apiFetch('/referee-assignments/publish', {
        method: 'POST',
        body: JSON.stringify({
          date: dateKey,
          role_group_ids: selectedGroups.value,
        }),
      });
      const stats = data?.notifications;
      if (stats) {
        aggregate.queued += Number(stats.queued) || 0;
        aggregate.published += Number(stats.published) || 0;
        aggregate.cancelled += Number(stats.cancelled) || 0;
        aggregate.skipped_no_email += Number(stats.skipped_no_email) || 0;
        aggregate.failed += Number(stats.failed) || 0;
      }
      if (stats?.recipients)
        aggregate.recipients += Number(stats.recipients) || 0;
    }
    const summary = formatPublishNotificationSummary(aggregate);
    publishSuccess.value = summary
      ? `Назначения опубликованы. ${summary}.`
      : 'Назначения опубликованы.';
    await loadMatches();
  } catch (e) {
    publishError.value = e.message || 'Ошибка публикации';
  } finally {
    publishingDay.value = false;
  }
}

function isMatchAssignable(match) {
  if (!canAssignGroup.value) return false;
  if (!match) return false;
  if (match.schedule_missing || match.duration_missing) return false;
  const groupMap = requirementsByMatch.value.get(match.id);
  return !!(groupMap && groupMap.size);
}

function isAssignmentDisabled(match) {
  return !isMatchAssignable(match);
}

function isDraftComplete(match) {
  if (!match) return false;
  const groupMap = requirementsByMatch.value.get(match.id);
  if (!groupMap || !groupMap.size) return true;
  const selected = drafts.value[match.id] || {};
  for (const roleMap of groupMap.values()) {
    for (const [roleId, count] of roleMap.entries()) {
      const actual = (selected[roleId] || []).filter(Boolean).length;
      if (actual !== count) return false;
    }
  }
  return true;
}

function matchOptions(match, roleId = null) {
  const reserved = reservedUserIds(match);
  const roleAliases = allowedRefereeRoles.value;
  const base = referees.value.filter(
    (ref) =>
      !reserved.has(ref.id) &&
      (!roleAliases.size ||
        (ref.roles || []).some((alias) => roleAliases.has(alias))) &&
      isRefereeAvailable(ref, match, roleId)
  );
  const byId = new Map(referees.value.map((ref) => [ref.id, ref]));
  const selectedIds = new Set();
  const roleMap = drafts.value[match.id] || {};
  Object.values(roleMap).forEach((users) => {
    (users || []).forEach((id) => {
      if (id) selectedIds.add(id);
    });
  });
  const extras = [];
  selectedIds.forEach((id) => {
    if (base.some((b) => b.id === id)) return;
    const known = byId.get(id);
    if (known) {
      extras.push(known);
      return;
    }
    const assigned = (match.assignments || []).find((a) => a.user?.id === id);
    if (!assigned?.user) return;
    extras.push({
      id: assigned.user.id,
      last_name: assigned.user.last_name,
      first_name: assigned.user.first_name,
      patronymic: assigned.user.patronymic,
      roles: [],
      availability: { status: 'FREE' },
    });
  });
  return [...base, ...extras];
}

async function loadGroups() {
  try {
    const data = await apiFetch('/referee-assignments/role-groups');
    roleGroups.value = data.groups || [];
    selectedGroups.value = roleGroups.value
      .filter(isBrigadeRoleGroup)
      .map((group) => group.id);
    if (matches.value.length) {
      initDrafts(matches.value);
    }
  } catch (_) {
    roleGroups.value = [];
    selectedGroups.value = [];
  }
}

function isBrigadeRoleGroup(group) {
  const name = String(group?.name || '').toLowerCase();
  return name.includes('бригад');
}

function leadershipRoleGroupId() {
  const group = roleGroups.value.find((entry) =>
    /руковод/.test(
      String(entry?.name || '')
        .trim()
        .toLowerCase()
    )
  );
  return group?.id || '';
}

async function loadMatches() {
  loadingMatches.value = true;
  error.value = '';
  try {
    const { from, to } = dateWindowRange.value;
    if (!from || !to) {
      matches.value = [];
      return;
    }
    const params = new URLSearchParams({
      from,
      to,
      competition_alias: 'PRO',
    });
    const data = await apiFetch(`/referee-assignments/matches?${params}`);
    matches.value = normalizeMatches(data.matches || []);
    initDrafts(matches.value);
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки матчей';
    matches.value = [];
  } finally {
    loadingMatches.value = false;
  }
}

async function loadReferees() {
  loadingReferees.value = true;
  try {
    const { from, to } = dateWindowRange.value;
    if (!from || !to) {
      referees.value = [];
      return;
    }
    const params = new URLSearchParams({
      from,
      to,
      limit: '0',
      role_alias: 'BRIGADE_REFEREE',
      competition_alias: 'PRO',
      only_leagues_access: '1',
    });
    const leadershipGroupId = leadershipRoleGroupId();
    if (leadershipGroupId) {
      params.set('role_group_id', leadershipGroupId);
    }
    const data = await apiFetch(`/referee-assignments/referees?${params}`);
    referees.value = data.referees || [];
  } catch (_) {
    referees.value = [];
  } finally {
    loadingReferees.value = false;
  }
}

function setLoadProgressStep(step, total, label) {
  loadingProgressTotal.value = total;
  loadingProgressCurrent.value = Math.min(step, total);
  loadingProgressLabel.value = label;
}

async function loadProfessionalLeagueAssignments() {
  loadingProgressTotal.value = 2;
  loadingProgressCurrent.value = 0;
  loadingProgressLabel.value = 'Инициализация загрузки';
  error.value = '';
  try {
    setLoadProgressStep(1, 2, 'Загрузка матчей...');
    await loadMatches();
    setLoadProgressStep(2, 2, 'Загрузка судей...');
    await loadReferees();
  } finally {
    loadingProgressTotal.value = 0;
    loadingProgressCurrent.value = 0;
    loadingProgressLabel.value = '';
  }
}

watch(
  selectedGroups,
  () => {
    initDrafts(matches.value);
    publishError.value = '';
    publishSuccess.value = '';
  },
  { deep: true }
);

onMounted(() => {
  loadGroups();
  loadProfessionalLeagueAssignments();
});
</script>

<template>
  <div class="py-3 admin-referee-assignments">
    <div class="container-fluid px-4">
      <h1 class="mb-3">Назначение судей</h1>

      <div class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body">
          <div class="row g-3 align-items-end">
            <div class="col-12 col-lg-6">
              <label class="form-label">Поиск по матчу</label>
              <div class="input-group">
                <span class="input-group-text" aria-hidden="true">
                  <i class="bi bi-search"></i>
                </span>
                <input
                  v-model="matchSearch"
                  type="search"
                  class="form-control"
                  placeholder="Команды, турнир, этап, группа, арена, номер матча"
                  aria-label="Поиск по матчу"
                />
              </div>
            </div>
            <div class="col-12 col-lg-2 d-grid">
              <button
                type="button"
                class="btn btn-outline-secondary"
                :disabled="!hasActiveMatchFilters"
                @click="resetMatchFilters"
              >
                Сбросить фильтры
              </button>
            </div>
          </div>
          <div class="d-flex flex-wrap gap-2 mt-3 align-items-center">
            <span
              v-if="loadingProgressVisible"
              class="badge bg-primary-subtle text-primary"
            >
              Загрузка {{ loadingProgressCurrent }} из
              {{ loadingProgressTotal }}
            </span>
            <span
              v-if="loadingMatches || loadingReferees"
              class="badge bg-secondary-subtle text-secondary"
            >
              Загрузка данных...
            </span>
          </div>
          <div
            v-if="loadingProgressVisible"
            class="progress mt-2"
            role="progressbar"
            :aria-valuenow="loadingProgressPercent"
            aria-valuemin="0"
            :aria-valuemax="loadingProgressTotal"
          >
            <div
              class="progress-bar progress-bar-striped progress-bar-animated bg-brand"
              :style="{ width: `${loadingProgressPercent}%` }"
            >
              {{ loadingProgressLabel }}
            </div>
          </div>
          <div v-if="loadingProgressLabel" class="small text-muted mt-1">
            {{ loadingProgressLabel }}
          </div>
          <div
            class="d-flex flex-wrap gap-2 mt-3 align-items-center justify-content-between"
          >
            <div v-if="dayPublishState.message" class="text-muted small">
              {{ dayPublishState.message }}
            </div>
            <div class="d-flex flex-wrap gap-2 align-items-center">
              <span v-if="publishError" class="text-danger small">
                {{ publishError }}
              </span>
              <span v-else-if="publishSuccess" class="text-success small">
                {{ publishSuccess }}
              </span>
              <button
                class="btn btn-primary"
                type="button"
                :disabled="dayPublishState.disabled || publishingDay"
                @click="publishDay"
              >
                <span
                  v-if="publishingDay"
                  class="spinner-border spinner-border-sm me-2"
                ></span>
                Отправить назначения
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>

      <div v-if="loadingMatches" class="text-center my-4">
        <div class="spinner-border" role="status"></div>
      </div>

      <div v-else-if="!hasAnyMatches" class="alert alert-light" role="alert">
        На ближайшие 30 дней для профессиональных лиг матчи не найдены.
      </div>
      <div
        v-else-if="hasActiveMatchFilters && !hasMatches"
        class="alert alert-light d-flex flex-wrap justify-content-between align-items-center gap-2"
        role="alert"
      >
        <span>По заданным фильтрам матчи не найдены.</span>
        <button
          type="button"
          class="btn btn-outline-secondary btn-sm"
          @click="resetMatchFilters"
        >
          Сбросить фильтры
        </button>
      </div>

      <div
        v-else-if="!selectedRoleGroups.length"
        class="alert alert-light"
        role="alert"
      >
        Группы «Судьи в бригаде» не найдены.
      </div>

      <div
        v-else-if="!roleColumns.length"
        class="alert alert-secondary"
        role="alert"
      >
        Для групп «Судьи в бригаде» нет ролей с назначениями.
      </div>

      <div v-else class="assignments-layout">
        <div
          class="card section-card tile fade-in shadow-sm assignments-table-card"
        >
          <div class="card-body p-0">
            <div class="table-responsive assignments-table-wrap">
              <div
                class="assignments-grid"
                :style="assignmentsGridStyle"
                role="table"
                aria-label="Назначения судей"
              >
                <div class="grid-header" role="row">
                  <div class="cell col-time" role="columnheader">Время</div>
                  <div class="cell col-arena" role="columnheader">Арена</div>
                  <div class="cell col-match" role="columnheader">Матч</div>
                  <div
                    v-for="role in roleColumns"
                    :key="role.id"
                    class="cell col-role"
                    role="columnheader"
                  >
                    {{ role.name }}
                  </div>
                </div>
                <template
                  v-for="dayGroup in groupedMatches"
                  :key="dayGroup.date"
                >
                  <div class="grid-group-header" role="row">
                    <div class="cell group-cell" role="cell">
                      {{ dayGroup.dateLabel }}
                    </div>
                  </div>
                  <div
                    v-for="match in dayGroup.matches"
                    :key="match.id"
                    class="grid-row-wrapper"
                    role="row"
                    :class="{ 'row-muted': isAssignmentDisabled(match) }"
                  >
                    <div class="grid-row" role="presentation">
                      <div class="cell col-time" role="cell">
                        <div class="time-range">
                          {{ match.msk_start_time || '—' }}
                        </div>
                      </div>
                      <div class="cell col-arena" role="cell">
                        <div class="arena-name">
                          {{ match.ground?.name || 'Площадка не указана' }}
                        </div>
                      </div>
                      <div class="cell col-match" role="cell">
                        <div class="match-teams">
                          <router-link
                            class="fw-semibold match-link"
                            :to="professionalMatchTo(match)"
                            :aria-label="`Открыть матч: ${match.team1?.name || '—'} — ${match.team2?.name || '—'}`"
                          >
                            {{ match.team1?.name || '—' }} —
                            {{ match.team2?.name || '—' }}
                            <i
                              class="bi bi-box-arrow-up-right ms-1"
                              aria-hidden="true"
                            ></i>
                          </router-link>
                        </div>
                        <div class="match-sub text-muted">
                          <span>
                            {{
                              match.tournament?.short_name ||
                              match.tournament?.name ||
                              'Без турнира'
                            }}
                          </span>
                          <span v-if="match.group">
                            · {{ match.group.name }}
                          </span>
                        </div>
                        <div class="match-warnings">
                          <div
                            v-if="match.schedule_missing"
                            class="text-warning small"
                          >
                            У матча не указана дата и время.
                          </div>
                          <div
                            v-else-if="
                              isAssignmentDisabled(match) &&
                              !match.duration_missing
                            "
                            class="text-muted small"
                          >
                            Нет требований по выбранным группам.
                          </div>
                        </div>
                        <div class="text-muted small mt-1">
                          <span v-if="savingByMatch[match.id]">
                            Сохранение назначений...
                          </span>
                          <span
                            v-else-if="saveErrors[match.id]"
                            class="text-danger"
                          >
                            {{ saveErrors[match.id] }}
                          </span>
                        </div>
                      </div>
                      <div
                        v-for="role in roleColumns"
                        :key="role.id"
                        class="cell col-role"
                        role="cell"
                      >
                        <div
                          v-if="requiredCount(match, role.id) === 0"
                          class="role-empty"
                        >
                          —
                        </div>
                        <div v-else class="role-inputs">
                          <select
                            v-for="slotIndex in requiredCount(match, role.id)"
                            :key="slotIndex"
                            :class="[
                              'form-select',
                              'form-select-sm',
                              'referee-select',
                              slotClass(match, role.id, slotIndex - 1),
                            ]"
                            :disabled="isAssignmentDisabled(match)"
                            :value="slotValue(match.id, role.id, slotIndex - 1)"
                            @change="
                              setSlotValue(
                                match,
                                role.id,
                                slotIndex - 1,
                                $event.target.value
                              )
                            "
                          >
                            <option value="">Свободно</option>
                            <option
                              v-for="refereeOption in matchOptions(
                                match,
                                role.id
                              )"
                              :key="refereeOption.id"
                              :value="refereeOption.id"
                            >
                              {{ refereeLabel(refereeOption, match, role.id) }}
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <div class="card section-card tile fade-in shadow-sm referee-panel">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <h2 class="h6 mb-0">Список судей</h2>
              <span class="badge bg-light text-dark">
                {{ availableReferees.length }}
              </span>
            </div>
            <div v-if="loadingReferees" class="text-muted small">
              Обновляем доступность...
            </div>
            <div v-else-if="!availableReferees.length" class="text-muted small">
              Судьи в бригаде для профессиональных лиг не найдены.
            </div>
            <ul v-else class="list-unstyled referee-list">
              <li
                v-for="referee in availableReferees"
                :key="referee.id"
                class="referee-item"
              >
                <div class="referee-main">
                  <div class="referee-name">
                    <span class="referee-name-text">
                      {{ refereeLabel(referee) || 'Без имени' }}
                    </span>
                    <span class="count-pill count-total">
                      {{ referee.counts.total }} матчей
                    </span>
                  </div>
                  <div class="referee-availability">
                    {{ referee.availabilityLabel }}
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.assignments-table-wrap {
  padding: 0.75rem 1rem 1rem;
  overflow-x: auto;
}

.assignments-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 1rem;
  align-items: start;
}

.assignments-table-card {
  min-width: 0;
}

.referee-panel {
  position: static;
}

.referee-list {
  display: grid;
  gap: 0.65rem;
  margin: 0;
}

.referee-item {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  background: #fff;
}

.referee-name {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  font-size: 0.9rem;
  color: #111827;
  width: 100%;
}

.referee-name-text {
  min-width: 0;
  flex: 1 1 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.referee-availability {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.2rem;
}

.count-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  border: 1px solid transparent;
  margin-left: auto;
}

.count-total {
  background-color: #f8fafc;
  border-color: #e2e8f0;
  color: #1f2937;
}

.assignments-grid {
  display: flex;
  flex-direction: column;
  row-gap: 0.2rem;
  min-width: 100%;
}

.grid-header,
.grid-row-wrapper,
.grid-group-header {
  display: grid;
  grid-template-columns: var(--assign-grid);
  column-gap: 0.3rem;
}

.grid-header {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #fff;
}

.grid-group-header {
  display: grid;
  grid-template-columns: var(--assign-grid);
  margin-top: 0.35rem;
}

.group-cell {
  grid-column: 1 / -1;
  font-size: 0.78rem;
  font-weight: 600;
  color: #4b5563;
  background: #f5f7fb;
  border-radius: 0.35rem;
  border-bottom: 0;
  padding: 0.35rem 0.6rem;
}

.grid-row-wrapper {
  border-radius: 0.35rem;
  transition: background-color 0.15s ease;
}

.grid-row-wrapper:hover {
  background-color: rgba(25, 118, 210, 0.04);
}

.grid-row-wrapper:hover .cell {
  border-bottom-color: transparent;
}

.grid-row-wrapper:focus-within {
  outline: 2px solid var(--brand-color, #0057b8);
  outline-offset: 2px;
}

.grid-row {
  display: contents;
}

.cell {
  padding: 0.25rem 0.35rem;
  border-bottom: 1px solid #f0f2f4;
  white-space: normal;
}

.grid-header .cell {
  font-size: 0.875rem;
  color: #6c757d;
  font-weight: 600;
  background: linear-gradient(#fff, #fff);
}

.col-time,
.col-arena {
  display: flex;
  align-items: flex-start;
  min-height: 2rem;
}

.col-time {
  font-variant-numeric: tabular-nums;
  color: #111827;
  white-space: nowrap;
}

.time-range {
  font-weight: 600;
}

.col-arena {
  color: #374151;
  white-space: normal;
  line-height: 1.2;
  word-break: break-word;
  min-width: 0;
}

.arena-name {
  font-weight: 500;
  font-size: 0.82rem;
}

.col-match {
  min-width: 0;
}

.col-role {
  min-width: 0;
  text-align: left;
  padding-left: 0.2rem;
  padding-right: 0.2rem;
}

.match-teams {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.match-teams .fw-semibold {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.85rem;
}

.match-link {
  color: #111827;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.match-link:hover {
  color: var(--brand-color, #0057b8);
  text-decoration: underline;
}

.match-sub {
  margin-top: 0.15rem;
  font-size: 0.75rem;
}

.match-warnings {
  margin-top: 0.2rem;
  font-size: 0.75rem;
  line-height: 1.2;
}

.role-inputs {
  display: grid;
  gap: 0.18rem;
  justify-items: start;
  align-items: start;
}

.role-empty {
  display: flex;
  align-items: flex-start;
  height: 100%;
  color: #9ca3af;
}

.row-muted {
  opacity: 0.6;
}

.referee-select {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.82rem;
  padding-top: 0.18rem;
  padding-bottom: 0.18rem;
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

.referee-select:disabled {
  background-color: #f8f9fa;
  color: #9ca3af;
}

@media (max-width: 991.98px) {
  .assignments-table-wrap {
    max-height: none;
  }
  .assignments-layout {
    grid-template-columns: 1fr;
  }
  .referee-panel {
    position: static;
  }
  .assignments-grid {
    row-gap: 0.2rem;
  }
  .cell {
    padding: 0.3rem 0.35rem;
  }
  .referee-select {
    font-size: 0.8rem;
  }
}
</style>
