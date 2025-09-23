<script setup>
import {
  ref,
  reactive,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
} from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api';
import { useToast } from '../utils/toast';
import { loadPageSize, savePageSize } from '../utils/pageSize.js';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import PageNav from '../components/PageNav.vue';
import BrandSpinner from '../components/BrandSpinner.vue';
import EmptyState from '../components/EmptyState.vue';
import ConfirmModal from '../components/ConfirmModal.vue';

const STORAGE_KEY = 'adminEquipmentFilters.v2';
const PAGE_SIZE_KEY = 'adminEquipmentPageSize';
const USER_SEARCH_MIN_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 350;
const DEFAULT_SORT = { orderBy: 'updated_at', order: 'desc' };
const SORT_OPTIONS = [
  { value: 'updated_at', label: 'По обновлению' },
  { value: 'created_at', label: 'По добавлению' },
  { value: 'number', label: 'По номеру' },
];

const { showToast } = useToast();

const items = ref([]);
const total = ref(0);
const summary = ref({
  total: 0,
  free: 0,
  awaiting: 0,
  issued: 0,
});
const isLoading = ref(false);
const error = ref('');

const currentPage = ref(1);
const pageSize = ref(loadPageSize(PAGE_SIZE_KEY, 10));

const filters = reactive({
  search: '',
  typeId: '',
  manufacturerId: '',
  sizeId: '',
  status: '',
  number: '',
  orderBy: DEFAULT_SORT.orderBy,
  order: DEFAULT_SORT.order,
});

const searchApplied = ref('');
const filtersModalRef = ref(null);

const types = ref([]);
const manufacturers = ref([]);
const sizes = ref([]);

const editing = ref(null);
const form = reactive({
  typeId: '',
  manufacturerId: '',
  sizeId: '',
  number: '',
});
const formError = ref('');
const fieldErrors = reactive({
  typeId: '',
  manufacturerId: '',
  sizeId: '',
  number: '',
});
const saveLoading = ref(false);

const removeTarget = ref(null);
const isRemoving = ref(false);
const confirmRef = ref(null);

const issueTarget = ref(null);
const issueRef = ref(null);
const issueError = ref('');
const issueLoading = ref(false);
const userQuery = ref('');
const userOptions = ref([]);
const userSelected = ref('');

const modalRef = ref(null);
let editModal;
let issueModal;
let filtersModal;

let userSearchTimeout;
let searchDebounceTimeout;

const isReady = ref(false);

const hasItems = computed(() => items.value.length > 0);
const showInitialLoading = computed(
  () => isLoading.value && !hasItems.value && !error.value
);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / Math.max(pageSize.value, 1)))
);

const hasCustomSort = computed(
  () =>
    filters.orderBy !== DEFAULT_SORT.orderBy ||
    filters.order !== DEFAULT_SORT.order
);

const hasActiveFilters = computed(() =>
  Boolean(
    filters.search ||
      filters.typeId ||
      filters.manufacturerId ||
      filters.sizeId ||
      filters.status ||
      filters.number ||
      hasCustomSort.value
  )
);

const activeFiltersCount = computed(() => {
  let count = 0;
  if (filters.search) count += 1;
  if (filters.typeId) count += 1;
  if (filters.manufacturerId) count += 1;
  if (filters.sizeId) count += 1;
  if (filters.status) count += 1;
  if (filters.number) count += 1;
  if (hasCustomSort.value) count += 1;
  return count;
});

const modalFiltersCount = computed(() => {
  let count = 0;
  if (filters.status) count += 1;
  if (filters.typeId) count += 1;
  if (filters.manufacturerId) count += 1;
  if (filters.sizeId) count += 1;
  if (filters.number) count += 1;
  if (hasCustomSort.value) count += 1;
  return count;
});

const pageRange = computed(() => {
  if (!total.value || !items.value.length) return null;
  const start = (currentPage.value - 1) * pageSize.value + 1;
  const end = start + items.value.length - 1;
  return {
    start,
    end: Math.min(end, total.value),
  };
});

const summaryCards = computed(() => {
  const cards = [
    {
      key: 'total',
      label: 'Всего',
      value: safeNumber(summary.value.total),
      description: hasActiveFilters.value
        ? 'Учитывает активные фильтры'
        : 'Все единицы инвентаря',
      status: null,
      active: !filters.status,
    },
  ];

  const statuses = ['free', 'awaiting', 'issued'];
  for (const status of statuses) {
    const meta = statusMeta(status);
    cards.push({
      key: status,
      label: meta.label,
      value: safeNumber(summary.value[status]),
      description: meta.description,
      status,
      active: filters.status === status,
    });
  }

  return cards;
});

const equipmentTotal = computed(() => {
  if (Number.isFinite(summary.value.total)) return summary.value.total;
  if (Number.isFinite(total.value)) return total.value;
  return 0;
});

const lastUpdatedMeta = computed(() => {
  const iso = summary.value.lastUpdatedAt;
  if (!iso) return null;
  return {
    relative: formatRelativeTime(iso) || '',
    absolute: formatDateTime(iso),
  };
});

const lastCreatedMeta = computed(() => {
  const iso = summary.value.lastCreatedAt;
  if (!iso) return null;
  return {
    relative: formatRelativeTime(iso) || '',
    absolute: formatDateTime(iso),
  };
});

const STATUS_META = {
  free: {
    label: 'Свободна',
    badgeClass: 'bg-success-subtle text-success-emphasis',
    description: 'Доступна для выдачи',
  },
  awaiting: {
    label: 'Ожидает подписи',
    badgeClass: 'bg-warning-subtle text-warning-emphasis',
    description: 'Акт передачи ожидает подписи',
  },
  issued: {
    label: 'Выдана',
    badgeClass: 'bg-secondary-subtle text-secondary-emphasis',
    description: 'За судьёй закреплена экипировка',
  },
};

function statusMeta(value) {
  return (
    STATUS_META[value] || {
      label: 'Неизвестно',
      badgeClass: 'bg-light text-muted',
      description: '',
    }
  );
}

function toggleStatusFilter(nextStatus) {
  if (!nextStatus) {
    filters.status = '';
    return;
  }
  filters.status = filters.status === nextStatus ? '' : nextStatus;
}

