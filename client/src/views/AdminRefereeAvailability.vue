<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import Modal from 'bootstrap/js/dist/modal';

import { apiFetch } from '../api';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import AdminRefereeAvailabilityGrid from '../components/AdminRefereeAvailabilityGrid.vue';
import RefereeAvailabilityFiltersModal from '../components/RefereeAvailabilityFiltersModal.vue';
import RefereeAvailabilityEditorModal from '../components/RefereeAvailabilityEditorModal.vue';
import useRefereeAvailabilityFilters from '../composables/useRefereeAvailabilityFilters';

const loading = ref(true);
const hasLoadedOnce = ref(false);
const error = ref('');
const availableDates = ref([]);
const dates = ref([]);
const users = ref([]);
const search = ref('');
const page = ref(1);
const pageSize = ref(25);
const serverMeta = ref({ total: 0, page: 1, pages: 1, limit: 25 });

const roleOptions = [
  { value: 'REFEREE', label: 'Судья в поле' },
  { value: 'BRIGADE_REFEREE', label: 'Судья в бригаде' },
];

let filtersModal = null;
let editorModal = null;
let gridSearchTimer;
let editorSearchTimer;
let gridLoadAbortController = null;
let gridLoadRequestId = 0;
let editorLookupAbortController = null;
let editorDetailAbortController = null;

// Admin edit modal state
const editorUserQuery = ref('');
const editorSuggestions = ref([]);
const editorLookupLoading = ref(false);
const editorSelectedUser = ref(null);
const editorLoading = ref(false);
const editorError = ref('');
const editorSaving = ref(false);
const editorSuccessTs = ref(0);
const editorDays = ref([]);
const editorOriginal = ref([]);
const editorDates = ref([]);

function shortDateLabel(dateStr) {
  const d = new Date(dateStr);
  const text = d.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
  return text.replace('.', '').replace(',', '');
}

function longDateLabel(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
  });
}

function nameOf(u) {
  return [u.last_name, u.first_name, u.patronymic].filter(Boolean).join(' ');
}

function initialLetter(value) {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase();
}

function initialWithDot(value) {
  const letter = initialLetter(value);
  return letter ? `${letter}.` : '';
}

function surnameWithInitials(u) {
  const last = u.last_name || '';
  const initials = [initialWithDot(u.first_name), initialWithDot(u.patronymic)]
    .filter(Boolean)
    .join(' ');
  const formatted = [last, initials].filter(Boolean).join(' ');
  return formatted || nameOf(u) || '—';
}

function normalizePartialMode(raw) {
  if (!raw) return null;
  const value = String(raw).trim().toUpperCase();
  if (
    value === 'BEFORE' ||
    value === 'AFTER' ||
    value === 'WINDOW' ||
    value === 'SPLIT'
  ) {
    return value;
  }
  return null;
}

function formatHm(t) {
  if (!t) return '';
  const m = String(t).match(/^(\d{2}:\d{2})/);
  return m ? m[1] : String(t);
}