function ownerName(owner) {
  if (!owner) return '';
  return [owner.last_name, owner.first_name, owner.patronymic]
    .filter(Boolean)
    .join(' ');
}

function ownerContact(owner) {
  if (!owner) return '';
  return [owner.email, owner.phone].filter(Boolean).join(' · ');
}

function optionLabel(options, value) {
  if (!value) return '';
  const match = (options || []).find((item) => item.value === value);
  return match ? match.label : '';
}

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function sanitizeThreeDigitNumeric(value) {
  return String(value ?? '')
    .replace(/[^\d]/g, '')
    .slice(0, 3);
}

const numberFormatter = new Intl.NumberFormat('ru-RU');

function formatNumber(value) {
  return numberFormatter.format(safeNumber(value));
}

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDateTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(+date)) return '—';
  return dateTimeFormatter.format(date);
}

const relativeFormatter = new Intl.RelativeTimeFormat('ru', {
  numeric: 'auto',
});

function formatRelativeTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(+date)) return '';
  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);

  if (absMs < 60000) return 'только что';

  const diffMinutes = Math.round(diffMs / 60000);
  if (Math.abs(diffMinutes) < 60) {
    return relativeFormatter.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return relativeFormatter.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) {
    return relativeFormatter.format(diffDays, 'day');
  }

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return relativeFormatter.format(diffMonths, 'month');
  }

  const diffYears = Math.round(diffMonths / 12);
  return relativeFormatter.format(diffYears, 'year');
}

const SORT_LABELS = {
  updated_at: 'Дата обновления',
  created_at: 'Дата добавления',
  number: 'Номер',
};

const activeFilterChips = computed(() => {
  const chips = [];
  const searchValue = filters.search.trim();
  if (searchValue) {
    chips.push({
      key: 'search',
      label: `Поиск: ${searchValue}`,
      onRemove: () => {
        filters.search = '';
      },
    });
  }
  if (filters.typeId) {
    const label = optionLabel(types.value, filters.typeId);
    chips.push({
      key: 'typeId',
      label: `Тип: ${label}`,
      onRemove: () => {
        filters.typeId = '';
      },
    });
  }
  if (filters.manufacturerId) {
    const label = optionLabel(manufacturers.value, filters.manufacturerId);
    chips.push({
      key: 'manufacturerId',
      label: `Производитель: ${label}`,
      onRemove: () => {
        filters.manufacturerId = '';
      },
    });
  }
  if (filters.sizeId) {
    const label = optionLabel(sizes.value, filters.sizeId);
    chips.push({
      key: 'sizeId',
      label: `Размер: ${label}`,
      onRemove: () => {
        filters.sizeId = '';
      },
    });
  }
  if (filters.status) {
    const meta = statusMeta(filters.status);
    chips.push({
      key: 'status',
      label: `Статус: ${meta.label}`,
      onRemove: () => {
        filters.status = '';
      },
    });
  }
  if (filters.number) {
    chips.push({
      key: 'number',
      label: `Номер: ${filters.number}`,
      onRemove: () => {
        filters.number = '';
      },
    });
  }
  if (hasCustomSort.value) {
    const base = SORT_LABELS[filters.orderBy] || 'Сортировка';
    const dir = filters.order === 'desc' ? 'по убыванию' : 'по возрастанию';
    chips.push({
      key: 'sort',
      label: `${base}: ${dir}`,
      onRemove: () => {
        filters.orderBy = DEFAULT_SORT.orderBy;
        filters.order = DEFAULT_SORT.order;
      },
    });
  }
  return chips;
});

function restoreFilters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      filters.search = parsed.search || '';
      filters.typeId = parsed.typeId || '';
      filters.manufacturerId = parsed.manufacturerId || '';
      filters.sizeId = parsed.sizeId || '';
      filters.status = parsed.status || '';
      filters.number = parsed.number || '';
      filters.orderBy = parsed.orderBy || DEFAULT_SORT.orderBy;
      filters.order =
        parsed.order === 'asc'
          ? 'asc'
          : parsed.order === 'desc'
            ? 'desc'
            : DEFAULT_SORT.order;
    }
  } catch (_) {
    /* ignore */
  }

  searchApplied.value = filters.search.trim();
}

function persistFilters() {
  if (!isReady.value) return;
  try {
    const payload = {
      search: filters.search,
      typeId: filters.typeId,
      manufacturerId: filters.manufacturerId,
      sizeId: filters.sizeId,
      status: filters.status,
      number: filters.number,
      orderBy: filters.orderBy,
      order: filters.order,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {
    /* ignore */
  }
}

watch(
  () => filters.number,
  (value) => {
    const sanitized = sanitizeThreeDigitNumeric(value);
    if (sanitized !== String(value ?? '')) {
      filters.number = sanitized;
    }
  }
);

watch(
  () => form.number,
  (value) => {
    const sanitized = sanitizeThreeDigitNumeric(value);
    if (sanitized !== String(value ?? '')) {
      form.number = sanitized;
    }
  }
);

watch(
  () => [
    filters.typeId,
    filters.manufacturerId,
    filters.sizeId,
    filters.status,
    filters.number,
    filters.orderBy,
    filters.order,
  ],
  () => {
    if (!isReady.value) return;
    currentPage.value = 1;
  }
);

watch(
  () => filters.search,
  (value) => {
    clearTimeout(searchDebounceTimeout);
    const trimmed = value.trim();
    if (!isReady.value) {
      searchApplied.value = trimmed;
      return;
    }
    if (!trimmed) {
      searchApplied.value = '';
      return;
    }
    searchDebounceTimeout = setTimeout(() => {
      searchApplied.value = trimmed;
    }, SEARCH_DEBOUNCE_MS);
  }
);

watch(searchApplied, () => {
  if (!isReady.value) return;
  currentPage.value = 1;
});

watch(pageSize, (val) => {
  savePageSize(PAGE_SIZE_KEY, val);
  if (!isReady.value) return;
  currentPage.value = 1;
});

watch(
  () => ({
    search: filters.search,
    typeId: filters.typeId,
    manufacturerId: filters.manufacturerId,
    sizeId: filters.sizeId,
    status: filters.status,
    number: filters.number,
    orderBy: filters.orderBy,
    order: filters.order,
  }),
  persistFilters,
  { deep: true }
);

watch(userQuery, (value) => {
  clearTimeout(userSearchTimeout);
  const query = value.trim();
  if (query.length < USER_SEARCH_MIN_CHARS) {
    userOptions.value = [];
    return;
  }
  userSearchTimeout = setTimeout(() => searchUsers(query), 300);
});

const queryState = computed(() => ({
  page: currentPage.value,
  limit: pageSize.value,
  type_id: filters.typeId,
  manufacturer_id: filters.manufacturerId,
  size_id: filters.sizeId,
  status: filters.status,
  number: filters.number,
  orderBy: filters.orderBy,
  order: filters.order,
  search: searchApplied.value,
}));

watch(
  queryState,
  () => {
    if (!isReady.value) return;
    loadList();
  },
  { deep: true }
);

onMounted(async () => {
  restoreFilters();
  editModal = new Modal(modalRef.value, { backdrop: 'static' });
  issueModal = issueRef.value
    ? new Modal(issueRef.value, { backdrop: 'static' })
    : null;
  filtersModal = filtersModalRef.value
    ? new Modal(filtersModalRef.value, { backdrop: 'static' })
    : null;

  await loadDictionaries();
  isReady.value = true;
  await loadList();
});

onBeforeUnmount(() => {
  try {
    editModal?.hide();
    editModal?.dispose();
  } catch (_) {
    /* ignore */
  }
  try {
    issueModal?.hide();
    issueModal?.dispose();
  } catch (_) {
    /* ignore */
  }
  try {
    filtersModal?.hide();
    filtersModal?.dispose();
  } catch (_) {
    /* ignore */
  }
  clearTimeout(userSearchTimeout);
  clearTimeout(searchDebounceTimeout);
});

async function loadDictionaries() {
  try {
    const [typesData, manufacturersData, sizesData] = await Promise.all([
      apiFetch('/equipment/types'),
      apiFetch('/equipment/manufacturers'),
      apiFetch('/equipment/sizes'),
    ]);
    types.value = (typesData.types || []).map((item) => ({
      value: item.id,
      label: item.name,
    }));
    manufacturers.value = (manufacturersData.manufacturers || []).map(
      (item) => ({
        value: item.id,
        label: item.name,
      })
    );
    sizes.value = (sizesData.sizes || []).map((item) => ({
      value: item.id,
      label: item.name,
    }));
  } catch (err) {
    showToast(
      err?.userMessage || err?.message || 'Не удалось загрузить справочники',
      'danger'
    );
  }
}

let loadToken = 0;
async function loadList() {
  const token = ++loadToken;
  isLoading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({
      page: String(currentPage.value),
      limit: String(pageSize.value),
    });
    if (filters.typeId) params.set('type_id', filters.typeId);
    if (filters.manufacturerId)
      params.set('manufacturer_id', filters.manufacturerId);
    if (filters.sizeId) params.set('size_id', filters.sizeId);
    if (filters.status) params.set('status', filters.status);
    const numberTrimmed = String(filters.number || '').trim();
    if (numberTrimmed) params.set('number', numberTrimmed);
    const searchTrimmed = searchApplied.value.trim();
    if (searchTrimmed) params.set('search', searchTrimmed);
    if (filters.orderBy) {
      params.set('orderBy', filters.orderBy);
      params.set('order', filters.order === 'desc' ? 'DESC' : 'ASC');
    }
    const data = await apiFetch(`/equipment?${params.toString()}`);
    if (token !== loadToken) return;
    items.value = data.items || [];
    total.value = data.total || 0;
    if (data.summary) {
      summary.value = {
        total: safeNumber(data.summary.total),
        free: safeNumber(data.summary.free),
        awaiting: safeNumber(data.summary.awaiting),
        issued: safeNumber(data.summary.issued),
        lastUpdatedAt: data.summary.lastUpdatedAt || null,
        lastCreatedAt: data.summary.lastCreatedAt || null,
      };
    }
  } catch (err) {
    if (token !== loadToken) return;
    error.value =
      err?.userMessage ||
      err?.message ||
      'Не удалось загрузить список экипировки';
  } finally {
    if (token === loadToken) {
      isLoading.value = false;
    }
  }
}

function openCreate() {
  editing.value = null;
  Object.assign(form, {
    typeId: '',
    manufacturerId: '',
    sizeId: '',
    number: '',
  });
  clearFieldErrors();
  formError.value = '';
  editModal?.show();
}

function openEdit(item) {
  editing.value = item;
  Object.assign(form, {
    typeId: item.type?.id || '',
    manufacturerId: item.manufacturer?.id || '',
    sizeId: item.size?.id || '',
    number:
      typeof item.number === 'number' ? String(item.number) : item.number || '',
  });
  clearFieldErrors();
  formError.value = '';
  editModal?.show();
}

function clearFieldErrors() {
  fieldErrors.typeId = '';
  fieldErrors.manufacturerId = '';
  fieldErrors.sizeId = '';
  fieldErrors.number = '';
}

function validateForm() {
  clearFieldErrors();
  let valid = true;
  if (!form.typeId) {
    fieldErrors.typeId = 'Выберите тип';
    valid = false;
  }
  if (!form.manufacturerId) {
    fieldErrors.manufacturerId = 'Выберите производителя';
    valid = false;
  }
  if (!form.sizeId) {
    fieldErrors.sizeId = 'Выберите размер';
    valid = false;
  }
  const numberValue = Number.parseInt(String(form.number).trim(), 10);
  if (!Number.isFinite(numberValue) || numberValue < 1 || numberValue > 999) {
    fieldErrors.number = 'Укажите номер от 1 до 999';
    valid = false;
  }
  return { valid, numberValue };
}

async function save() {
  formError.value = '';
  const { valid, numberValue } = validateForm();
  if (!valid) {
    formError.value = 'Исправьте ошибки в форме';
    return;
  }
  const payload = {
    type_id: form.typeId,
    manufacturer_id: form.manufacturerId,
    size_id: form.sizeId,
    number: numberValue,
  };
  try {
    saveLoading.value = true;
    if (editing.value) {
      await apiFetch(`/equipment/${editing.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showToast('Экипировка обновлена', 'success');
    } else {
      await apiFetch('/equipment', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Экипировка добавлена', 'success');
    }
    editModal?.hide();
    await loadList();
  } catch (err) {
    formError.value =
      err?.userMessage ||
      err?.message ||
      'Не удалось сохранить данные. Попробуйте ещё раз.';
  } finally {
    saveLoading.value = false;
  }
}

function confirmRemove(item) {
  removeTarget.value = item;
  confirmRef.value?.open();
}

async function handleRemoveConfirm() {
  if (!removeTarget.value) return;
  isRemoving.value = true;
  try {
    await apiFetch(`/equipment/${removeTarget.value.id}`, { method: 'DELETE' });
    showToast('Запись удалена', 'success');
    if (items.value.length === 1 && currentPage.value > 1) {
      currentPage.value -= 1;
    } else {
      await loadList();
    }
  } catch (err) {
    showToast(
      err?.userMessage || err?.message || 'Не удалось удалить запись',
      'danger'
    );
  } finally {
    isRemoving.value = false;
    removeTarget.value = null;
  }
}

function handleRemoveCancel() {
  removeTarget.value = null;
}

function openIssue(item) {
  issueTarget.value = item;
  issueError.value = '';
  issueLoading.value = false;
  userQuery.value = '';
  userOptions.value = [];
  userSelected.value = '';
  issueModal?.show();
}

async function searchUsers(query) {
  try {
    const baseParams = new URLSearchParams({
      search: query,
      limit: '20',
      role: 'REFEREE',
    });
    const primary = await apiFetch(`/users?${baseParams.toString()}`);
    const merged = [...(primary.users || [])];
    const seen = new Set(merged.map((u) => u.id));
    const extraParams = new URLSearchParams({
      search: query,
      limit: '20',
      role: 'BRIGADE_REFEREE',
    });
    const extra = await apiFetch(`/users?${extraParams.toString()}`);
    for (const candidate of extra.users || []) {
      if (!seen.has(candidate.id)) merged.push(candidate);
    }
    userOptions.value = merged;
  } catch (_) {
    userOptions.value = [];
  }
}

async function issueConfirm() {
  if (!issueTarget.value || !userSelected.value) return;
  issueLoading.value = true;
  issueError.value = '';
  try {
    await apiFetch(`/equipment/${issueTarget.value.id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userSelected.value }),
    });
    showToast('Выдача оформлена. Документ создан', 'success');
    issueModal?.hide();
    await loadList();
  } catch (err) {
    issueError.value =
      err?.userMessage ||
      err?.message ||
      'Не удалось оформить выдачу. Попробуйте снова.';
  } finally {
    issueLoading.value = false;
  }
}