function isAllDigits(text) {
  if (!text) return false;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

function parseTimeSeconds(value) {
  if (!value) return null;
  const text = String(value).trim();
  const parts = text.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const [hourPart, minutePart, secondPart] = parts;
  if (!isAllDigits(hourPart) || !isAllDigits(minutePart)) return null;
  if (secondPart !== undefined && !isAllDigits(secondPart)) return null;
  if (
    hourPart.length < 1 ||
    hourPart.length > 2 ||
    minutePart.length !== 2 ||
    (secondPart !== undefined && secondPart.length !== 2)
  ) {
    return null;
  }
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

function inferPartialModeFromTimes(fromTime, toTime) {
  if (fromTime && toTime) {
    const from = parseTimeSeconds(fromTime);
    const to = parseTimeSeconds(toTime);
    if (from !== null && to !== null) {
      if (from > to) return 'SPLIT';
      return 'WINDOW';
    }
    return 'WINDOW';
  }
  if (toTime && !fromTime) return 'BEFORE';
  if (fromTime && !toTime) return 'AFTER';
  return null;
}

function partialLabel(cell, { capitalize = true } = {}) {
  const from = formatHm(cell?.from_time);
  const to = formatHm(cell?.to_time);
  const mode =
    normalizePartialMode(cell?.partial_mode) ||
    inferPartialModeFromTimes(cell?.from_time, cell?.to_time);
  if (mode === 'SPLIT' && from && to) {
    return `${capitalize ? 'До' : 'до'} ${to} и ${capitalize ? 'после' : 'после'} ${from}`;
  }
  if (mode === 'WINDOW' && from && to) {
    return `${capitalize ? 'С' : 'с'} ${from} до ${to}`;
  }
  if (to) return `${capitalize ? 'До' : 'до'} ${to}`;
  if (from) return `${capitalize ? 'После' : 'после'} ${from}`;
  return capitalize ? 'Частично' : 'частично';
}

function statusIcon(cell) {
  if (!cell?.preset) return 'bi-question-circle-fill text-muted';
  const s = cell?.status || 'FREE';
  if (s === 'FREE') return 'bi-check-circle-fill text-success';
  if (s === 'PARTIAL') return 'bi-clock-fill text-warning';
  return 'bi-slash-circle-fill text-secondary';
}

function statusTitle(cell) {
  if (!cell?.preset) return 'Не указано';
  const s = cell?.status || 'FREE';
  if (s === 'FREE') return 'Свободен';
  if (s === 'BUSY') return 'Занят';
  return partialLabel(cell, { capitalize: true });
}

function orderedDatesFromSet(set) {
  if (!set?.size) return [];
  if (availableDates.value.length) {
    return availableDates.value.filter((d) => set.has(d));
  }
  return Array.from(set).sort();
}

function activeDateKeys() {
  return dates.value.length ? dates.value : availableDates.value;
}

const {
  selectedRoles,
  selectedDates,
  filterFree,
  filterBusy,
  filterPartialEnabled,
  filterPartialMode,
  filterPartialTime,
  modalSelectedRoles,
  modalSelectedDates,
  modalFilterFree,
  modalFilterBusy,
  modalFilterPartialEnabled,
  modalFilterPartialMode,
  modalFilterPartialTime,
  statusFilterActive,
  activeFiltersCount,
  modalSelectedDatesSize,
  modalStatusDisabled,
  modalRoleSelectionValid,
  prepareFilters,
  toggleModalRole,
  toggleModalDate,
  selectAllModalDates,
  clearModalDates,
  handleModalPartialToggle,
  resetModalFilters,
  applyModalFilters,
  filtersSummary,
} = useRefereeAvailabilityFilters({
  roleOptions,
  availableDates,
  orderedDatesFromSet,
  activeDateKeys,
  shortDateLabel,
  formatHm,
});

const usingServerPagination = computed(() => !statusFilterActive.value);
const isInitialLoading = computed(() => loading.value && !hasLoadedOnce.value);

function matchesAdvanced(u) {
  if (!statusFilterActive.value) return true;
  const keys = activeDateKeys();
  if (!keys.length) return true;

  for (const date of keys) {
    const c = u.availability?.[date];
    if (!c?.preset) continue;
    if (filterFree.value && c.status === 'FREE') return true;
    if (filterBusy.value && c.status === 'BUSY') return true;
    if (filterPartialEnabled.value && c.status === 'PARTIAL') {
      const cellMode =
        normalizePartialMode(c.partial_mode) ||
        inferPartialModeFromTimes(c.from_time, c.to_time);
      if (!filterPartialMode.value) return true;
      if (
        filterPartialMode.value === 'BEFORE' &&
        cellMode === 'BEFORE' &&
        c.to_time &&
        (!filterPartialTime.value ||
          formatHm(c.to_time) === formatHm(filterPartialTime.value))
      ) {
        return true;
      }
      if (
        filterPartialMode.value === 'AFTER' &&
        cellMode === 'AFTER' &&
        c.from_time &&
        (!filterPartialTime.value ||
          formatHm(c.from_time) === formatHm(filterPartialTime.value))
      ) {
        return true;
      }
      if (
        filterPartialMode.value === 'WINDOW' &&
        cellMode === 'WINDOW' &&
        c.from_time &&
        c.to_time &&
        (!filterPartialTime.value ||
          formatHm(c.from_time) === formatHm(filterPartialTime.value) ||
          formatHm(c.to_time) === formatHm(filterPartialTime.value))
      ) {
        return true;
      }
      if (
        filterPartialMode.value === 'SPLIT' &&
        cellMode === 'SPLIT' &&
        c.from_time &&
        c.to_time &&
        (!filterPartialTime.value ||
          formatHm(c.from_time) === formatHm(filterPartialTime.value) ||
          formatHm(c.to_time) === formatHm(filterPartialTime.value))
      ) {
        return true;
      }
    }
  }
  return false;
}

const filteredUsers = computed(() => {
  const term = search.value.trim().toLowerCase();
  const roleSet = selectedRoles.value;
  let list = users.value;
  if (roleSet.size < roleOptions.length) {
    list = list.filter((u) => u.roles?.some((r) => roleSet.has(r)));
  }
  if (term) {
    list = list.filter((u) => nameOf(u).toLowerCase().includes(term));
  }
  return list.filter((u) => matchesAdvanced(u));
});

const totalPages = computed(() => {
  if (usingServerPagination.value) {
    return Math.max(1, Number(serverMeta.value.pages || 1));
  }
  return Math.max(1, Math.ceil(filteredUsers.value.length / pageSize.value));
});

const pagedUsers = computed(() => {
  if (usingServerPagination.value) {
    return filteredUsers.value;
  }
  const start = (page.value - 1) * pageSize.value;
  return filteredUsers.value.slice(start, start + pageSize.value);
});

const hasData = computed(() => users.value.length > 0);

async function load() {
  const requestId = ++gridLoadRequestId;
  if (gridLoadAbortController) {
    gridLoadAbortController.abort();
  }
  const abortController = new AbortController();
  gridLoadAbortController = abortController;

  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams();
    selectedRoles.value.forEach((r) => params.append('role', r));

    const selectedDateList = orderedDatesFromSet(selectedDates.value);
    const shouldSendDates =
      selectedDateList.length &&
      (!availableDates.value.length ||
        selectedDateList.length < availableDates.value.length);

    if (shouldSendDates) {
      selectedDateList.forEach((d) => params.append('date', d));
    }

    const term = search.value.trim();
    if (term) params.append('search', term);

    if (usingServerPagination.value) {
      params.append('page', String(page.value));
      params.append('limit', String(pageSize.value));
    }

    const res = await apiFetch(
      `/availabilities/admin-grid?${params.toString()}`,
      {
        signal: abortController.signal,
      }
    );

    if (requestId !== gridLoadRequestId) return;

    availableDates.value = res.availableDates || res.dates || [];
    const nextDates =
      res.dates && res.dates.length ? res.dates : availableDates.value;
    dates.value = nextDates;
    users.value = res.users || [];
    if (!selectedDates.value.size) {
      selectedDates.value = new Set(nextDates);
    }

    const meta = res.meta || {};
    serverMeta.value = {
      total: Number(meta.total || users.value.length || 0),
      page: Number(meta.page || 1),
      pages: Math.max(1, Number(meta.pages || 1)),
      limit: Number(meta.limit || pageSize.value),
    };
  } catch (e) {
    if (abortController.signal.aborted) return;
    error.value = e?.message || 'Не удалось загрузить данные';
  } finally {
    if (requestId === gridLoadRequestId) {
      loading.value = false;
      hasLoadedOnce.value = true;
    }
    if (gridLoadAbortController === abortController) {
      gridLoadAbortController = null;
    }
  }
}

function openFiltersModal() {
  prepareFilters();
  filtersModal?.show();
}

function closeFiltersModal() {
  filtersModal?.hide();
}

function applyFilters() {
  const applied = applyModalFilters();
  if (!applied) return;
  page.value = 1;
  load();
  filtersModal?.hide();
}

function resetEditorState(keepUser = false) {
  editorError.value = '';
  editorLookupLoading.value = false;
  editorLoading.value = false;
  editorSaving.value = false;
  editorSuccessTs.value = 0;
  editorDays.value = [];
  editorOriginal.value = [];
  editorDates.value = [];
  if (!keepUser) {
    editorSelectedUser.value = null;
  }
}

function cloneEditorDays(list = []) {
  return (list || []).map((d) => ({
    date: d.date,
    status: d.status,
    from_time: d.from_time ?? null,
    to_time: d.to_time ?? null,
    partial_mode: d.partial_mode ?? null,
    preset: !!d.preset,
    cleared: false,
  }));
}

function initEditorDay(d) {
  const day = { ...d };
  day.cleared = false;
  const mode = normalizePartialMode(day.partial_mode);
  if (day.status === 'PARTIAL') {
    day.partialMode =
      mode || inferPartialModeFromTimes(day.from_time, day.to_time) || 'AFTER';
  } else {
    day.partialMode = null;
  }
  day.partial_mode = day.partialMode;
  day.currentStatus = day.preset ? day.status : null;
  return day;
}

function editorEffectiveStatus(d) {
  if (d.cleared) return null;
  if (d.currentStatus != null) return d.currentStatus;
  return d.preset ? d.status : null;
}

function editorIsPartial(d) {
  return editorEffectiveStatus(d) === 'PARTIAL';
}

function editorIsValidPartial(d) {
  if (!editorIsPartial(d)) return true;
  if (d.partialMode === 'BEFORE') {
    return !!d.to_time && !d.from_time && parseTimeSeconds(d.to_time) !== null;
  }
  if (d.partialMode === 'AFTER') {
    return (
      !!d.from_time && !d.to_time && parseTimeSeconds(d.from_time) !== null
    );
  }
  if (d.partialMode === 'WINDOW') {
    if (!d.from_time || !d.to_time) return false;
    const from = parseTimeSeconds(d.from_time);
    const to = parseTimeSeconds(d.to_time);
    return from !== null && to !== null && from < to;
  }
  if (d.partialMode === 'SPLIT') {
    if (!d.from_time || !d.to_time) return false;
    const from = parseTimeSeconds(d.from_time);
    const to = parseTimeSeconds(d.to_time);
    return from !== null && to !== null && to < from;
  }
  return false;
}

const editorInvalidCount = computed(
  () => editorDays.value.filter((d) => !editorIsValidPartial(d)).length
);

const editorHasSelection = computed(() => !!editorSelectedUser.value);
const editorDateList = computed(() =>
  editorDates.value.length ? editorDates.value : availableDates.value
);

function scheduleUserSearch(term) {
  if (editorSearchTimer) clearTimeout(editorSearchTimer);
  if (!term || term.length < 2) {
    editorSuggestions.value = [];
    if (editorLookupAbortController) {
      editorLookupAbortController.abort();
      editorLookupAbortController = null;
    }
    return;
  }
  editorSearchTimer = setTimeout(() => fetchRefereeCandidates(term), 220);
}

async function fetchRefereeCandidates(term) {
  if (editorLookupAbortController) {
    editorLookupAbortController.abort();
  }
  const abortController = new AbortController();
  editorLookupAbortController = abortController;

  editorLookupLoading.value = true;
  try {
    const params = new URLSearchParams({
      limit: '8',
      status: 'ACTIVE',
      sort: 'last_name',
      order: 'asc',
    });
    roleOptions.forEach((r) => params.append('role', r.value));
    if (term) params.append('search', term);
    const data = await apiFetch(`/users?${params.toString()}`, {
      signal: abortController.signal,
    });
    if (editorLookupAbortController !== abortController) return;
    editorSuggestions.value = data.users || [];
  } catch {
    if (abortController.signal.aborted) return;
    editorSuggestions.value = [];
  } finally {
    if (editorLookupAbortController === abortController) {
      editorLookupAbortController = null;
      editorLookupLoading.value = false;
    }
  }
}

function pickEditorUser(u) {
  editorSelectedUser.value = u;
  editorUserQuery.value = nameOf(u);
  editorSuggestions.value = [];
  resetEditorState(true);
  loadEditorAvailability(u.id);
}

async function loadEditorAvailability(userId) {
  if (!userId) return;

  if (editorDetailAbortController) {
    editorDetailAbortController.abort();
  }
  const abortController = new AbortController();
  editorDetailAbortController = abortController;

  editorLoading.value = true;
  editorError.value = '';
  editorSuccessTs.value = 0;
  try {
    const res = await apiFetch(`/availabilities/admin/${userId}`, {
      signal: abortController.signal,
    });
    if (editorDetailAbortController !== abortController) return;

    const rawDays = cloneEditorDays(res.days || []);
    editorDays.value = rawDays.map(initEditorDay);
    editorOriginal.value = cloneEditorDays(res.days || []);
    editorDates.value = res.dates || res.availableDates || [];
    if (!editorSelectedUser.value && res.user) {
      editorSelectedUser.value = res.user;
      editorUserQuery.value = nameOf(res.user);
    }
  } catch (e) {
    if (abortController.signal.aborted) return;
    editorError.value = e?.message || 'Не удалось загрузить занятость';
  } finally {
    if (editorDetailAbortController === abortController) {
      editorDetailAbortController = null;
      editorLoading.value = false;
    }
  }
}

function openEditorModal(user = null) {
  resetEditorState(true);
  editorSuggestions.value = [];
  if (user) {
    editorSelectedUser.value = user;
    editorUserQuery.value = nameOf(user);
    loadEditorAvailability(user.id);
  } else {
    editorUserQuery.value = '';
    editorSelectedUser.value = null;
  }
  editorModal?.show();
}

function closeEditorModal() {
  editorModal?.hide();
}

function setEditorStatus(day, status) {
  day.cleared = false;
  day.currentStatus = status;
  day.status = status;
  if (status === 'PARTIAL') {
    if (!day.partialMode) {
      day.partialMode =
        inferPartialModeFromTimes(day.from_time, day.to_time) || 'AFTER';
    }
    day.partial_mode = day.partialMode;
  } else {
    day.partialMode = null;
    day.from_time = null;
    day.to_time = null;
    day.partial_mode = null;
  }
}

function setEditorPartialMode(day, mode) {
  day.cleared = false;
  day.partialMode = mode;
  day.partial_mode = mode;
  if (mode === 'BEFORE') {
    day.from_time = null;
  } else if (mode === 'AFTER') {
    day.to_time = null;
  }
}

function clearEditorDay(day) {
  day.cleared = true;
  day.currentStatus = null;
  day.status = null;
  day.preset = false;
  day.partialMode = null;
  day.from_time = null;
  day.to_time = null;
  day.partial_mode = null;
}

function baseSnapshot(day) {
  if (!day?.preset) return null;
  const payload = {
    status: day.status,
    from_time: null,
    to_time: null,
  };
  if (day.status === 'PARTIAL') {
    payload.from_time = day.from_time || null;
    payload.to_time = day.to_time || null;
  }
  return payload;
}

function normalizeEditorDay(day) {
  if (day.cleared) return null;
  const status = editorEffectiveStatus(day);
  if (!status) return null;
  if (status !== 'PARTIAL') {
    return {
      date: day.date,
      status,
      from_time: null,
      to_time: null,
      partial_mode: null,
    };
  }
  const partial = {
    date: day.date,
    status,
    from_time: null,
    to_time: null,
    partial_mode: day.partialMode || null,
  };
  if (day.partialMode === 'BEFORE') {
    partial.to_time = day.to_time || null;
  } else if (day.partialMode === 'AFTER') {
    partial.from_time = day.from_time || null;
  } else if (day.partialMode === 'WINDOW' || day.partialMode === 'SPLIT') {
    partial.from_time = day.from_time || null;
    partial.to_time = day.to_time || null;
  }
  return partial;
}

const editorChanges = computed(() => {
  const base = new Map(
    editorOriginal.value.map((d) => [d.date, baseSnapshot(d)])
  );
  const changes = [];
  for (const day of editorDays.value) {
    const next = normalizeEditorDay(day);
    const prev = base.get(day.date) || null;
    if (!next) {
      if (prev) changes.push({ date: day.date, status: null });
      continue;
    }
    const changed =
      !prev ||
      next.status !== prev.status ||
      (next.from_time || null) !== (prev.from_time || null) ||
      (next.to_time || null) !== (prev.to_time || null);
    if (changed) changes.push(next);
  }
  return changes;
});

const editorCanSave = computed(
  () =>
    editorHasSelection.value &&
    editorChanges.value.length > 0 &&
    editorInvalidCount.value === 0 &&
    !editorLoading.value
);

async function saveEditorChanges() {
  if (!editorSelectedUser.value || editorInvalidCount.value > 0) return;
  if (!editorChanges.value.length) return;
  editorSaving.value = true;
  editorError.value = '';
  const payload = editorChanges.value.map((d) =>
    d.status === null ? { date: d.date, status: null } : d
  );
  try {
    await apiFetch(`/availabilities/admin/${editorSelectedUser.value.id}`, {
      method: 'PUT',
      body: JSON.stringify({ days: payload }),
    });
    editorSuccessTs.value = Date.now();
    await loadEditorAvailability(editorSelectedUser.value.id);
    await load();
  } catch (e) {
    editorError.value = e?.message || 'Не удалось сохранить изменения';
  } finally {
    editorSaving.value = false;
  }
}

watch(
  () => editorUserQuery.value,
  (val) => {
    const trimmed = val.trim();
    const currentName = editorSelectedUser.value
      ? nameOf(editorSelectedUser.value)
      : '';
    if (editorSelectedUser.value && trimmed !== currentName) {
      resetEditorState();
    }
    if (trimmed && trimmed === currentName) return;
    scheduleUserSearch(trimmed);
  }
);

watch(
  () => editorDays.value,
  (list) => {
    for (const d of list) {
      const active = editorEffectiveStatus(d);
      if (active !== 'PARTIAL') {
        d.from_time = null;
        d.to_time = null;
        d.partialMode = null;
        d.partial_mode = null;
      } else if (!d.partialMode) {
        d.partialMode =
          inferPartialModeFromTimes(d.from_time, d.to_time) || 'AFTER';
        d.partial_mode = d.partialMode;
      } else if (d.partialMode === 'AFTER' && d.to_time) {
        d.to_time = null;
      } else if (d.partialMode === 'BEFORE' && d.from_time) {
        d.from_time = null;
      }
    }
  },
  { deep: true }
);

watch(
  () => totalPages.value,
  (pages) => {
    const normalizedPages = Math.max(1, pages || 1);
    if (page.value > normalizedPages) {
      page.value = normalizedPages;
    }
    if (page.value < 1) {
      page.value = 1;
    }
  }
);

watch(search, () => {
  if (page.value !== 1) {
    page.value = 1;
    if (!usingServerPagination.value) return;
    return;
  }
  if (!usingServerPagination.value) return;
  if (gridSearchTimer) clearTimeout(gridSearchTimer);
  gridSearchTimer = setTimeout(() => {
    load();
  }, 250);
});

watch(pageSize, () => {
  if (!usingServerPagination.value) return;
  if (page.value !== 1) {
    page.value = 1;
    return;
  }
  load();
});

watch(page, (next, prev) => {
  if (next === prev) return;
  if (usingServerPagination.value) {
    load();
  }
});

const statusLabels = {
  FREE: 'Свободен',
  PARTIAL: 'Частично',
  BUSY: 'Занят',
};

onMounted(() => {
  const filtersEl = document.getElementById('filtersModal');
  if (filtersEl) filtersModal = new Modal(filtersEl);
  const editorEl = document.getElementById('editorModal');
  if (editorEl) editorModal = new Modal(editorEl, { backdrop: 'static' });
  load();
});

onBeforeUnmount(() => {
  if (editorSearchTimer) clearTimeout(editorSearchTimer);
  if (gridSearchTimer) clearTimeout(gridSearchTimer);
  if (gridLoadAbortController) gridLoadAbortController.abort();
  if (editorLookupAbortController) editorLookupAbortController.abort();
  if (editorDetailAbortController) editorDetailAbortController.abort();
});
</script>

<template>
  <div class="py-4">
    <div class="container">
      <Breadcrumbs
        :items="[
          { label: 'Администрирование', to: '/admin' },
          { label: 'Занятость судей' },
        ]"
      />
      <h1 class="mb-3">Занятость судей</h1>

      <div v-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>

      <div v-if="isInitialLoading" class="text-center py-3">
        <div
          class="spinner-border spinner-brand"
          role="status"
          aria-label="Загрузка"
        >
          <span class="visually-hidden">Загрузка…</span>
        </div>
      </div>

      <AdminRefereeAvailabilityGrid
        v-else
        :loading="loading"
        :search="search"
        :active-filters-count="activeFiltersCount"
        :filters-summary="filtersSummary"
        :has-data="hasData"
        :dates="dates"
        :paged-users="pagedUsers"
        :page="page"
        :page-size="pageSize"
        :total-pages="totalPages"
        :name-of="nameOf"
        :surname-with-initials="surnameWithInitials"
        :short-date-label="shortDateLabel"
        :long-date-label="longDateLabel"
        :status-icon="statusIcon"
        :status-title="statusTitle"
        :partial-label="partialLabel"
        @update:search="search = $event"
        @open-filters="openFiltersModal"
        @open-editor="openEditorModal()"
        @edit-user="openEditorModal($event)"
        @update:page="page = $event"
        @update:page-size="pageSize = $event"
      />
    </div>
  </div>

  <RefereeAvailabilityEditorModal
    :editor-error="editorError"
    :editor-lookup-loading="editorLookupLoading"
    :editor-suggestions="editorSuggestions"
    :editor-selected-user="editorSelectedUser"
    :editor-loading="editorLoading"
    :editor-saving="editorSaving"
    :editor-success-ts="editorSuccessTs"
    :editor-days="editorDays"
    :editor-date-list="editorDateList"
    :editor-invalid-count="editorInvalidCount"
    :editor-has-selection="editorHasSelection"
    :editor-changes="editorChanges"
    :editor-can-save="editorCanSave"
    :editor-user-query="editorUserQuery"
    :status-labels="statusLabels"
    :name-of="nameOf"
    :short-date-label="shortDateLabel"
    :long-date-label="longDateLabel"
    :format-hm="formatHm"
    :editor-effective-status="editorEffectiveStatus"
    :editor-is-partial="editorIsPartial"
    :editor-is-valid-partial="editorIsValidPartial"
    @update:editor-user-query="editorUserQuery = $event"
    @pick-user="pickEditorUser"
    @set-status="setEditorStatus"
    @set-partial-mode="setEditorPartialMode"
    @clear-day="clearEditorDay"
    @close="closeEditorModal"
    @save="saveEditorChanges"
  />

  <RefereeAvailabilityFiltersModal
    :role-options="roleOptions"
    :available-dates="availableDates"
    :modal-selected-roles="modalSelectedRoles"
    :modal-selected-dates="modalSelectedDates"
    :modal-selected-dates-size="modalSelectedDatesSize"
    :modal-status-disabled="modalStatusDisabled"
    :modal-role-selection-valid="modalRoleSelectionValid"
    :modal-filter-free="modalFilterFree"
    :modal-filter-busy="modalFilterBusy"
    :modal-filter-partial-enabled="modalFilterPartialEnabled"
    :modal-filter-partial-mode="modalFilterPartialMode"
    :modal-filter-partial-time="modalFilterPartialTime"
    :short-date-label="shortDateLabel"
    :long-date-label="longDateLabel"
    @toggle-role="toggleModalRole"
    @toggle-date="toggleModalDate"
    @select-all-dates="selectAllModalDates"
    @clear-dates="clearModalDates"
    @partial-toggle="handleModalPartialToggle"
    @close="closeFiltersModal"
    @reset="resetModalFilters"
    @apply="applyFilters"
    @update:modal-filter-free="modalFilterFree = $event"
    @update:modal-filter-busy="modalFilterBusy = $event"
    @update:modal-filter-partial-enabled="modalFilterPartialEnabled = $event"
    @update:modal-filter-partial-mode="modalFilterPartialMode = $event"
    @update:modal-filter-partial-time="modalFilterPartialTime = $event"
  />
</template>