function openFilters() {
  filtersModal?.show();
}

function closeFilters() {
  filtersModal?.hide();
}

function resetFilters({ preserveSearch = false } = {}) {
  if (!hasActiveFilters.value) return;
  if (!preserveSearch) {
    filters.search = '';
    searchApplied.value = '';
  }
  filters.typeId = '';
  filters.manufacturerId = '';
  filters.sizeId = '';
  filters.status = '';
  filters.number = '';
  filters.orderBy = DEFAULT_SORT.orderBy;
  filters.order = DEFAULT_SORT.order;
}

function toggleSortDirection() {
  filters.order = filters.order === 'desc' ? 'asc' : 'desc';
}

function documentSummary(item) {
  const doc = item?.document;
  if (!doc) return '';
  const parts = [];
  if (doc.number) parts.push(`Акт №${doc.number}`);
  const statusName = doc.status?.name;
  if (statusName) parts.push(statusName);
  return parts.join(' · ');
}
</script>

<template>
  <div class="container py-4 admin-equipment-page">
    <Breadcrumbs
      :items="[
        { label: 'Администрирование', to: '/admin' },
        { label: 'Экипировка', disabled: true },
      ]"
    />

    <div
      class="page-header d-flex flex-column flex-lg-row gap-3 align-items-start align-items-lg-center justify-content-between mb-4"
    >
      <div class="page-header__content flex-grow-1">
        <div class="d-flex flex-wrap align-items-center gap-3 mb-2">
          <h1 class="h2 mb-0">Экипировка</h1>
          <span
            class="page-header__total badge bg-primary-subtle text-primary-emphasis"
          >
            Всего: {{ formatNumber(equipmentTotal) }}
          </span>
        </div>
        <p class="text-muted mb-2 mb-lg-3">
          Управление выдачей и учётом экипировки судейского корпуса
        </p>
        <div
          v-if="lastUpdatedMeta || lastCreatedMeta"
          class="page-header__meta text-muted small d-flex flex-column flex-sm-row gap-2"
        >
          <span v-if="lastUpdatedMeta">
            Последнее изменение:
            <span class="text-body-secondary">
              {{ lastUpdatedMeta.relative || lastUpdatedMeta.absolute }}
            </span>
            <span
              v-if="lastUpdatedMeta.relative && lastUpdatedMeta.absolute"
              class="text-muted ms-1"
            >
              ({{ lastUpdatedMeta.absolute }})
            </span>
          </span>
          <span v-if="lastCreatedMeta">
            Последнее добавление:
            <span class="text-body-secondary">
              {{ lastCreatedMeta.relative || lastCreatedMeta.absolute }}
            </span>
            <span
              v-if="lastCreatedMeta.relative && lastCreatedMeta.absolute"
              class="text-muted ms-1"
            >
              ({{ lastCreatedMeta.absolute }})
            </span>
          </span>
        </div>
      </div>
      <div
        class="page-header__actions d-flex flex-wrap align-items-center gap-2"
      >
        <span
          v-if="hasActiveFilters"
          class="badge bg-info-subtle text-info-emphasis"
        >
          {{
            activeFiltersCount > 1
              ? `Фильтры: ${activeFiltersCount}`
              : 'Фильтр активен'
          }}
        </span>
        <button type="button" class="btn btn-brand" @click="openCreate">
          <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>
          Добавить
        </button>
      </div>
    </div>

    <div class="row g-3 summary-row mb-4">
      <div
        v-for="card in summaryCards"
        :key="card.key"
        class="col-12 col-sm-6 col-xl-3"
      >
        <button
          type="button"
          class="summary-card card tile w-100 text-start"
          :class="[
            card.active ? 'summary-card--active' : null,
            card.status
              ? `summary-card--${card.status}`
              : 'summary-card--total',
          ]"
          :aria-pressed="card.active ? 'true' : 'false'"
          @click="toggleStatusFilter(card.status)"
        >
          <div class="card-body">
            <p class="summary-card-label text-muted text-uppercase small mb-1">
              {{ card.label }}
            </p>
            <p class="summary-card-value h3 mb-1">
              {{ formatNumber(card.value) }}
            </p>
            <p class="summary-card-description text-muted small mb-0">
              {{ card.description }}
            </p>
          </div>
        </button>
      </div>
    </div>

    <div class="card section-card tile fade-in shadow-sm mb-4">
      <div
        class="card-header d-flex flex-wrap align-items-start justify-content-between gap-3"
      >
        <div>
          <h2 class="h5 mb-1">Список экипировки</h2>
          <div class="text-muted small equipment-meta">
            <span v-if="pageRange">
              Показаны {{ pageRange.start }}–{{ pageRange.end }} из {{ total }}
            </span>
            <span v-else-if="total">Всего записей: {{ total }}</span>
            <span v-else>Добавьте первую запись</span>
          </div>
        </div>
      </div>
      <div class="card-body">
        <div
          class="filter-toolbar-main d-flex flex-column flex-lg-row gap-3 align-items-start align-items-lg-center mb-3"
        >
          <div class="filter-search flex-grow-1 w-100">
            <label class="form-label" for="flt-search">Поиск</label>
            <div class="input-group input-search">
              <span class="input-group-text">
                <i class="bi bi-search" aria-hidden="true"></i>
              </span>
              <input
                id="flt-search"
                v-model="filters.search"
                type="search"
                class="form-control"
                placeholder="Тип, производитель, владелец или номер"
                autocomplete="off"
              />
              <button
                v-if="filters.search"
                type="button"
                class="btn btn-outline-secondary"
                title="Очистить поиск"
                @click="filters.search = ''"
              >
                <i class="bi bi-x-lg" aria-hidden="true"></i>
                <span class="visually-hidden">Очистить поиск</span>
              </button>
            </div>
            <p class="text-muted small mb-0 mt-1">
              Поиск проводится по типу, производителю, размеру, номеру,
              владельцу и документу.
            </p>
          </div>
          <div class="filter-buttons w-100">
            <button
              type="button"
              class="btn btn-outline-secondary position-relative w-100"
              @click="openFilters"
            >
              <i class="bi bi-sliders me-2" aria-hidden="true"></i>
              Фильтры
              <span
                v-if="modalFiltersCount"
                class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-primary"
              >
                {{ modalFiltersCount }}
                <span class="visually-hidden">Активные фильтры</span>
              </span>
            </button>
          </div>
        </div>

        <div
          v-if="activeFilterChips.length"
          class="filter-chips d-flex flex-wrap gap-2 mb-3"
        >
          <button
            v-for="chip in activeFilterChips"
            :key="chip.key"
            type="button"
            class="chip badge rounded-pill bg-light text-muted border"
            @click="chip.onRemove?.()"
          >
            <span>{{ chip.label }}</span>
            <i class="bi bi-x-lg ms-1" aria-hidden="true"></i>
            <span class="visually-hidden">Сбросить {{ chip.label }}</span>
          </button>
        </div>

        <div v-if="hasActiveFilters" class="d-flex justify-content-end mb-3">
          <button
            type="button"
            class="btn btn-link px-0"
            @click="resetFilters({ preserveSearch: true })"
          >
            Сбросить фильтры
          </button>
        </div>

        <div
          v-if="error && items.length"
          class="alert alert-danger mb-3"
          role="alert"
        >
          {{ error }}
        </div>

        <div v-if="showInitialLoading" class="py-5">
          <BrandSpinner label="Загрузка списка экипировки" />
        </div>
        <template v-else>
          <div v-if="error && !items.length" class="py-4">
            <EmptyState
              icon="bi-exclamation-triangle"
              title="Не удалось загрузить"
              :description="error"
            >
              <button
                type="button"
                class="btn btn-outline-secondary"
                @click="loadList"
              >
                Повторить попытку
              </button>
            </EmptyState>
          </div>
          <div v-else-if="!items.length" class="py-5">
            <EmptyState
              icon="bi-briefcase"
              title="Экипировка не найдена"
              description="Измените условия фильтра или добавьте новую единицу."
            >
              <button type="button" class="btn btn-brand" @click="openCreate">
                <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>
                Добавить
              </button>
            </EmptyState>
          </div>
          <template v-else>
            <table
              class="table admin-table align-middle mb-0 equipment-table d-none d-lg-table"
            >
              <thead>
                <tr>
                  <th scope="col" class="col-number">№</th>
                  <th scope="col" class="col-type">Тип</th>
                  <th scope="col" class="col-manufacturer">Производитель</th>
                  <th scope="col" class="col-size">Размер</th>
                  <th scope="col" class="col-status">Статус</th>
                  <th scope="col" class="col-owner">Получатель</th>
                  <th scope="col" class="col-actions text-end">Действия</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in items" :key="item.id">
                  <td class="text-nowrap fw-semibold">
                    {{ item.number ?? '—' }}
                  </td>
                  <td class="text-truncate" :title="item.type?.name || '—'">
                    {{ item.type?.name || '—' }}
                  </td>
                  <td
                    class="text-truncate"
                    :title="item.manufacturer?.name || '—'"
                  >
                    {{ item.manufacturer?.name || '—' }}
                  </td>
                  <td class="text-truncate" :title="item.size?.name || '—'">
                    {{ item.size?.name || '—' }}
                  </td>
                  <td>
                    <span
                      class="badge rounded-pill"
                      :class="statusMeta(item.status).badgeClass"
                      :title="statusMeta(item.status).description"
                    >
                      {{ statusMeta(item.status).label }}
                    </span>
                  </td>
                  <td class="owner-cell">
                    <template v-if="item.owner">
                      <span class="owner-cell__name">{{
                        ownerName(item.owner)
                      }}</span>
                      <span
                        v-if="ownerContact(item.owner)"
                        class="owner-cell__contact text-muted"
                      >
                        {{ ownerContact(item.owner) }}
                      </span>
                    </template>
                    <template v-else-if="item.status === 'awaiting'">
                      <span class="text-muted">Ожидает подписи</span>
                    </template>
                    <template v-else>
                      <span class="text-muted">Не назначен</span>
                    </template>
                  </td>
                  <td class="text-end">
                    <div class="btn-group btn-group-sm" role="group">
                      <button
                        type="button"
                        class="btn btn-outline-secondary"
                        :aria-label="`Редактировать ${item.type?.name || ''}`"
                        :title="`Редактировать ${item.type?.name || 'запись'}`"
                        @click="openEdit(item)"
                      >
                        <i class="bi bi-pencil" aria-hidden="true"></i>
                      </button>
                      <button
                        v-if="item.status === 'free'"
                        type="button"
                        class="btn btn-outline-success"
                        :aria-label="`Выдать экипировку №${item.number}`"
                        :title="`Выдать экипировку №${item.number ?? '—'}`"
                        @click="openIssue(item)"
                      >
                        <i
                          class="bi bi-box-arrow-up-right"
                          aria-hidden="true"
                        ></i>
                      </button>
                      <button
                        type="button"
                        class="btn btn-outline-danger"
                        :aria-label="`Удалить запись об экипировке №${item.number}`"
                        :title="`Удалить запись №${item.number ?? '—'}`"
                        :disabled="isRemoving"
                        @click="confirmRemove(item)"
                      >
                        <i class="bi bi-trash" aria-hidden="true"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div class="d-lg-none">
              <div class="row g-3 equipment-mobile">
                <div v-for="item in items" :key="item.id" class="col-12">
                  <article class="equipment-card card tile h-100">
                    <div class="card-body">
                      <div
                        class="d-flex align-items-start justify-content-between gap-2 mb-3"
                      >
                        <div class="text-truncate">
                          <p class="text-muted small mb-1">
                            № {{ item.number ?? '—' }}
                          </p>
                          <h3 class="h6 mb-1 text-truncate">
                            {{ item.type?.name || 'Тип не указан' }}
                          </h3>
                          <p class="text-muted small mb-0 text-truncate">
                            {{ item.manufacturer?.name || '—' }}
                          </p>
                        </div>
                        <span
                          class="badge rounded-pill"
                          :class="statusMeta(item.status).badgeClass"
                          :title="statusMeta(item.status).description"
                        >
                          {{ statusMeta(item.status).label }}
                        </span>
                      </div>
                      <dl class="mobile-details">
                        <div class="mobile-detail">
                          <dt>Размер</dt>
                          <dd>{{ item.size?.name || '—' }}</dd>
                        </div>
                        <div class="mobile-detail">
                          <dt>Получатель</dt>
                          <dd>
                            <template v-if="item.owner">
                              {{ ownerName(item.owner) }}
                            </template>
                            <template v-else-if="item.status === 'awaiting'">
                              <span class="text-muted">Ожидает подписи</span>
                            </template>
                            <template v-else>
                              <span class="text-muted">Не назначен</span>
                            </template>
                          </dd>
                        </div>
                        <div
                          v-if="item.owner && ownerContact(item.owner)"
                          class="mobile-detail"
                        >
                          <dt>Контакты</dt>
                          <dd>{{ ownerContact(item.owner) }}</dd>
                        </div>
                      </dl>
                    </div>
                    <div class="card-footer bg-transparent border-0 pt-0">
                      <div class="d-flex flex-wrap gap-2">
                        <button
                          type="button"
                          class="btn btn-outline-secondary btn-sm flex-grow-1"
                          :title="`Редактировать ${item.type?.name || 'запись'}`"
                          @click="openEdit(item)"
                        >
                          <i class="bi bi-pencil me-1" aria-hidden="true"></i>
                          Редактировать
                        </button>
                        <button
                          v-if="item.status === 'free'"
                          type="button"
                          class="btn btn-outline-success btn-sm flex-grow-1"
                          :title="`Выдать экипировку №${item.number ?? '—'}`"
                          @click="openIssue(item)"
                        >
                          <i
                            class="bi bi-box-arrow-up-right me-1"
                            aria-hidden="true"
                          ></i>
                          Выдать
                        </button>
                        <button
                          type="button"
                          class="btn btn-outline-danger btn-sm flex-grow-1"
                          :disabled="isRemoving"
                          :title="`Удалить запись №${item.number ?? '—'}`"
                          @click="confirmRemove(item)"
                        >
                          <i class="bi bi-trash me-1" aria-hidden="true"></i>
                          Удалить
                        </button>
                      </div>
                    </div>
                  </article>
                </div>
              </div>
            </div>
            <BrandSpinner
              v-if="isLoading && hasItems"
              small
              label="Обновляем список"
              class="mt-3"
            />
          </template>
        </template>
      </div>
      <div
        v-if="items.length"
        class="card-footer d-flex flex-wrap align-items-center gap-2 justify-content-between"
      >
        <span class="text-muted small">
          <template v-if="pageRange">
            Страница {{ currentPage }} из {{ totalPages }} · записи
            {{ pageRange.start }}–{{ pageRange.end }}
          </template>
          <template v-else> Всего записей: {{ total }} </template>
        </span>
        <PageNav
          v-model:page="currentPage"
          v-model:page-size="pageSize"
          :total-pages="totalPages"
          :sizes="[10, 20, 50]"
        />
      </div>
    </div>
  </div>

  <div ref="modalRef" class="modal fade" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <form @submit.prevent="save">
          <div class="modal-header">
            <h2 class="modal-title h5">
              {{ editing ? 'Редактирование экипировки' : 'Новая экипировка' }}
            </h2>
            <button
              type="button"
              class="btn-close"
              data-bs-dismiss="modal"
            ></button>
          </div>
          <div class="modal-body">
            <div v-if="formError" class="alert alert-danger" role="alert">
              {{ formError }}
            </div>
            <div class="mb-3">
              <label class="form-label" for="form-type">Тип</label>
              <select
                id="form-type"
                v-model="form.typeId"
                class="form-select"
                :class="{ 'is-invalid': fieldErrors.typeId }"
              >
                <option value="" disabled>Выберите тип</option>
                <option v-for="t in types" :key="t.value" :value="t.value">
                  {{ t.label }}
                </option>
              </select>
              <div v-if="fieldErrors.typeId" class="invalid-feedback">
                {{ fieldErrors.typeId }}
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label" for="form-manufacturer"
                >Производитель</label
              >
              <select
                id="form-manufacturer"
                v-model="form.manufacturerId"
                class="form-select"
                :class="{ 'is-invalid': fieldErrors.manufacturerId }"
              >
                <option value="" disabled>Выберите производителя</option>
                <option
                  v-for="m in manufacturers"
                  :key="m.value"
                  :value="m.value"
                >
                  {{ m.label }}
                </option>
              </select>
              <div v-if="fieldErrors.manufacturerId" class="invalid-feedback">
                {{ fieldErrors.manufacturerId }}
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label" for="form-size">Размер</label>
              <select
                id="form-size"
                v-model="form.sizeId"
                class="form-select"
                :class="{ 'is-invalid': fieldErrors.sizeId }"
              >
                <option value="" disabled>Выберите размер</option>
                <option v-for="s in sizes" :key="s.value" :value="s.value">
                  {{ s.label }}
                </option>
              </select>
              <div v-if="fieldErrors.sizeId" class="invalid-feedback">
                {{ fieldErrors.sizeId }}
              </div>
            </div>
            <div class="mb-0">
              <label class="form-label" for="form-number">Номер</label>
              <input
                id="form-number"
                v-model="form.number"
                type="number"
                min="1"
                max="999"
                step="1"
                inputmode="numeric"
                class="form-control"
                :class="{ 'is-invalid': fieldErrors.number }"
              />
              <div v-if="fieldErrors.number" class="invalid-feedback">
                {{ fieldErrors.number }}
              </div>
              <div v-else class="form-text text-muted">
                Допустимы значения от 1 до 999.
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-outline-secondary"
              data-bs-dismiss="modal"
            >
              Отмена
            </button>
            <button type="submit" class="btn btn-brand" :disabled="saveLoading">
              <span
                v-if="saveLoading"
                class="spinner-border spinner-border-sm me-2"
                aria-hidden="true"
              ></span>
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <div
    ref="filtersModalRef"
    class="modal fade"
    tabindex="-1"
    aria-hidden="true"
  >
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content">
        <form @submit.prevent="closeFilters">
          <div class="modal-header">
            <h2 class="modal-title h5">Фильтры</h2>
            <button
              type="button"
              class="btn-close"
              data-bs-dismiss="modal"
              aria-label="Закрыть"
            ></button>
          </div>
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-12 col-md-6">
                <label class="form-label" for="modal-status">Статус</label>
                <select
                  id="modal-status"
                  v-model="filters.status"
                  class="form-select"
                >
                  <option value="">Все статусы</option>
                  <option value="free">Свободна</option>
                  <option value="awaiting">Ожидает подписи</option>
                  <option value="issued">Выдана</option>
                </select>
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label" for="modal-type">Тип</label>
                <select
                  id="modal-type"
                  v-model="filters.typeId"
                  class="form-select"
                >
                  <option value="">Все типы</option>
                  <option v-for="t in types" :key="t.value" :value="t.value">
                    {{ t.label }}
                  </option>
                </select>
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label" for="modal-manufacturer"
                  >Производитель</label
                >
                <select
                  id="modal-manufacturer"
                  v-model="filters.manufacturerId"
                  class="form-select"
                >
                  <option value="">Все производители</option>
                  <option
                    v-for="m in manufacturers"
                    :key="m.value"
                    :value="m.value"
                  >
                    {{ m.label }}
                  </option>
                </select>
              </div>
              <div class="col-6 col-md-3">
                <label class="form-label" for="modal-size">Размер</label>
                <select
                  id="modal-size"
                  v-model="filters.sizeId"
                  class="form-select"
                >
                  <option value="">Любой</option>
                  <option v-for="s in sizes" :key="s.value" :value="s.value">
                    {{ s.label }}
                  </option>
                </select>
              </div>
              <div class="col-6 col-md-3">
                <label class="form-label" for="modal-number">Номер</label>
                <input
                  id="modal-number"
                  v-model="filters.number"
                  type="number"
                  min="1"
                  max="999"
                  step="1"
                  inputmode="numeric"
                  class="form-control"
                  placeholder="до 999"
                />
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label" for="modal-sort">Сортировка</label>
                <div class="d-flex gap-2">
                  <select
                    id="modal-sort"
                    v-model="filters.orderBy"
                    class="form-select"
                  >
                    <option
                      v-for="opt in SORT_OPTIONS"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="btn btn-outline-secondary sort-direction-btn"
                    :title="
                      filters.order === 'desc'
                        ? 'Сортировать по возрастанию'
                        : 'Сортировать по убыванию'
                    "
                    @click="toggleSortDirection"
                  >
                    <i
                      :class="
                        filters.order === 'desc'
                          ? 'bi bi-arrow-down-short'
                          : 'bi bi-arrow-up-short'
                      "
                      aria-hidden="true"
                    ></i>
                    <span class="visually-hidden"
                      >Сменить направление сортировки</span
                    >
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div
            class="modal-footer d-flex flex-wrap gap-2 justify-content-between"
          >
            <button
              type="button"
              class="btn btn-link text-decoration-none"
              :disabled="!hasActiveFilters"
              @click="
                resetFilters({ preserveSearch: true });
                closeFilters();
              "
            >
              Сбросить
            </button>
            <div class="d-flex gap-2">
              <button
                type="button"
                class="btn btn-outline-secondary"
                data-bs-dismiss="modal"
              >
                Отмена
              </button>
              <button type="submit" class="btn btn-brand">Применить</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>

  <div ref="issueRef" class="modal fade" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title h5">Выдача экипировки</h2>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Закрыть"
          ></button>
        </div>
        <div class="modal-body">
          <div v-if="issueError" class="alert alert-danger" role="alert">
            {{ issueError }}
          </div>
          <div v-if="issueTarget" class="mb-3 small text-muted">
            <div class="fw-semibold text-body mb-1">
              {{ issueTarget.type?.name || 'Тип не указан' }}
            </div>
            <div>
              Производитель: {{ issueTarget.manufacturer?.name || '—' }}
            </div>
            <div>Размер: {{ issueTarget.size?.name || '—' }}</div>
            <div>Номер: {{ issueTarget.number ?? '—' }}</div>
          </div>
          <label class="form-label" for="issue-search">Получатель</label>
          <div class="input-group mb-2">
            <span class="input-group-text">
              <i class="bi bi-search" aria-hidden="true"></i>
            </span>
            <input
              id="issue-search"
              v-model="userQuery"
              type="search"
              class="form-control"
              placeholder="Фамилия, имя, email или телефон"
              autocomplete="off"
            />
          </div>
          <p class="text-muted small mb-2">
            Введите минимум {{ USER_SEARCH_MIN_CHARS }} символа.
          </p>
          <select
            v-model="userSelected"
            class="form-select"
            size="6"
            aria-label="Выберите получателя"
          >
            <option v-for="u in userOptions" :key="u.id" :value="u.id">
              {{ u.last_name }} {{ u.first_name }} {{ u.patronymic }} —
              {{ u.email || u.phone || 'контакты не указаны' }}
            </option>
          </select>
          <p
            v-if="
              userQuery.length >= USER_SEARCH_MIN_CHARS && !userOptions.length
            "
            class="text-muted small mt-2 mb-0"
          >
            Совпадений не найдено.
          </p>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            data-bs-dismiss="modal"
          >
            Отмена
          </button>
          <button
            type="button"
            class="btn btn-success"
            :disabled="!userSelected || issueLoading"
            @click="issueConfirm"
          >
            <span
              v-if="issueLoading"
              class="spinner-border spinner-border-sm me-2"
              aria-hidden="true"
            ></span>
            Выдать
          </button>
        </div>
      </div>
    </div>
  </div>

  <ConfirmModal
    ref="confirmRef"
    title="Удалить запись"
    confirm-text="Удалить"
    confirm-variant="danger"
    @confirm="handleRemoveConfirm"
    @cancel="handleRemoveCancel"
  >
    <p class="mb-0">
      Удалить запись об экипировке
      <strong v-if="removeTarget">№{{ removeTarget.number }}</strong
      >? Действие нельзя отменить.
    </p>
  </ConfirmModal>
</template>

<style scoped>
.summary-card {
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
  border: 1px solid var(--bs-border-color-translucent, var(--bs-border-color));
}

.page-header__total {
  font-size: 0.95rem;
  font-weight: 600;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
}

.page-header__actions {
  flex-shrink: 0;
}

.page-header__meta {
  line-height: 1.5;
}

.summary-card:focus-visible {
  outline: none;
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
}

.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--bs-box-shadow-sm);
}

.summary-card--active {
  border-color: var(--bs-primary);
  box-shadow: 0 4px 16px rgba(13, 110, 253, 0.12);
}

.summary-card-label {
  letter-spacing: 0.04em;
}

.summary-card-value {
  font-weight: 600;
}

.equipment-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: baseline;
}

.equipment-meta__item {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
}

.input-search .btn {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.sort-direction-btn {
  min-width: 2.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.filter-chips {
  padding: 0.25rem 0;
}

.filter-toolbar-main .form-label {
  font-weight: 600;
}

.filter-buttons {
  display: flex;
  gap: 0.5rem;
  max-width: 18rem;
}

.filter-buttons .btn {
  height: 100%;
  justify-content: center;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-color: var(--bs-border-color-translucent, var(--bs-border-color));
  color: var(--bs-secondary-color);
  background-color: var(--bs-body-bg);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.chip:hover,
.chip:focus-visible {
  background-color: rgba(13, 110, 253, 0.08);
  border-color: var(--bs-primary);
  color: var(--bs-primary);
  outline: none;
}

.equipment-grid {
  margin-top: 0.5rem;
}

.equipment-card {
  border: 1px solid var(--bs-border-color-translucent, var(--bs-border-color));
}

.equipment-details {
  margin: 0;
  padding: 0;
  display: grid;
  row-gap: 0.5rem;
}

.equipment-detail {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.92rem;
}

.equipment-detail dt {
  margin: 0;
  font-weight: 500;
  color: var(--bs-secondary-color);
}

.equipment-detail dd {
  margin: 0;
  text-align: right;
}

@media (max-width: 991.98px) {
  .equipment-meta {
    gap: 0.5rem;
  }
  .equipment-meta__item {
    display: block;
  }
}
.equipment-table .col-number {
  width: 5rem;
  min-width: 5rem;
}
.equipment-table .col-size {
  width: 8%;
  min-width: 70px;
  text-align: center;
}
.equipment-table .col-type {
  width: 22%;
  min-width: 200px;
}
.equipment-table .col-manufacturer {
  width: 18%;
  min-width: 150px;
}
.equipment-table .col-status {
  width: 14%;
  min-width: 150px;
}
.equipment-table .col-owner {
  width: 23%;
  min-width: 210px;
}
.equipment-table .col-actions {
  width: 10%;
  min-width: 130px;
}

.owner-cell {
  white-space: normal;
  word-break: break-word;
}

.owner-cell__name {
  display: block;
  font-weight: 500;
}

.owner-cell__contact {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.85rem;
}

@media (max-width: 991.98px) {
  .filter-buttons {
    width: 100%;
    max-width: none;
  }
  .equipment-table {
    min-width: 720px;
  }
  .equipment-table .col-size,
  .equipment-table .col-number {
    text-align: left;
  }
}

.equipment-mobile .equipment-card {
  border: 1px solid var(--bs-border-color-translucent, var(--bs-border-color));
}

.mobile-details {
  margin: 0;
  padding: 0;
  display: grid;
  row-gap: 0.5rem;
}

.mobile-detail {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.92rem;
}

.mobile-detail dt {
  margin: 0;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--bs-secondary-color);
}

.mobile-detail dd {
  margin: 0;
  text-align: left;
  color: var(--bs-body-color);
  word-break: break-word;
}
</style>
