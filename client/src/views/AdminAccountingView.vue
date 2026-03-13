<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import PageNav from '../components/PageNav.vue';
import BrandSpinner from '../components/BrandSpinner.vue';
import { apiFetch, apiFetchBlob } from '../api';
import { useToast } from '../utils/toast';

const { showToast } = useToast();
const route = useRoute();

const refDataLoading = ref(false);
const refDataError = ref('');
const refData = reactive({
  statuses: [] as any[],
  sources: [] as any[],
  actions: [] as any[],
  transitions: [] as any[],
});

const loading = ref(false);
const error = ref('');
const rows = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);

const filters = reactive({
  tournament_id: '',
  search: '',
  number: '',
  fare_code: '',
  status: '',
  source: '',
  date_from: '',
  date_to: '',
  amount_from: '',
  amount_to: '',
});
const showAdvancedFilters = ref(false);

const actionLoading = ref('');
const selectedIds = ref<string[]>([]);
const selectionMode = ref<'explicit' | 'filtered'>('explicit');
const filteredSelection = ref<{
  count: number;
  filters: Record<string, string>;
} | null>(null);
const deleteLoading = ref(false);
const deleteError = ref('');
const deleteModalOpen = ref(false);
const deleteModalIds = ref<string[]>([]);
const deleteModalSelection = ref<{
  count: number;
  selectionMode: 'explicit' | 'filtered';
  filters?: Record<string, string>;
} | null>(null);
const deleteModalForm = reactive({
  reason_code: '',
  comment: '',
});

const detailLoading = ref(false);
const detailError = ref('');
const selectedDocumentId = ref('');
const selectedDocument = ref<any>(null);
const selectedAuditEvents = ref<any[]>([]);

const adjustmentLoading = ref(false);
const adjustmentError = ref('');
const adjustmentForm = reactive({
  base_amount_rub: '0,00',
  meal_amount_rub: '0,00',
  travel_amount_rub: '0,00',
  reason_code: '',
  comment: '',
});

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / limit.value))
);

const selectedAllOnPage = computed(
  () =>
    rows.value.length > 0 &&
    rows.value.every((row) =>
      selectionMode.value === 'filtered'
        ? true
        : selectedIds.value.includes(String(row.id))
    )
);

const approveBulkAction = computed(() =>
  (refData.actions || []).find(
    (item) => item.scope === 'ACCRUAL' && item.alias === 'APPROVE'
  )
);

const actionAliasesByStatus = computed(() => {
  const map = new Map<string, string[]>();
  for (const item of refData.transitions || []) {
    const fromAlias = String(item?.from_status?.alias || '');
    const actionAlias = String(item?.action?.alias || '');
    if (!fromAlias || !actionAlias || item?.is_enabled === false) continue;
    if (!map.has(fromAlias)) map.set(fromAlias, []);
    map.get(fromAlias)?.push(actionAlias);
  }
  return map;
});

const dataSummary = computed(() => ({
  rows: rows.value.length,
  selected:
    selectionMode.value === 'filtered' && filteredSelection.value
      ? filteredSelection.value.count
      : selectedIds.value.length,
  total: total.value,
}));

const canSelectAllFiltered = computed(
  () => selectionMode.value === 'explicit' && total.value > 0
);

const canBulkApproveSelection = computed(() =>
  selectionMode.value === 'filtered'
    ? dataSummary.value.selected > 0
    : selectedApprovableIds.value.length > 0
);

const canBulkDeleteSelection = computed(() =>
  selectionMode.value === 'filtered'
    ? dataSummary.value.selected > 0
    : selectedDeletableIds.value.length > 0
);

const deleteModalCount = computed(
  () => deleteModalSelection.value?.count || deleteModalIds.value.length
);

const selectedRowMap = computed(
  () => new Map((rows.value || []).map((row) => [String(row.id), row]))
);

const selectedApprovableIds = computed(() =>
  [
    ...new Set(selectedIds.value.map((id) => String(id)).filter(Boolean)),
  ].filter((id) => canApproveDocument(selectedRowMap.value.get(id)))
);

const selectedDeletableIds = computed(() =>
  [
    ...new Set(selectedIds.value.map((id) => String(id)).filter(Boolean)),
  ].filter((id) => canDeleteDocument(selectedRowMap.value.get(id)))
);

const activeFilterItems = computed(() => {
  const items: Array<{ key: string; label: string; value: string }> = [];
  const push = (key: string, label: string, value: unknown) => {
    const normalized = resolveFilterValue(key, value);
    if (!normalized) return;
    items.push({
      key,
      label,
      value: displayFilterValue(key, normalized),
    });
  };

  push('search', 'Поиск', filters.search);
  push('number', 'Номер', filters.number);
  push('fare_code', 'Тариф', filters.fare_code);
  push('status', 'Статус', filters.status);
  push('source', 'Источник', filters.source);
  push('date_from', 'Дата от', filters.date_from);
  push('date_to', 'Дата до', filters.date_to);
  push('amount_from', 'Сумма от', filters.amount_from);
  push('amount_to', 'Сумма до', filters.amount_to);

  return items;
});

const activeFilterCount = computed(() => activeFilterItems.value.length);

function normalizeRubInput(value: unknown): string {
  const text = String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(',', '.');
  if (!text) return '0.00';
  const number = Number(text);
  if (!Number.isFinite(number)) return '0.00';
  return number.toFixed(2);
}

function formatRub(value: unknown): string {
  const number = Number(String(value ?? 0).replace(',', '.'));
  if (!Number.isFinite(number)) return '0,00';
  return number.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusName(status: any): string {
  return status?.name_ru || status?.alias || '—';
}

function actionName(alias: string): string {
  const found = (refData.actions || []).find((item) => item.alias === alias);
  return found?.name_ru || alias;
}

function auditActionName(value: string): string {
  const text = String(value || '');
  if (text.startsWith('ACTION_')) {
    return actionName(text.slice('ACTION_'.length));
  }
  if (text === 'CREATE_ADJUSTMENT') return 'Создана корректировка';
  return text;
}

function statusBadgeClass(statusAlias: string): string {
  if (statusAlias === 'ACCRUED') return 'text-bg-success';
  if (statusAlias === 'DRAFT') return 'text-bg-secondary';
  if (statusAlias === 'DELETED') return 'text-bg-danger';
  return 'text-bg-secondary';
}

function fullName(person: any): string {
  if (!person) return '';
  return [person.last_name, person.first_name, person.patronymic]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function formatDateTime(value: unknown): string {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function canApproveDocument(row: any): boolean {
  if (!row) return false;
  const current = String(row?.status?.alias || '');
  if (current !== 'DRAFT') return false;
  const aliases = actionAliasesByStatus.value.get(current) || ['APPROVE'];
  return aliases.includes('APPROVE');
}

function canDeleteDocument(row: any): boolean {
  return ['DRAFT', 'ACCRUED'].includes(String(row?.status?.alias || ''));
}

function canCreateAdjustment(document: any): boolean {
  return String(document?.status?.alias || '') === 'ACCRUED';
}

function deletableIdsFromCurrentRows(ids: string[]): string[] {
  const map = new Map(
    (rows.value || []).map((row) => [
      String(row.id),
      String(row?.status?.alias || ''),
    ])
  );
  return [...new Set(ids.map((id) => String(id)).filter(Boolean))].filter(
    (id) => ['DRAFT', 'ACCRUED'].includes(String(map.get(id) || ''))
  );
}

function displayFilterValue(key: string, value: string): string {
  if (key === 'status') {
    const status = (refData.statuses || []).find(
      (item) => item.alias === value
    );
    return status?.name_ru || value;
  }
  if (key === 'source') {
    const source = (refData.sources || []).find((item) => item.alias === value);
    return source?.name_ru || value;
  }
  if (key === 'amount_from' || key === 'amount_to') {
    return `${formatRub(value)} ₽`;
  }
  return value;
}

function resolveFilterValue(key: string, value: unknown): string {
  const text = String(value || '').trim();
  if (!text) return '';
  if (key === 'amount_from' || key === 'amount_to') {
    return normalizeRubInput(text);
  }
  if (key === 'fare_code') return text.toUpperCase();
  return text;
}

function buildQueryParams(): URLSearchParams {
  const params = new URLSearchParams({
    page: String(page.value),
    limit: String(limit.value),
  });
  for (const [key, value] of Object.entries(filters)) {
    const normalized = resolveFilterValue(key, value);
    if (normalized) params.set(key, normalized);
  }
  return params;
}

function buildFilterSnapshot(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    const normalized = resolveFilterValue(key, value);
    if (normalized) snapshot[key] = normalized;
  }
  return snapshot;
}

function buildBulkSelectionPayload(ids = selectedIds.value) {
  if (selectionMode.value === 'filtered' && filteredSelection.value) {
    return {
      selection_mode: 'filtered',
      filters: filteredSelection.value.filters,
    };
  }
  return {
    selection_mode: 'explicit',
    ids: [...new Set((ids || []).map((id) => String(id)).filter(Boolean))],
  };
}

async function loadRefData(): Promise<void> {
  refDataLoading.value = true;
  refDataError.value = '';
  try {
    const response = await apiFetch('/admin/accounting/ref-data');
    refData.statuses = response.document_statuses || [];
    refData.sources = response.accrual_sources || [];
    refData.actions = response.actions || [];
    refData.transitions = response.status_transitions || [];
  } catch (err: any) {
    refDataError.value = err?.message || 'Не удалось загрузить справочники';
  } finally {
    refDataLoading.value = false;
  }
}

async function loadAccruals(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    if (
      selectionMode.value === 'filtered' &&
      JSON.stringify(filteredSelection.value?.filters || {}) !==
        JSON.stringify(buildFilterSnapshot())
    ) {
      clearSelection();
    }
    const response = await apiFetch(
      `/admin/accounting/referee-accruals?${buildQueryParams().toString()}`
    );
    rows.value = response.accruals || [];
    total.value = Number(response.total || 0);

    const idsOnPage = new Set(rows.value.map((row) => String(row.id)));
    selectedIds.value = selectedIds.value.filter((id) => idsOnPage.has(id));
    if (selectedDocumentId.value && !idsOnPage.has(selectedDocumentId.value)) {
      selectedDocumentId.value = '';
      selectedDocument.value = null;
      selectedAuditEvents.value = [];
    }
    if (!selectedDocumentId.value && rows.value.length) {
      void openDocument(rows.value[0].id);
    }
  } catch (err: any) {
    rows.value = [];
    total.value = 0;
    error.value = err?.message || 'Не удалось загрузить начисления';
  } finally {
    loading.value = false;
  }
}

function submitFilters(): void {
  if (page.value !== 1) {
    page.value = 1;
    return;
  }
  void loadAccruals();
}

function removeFilter(key: string): void {
  if (!Object.hasOwn(filters, key)) return;
  filters[key] = '';
  submitFilters();
}

function toggleSelectAllOnPage(): void {
  if (selectionMode.value === 'filtered') return;
  if (selectedAllOnPage.value) {
    const idsOnPage = new Set(rows.value.map((row) => String(row.id)));
    selectedIds.value = selectedIds.value.filter((id) => !idsOnPage.has(id));
    return;
  }
  const next = new Set(selectedIds.value);
  for (const row of rows.value) next.add(String(row.id));
  selectedIds.value = [...next];
}

function toggleRow(rowId: string): void {
  if (selectionMode.value === 'filtered') return;
  const id = String(rowId);
  const set = new Set(selectedIds.value);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  selectedIds.value = [...set];
}

function clearSelection(): void {
  selectionMode.value = 'explicit';
  filteredSelection.value = null;
  selectedIds.value = [];
}

function selectAllFiltered(): void {
  selectionMode.value = 'filtered';
  filteredSelection.value = {
    count: total.value,
    filters: buildFilterSnapshot(),
  };
}

async function openDocument(id: string): Promise<void> {
  if (!id) return;
  selectedDocumentId.value = String(id);
  detailLoading.value = true;
  detailError.value = '';
  try {
    const response = await apiFetch(`/admin/accounting/referee-accruals/${id}`);
    selectedDocument.value = response.document || null;
    selectedAuditEvents.value = response.audit_events || [];
  } catch (err: any) {
    selectedDocument.value = null;
    selectedAuditEvents.value = [];
    detailError.value =
      err?.message || 'Не удалось загрузить карточку начисления';
  } finally {
    detailLoading.value = false;
  }
}

async function runAction(id: string, actionAlias: string) {
  if (!id) return;
  actionLoading.value = `${actionAlias}:${id}`;
  try {
    await apiFetch(`/admin/accounting/referee-accruals/${id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_alias: actionAlias }),
    });
    showToast(`Действие выполнено: ${actionName(actionAlias)}`);
    await Promise.all([
      loadAccruals(),
      selectedDocumentId.value === id ? openDocument(id) : Promise.resolve(),
    ]);
  } catch (err: any) {
    error.value = err?.message || 'Не удалось выполнить действие';
  } finally {
    actionLoading.value = '';
  }
}

async function runBulkAction(actionAlias: string, ids = selectedIds.value) {
  const selectionPayload = buildBulkSelectionPayload(ids);
  const uniqueIds = selectionPayload.ids || [];
  if (selectionPayload.selection_mode !== 'filtered' && !uniqueIds.length) {
    return;
  }
  actionLoading.value = `bulk:${actionAlias}`;
  try {
    const response = await apiFetch(
      '/admin/accounting/referee-accruals/bulk-action',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectionPayload,
          action_alias: actionAlias,
        }),
      }
    );
    const success = Number(response?.success || 0);
    const failed = Number(response?.failed || 0);
    showToast(
      failed > 0
        ? `Обработано: ${success}, ошибок: ${failed}`
        : `Обработано документов: ${success}`
    );
    clearSelection();
    await loadAccruals();
    if (selectedDocumentId.value) {
      await openDocument(selectedDocumentId.value);
    }
  } catch (err: any) {
    error.value = err?.message || 'Не удалось выполнить массовую операцию';
  } finally {
    actionLoading.value = '';
  }
}

function runBulkApproveSelection(): void {
  if (!canBulkApproveSelection.value) {
    error.value =
      'Для начисления выберите хотя бы один документ в статусе «Черновик»';
    return;
  }
  void runBulkAction(
    'APPROVE',
    selectionMode.value === 'filtered' ? [] : selectedApprovableIds.value
  );
}

function openDeleteModal(ids: string[]): void {
  if (!ids.length) return;
  deleteModalIds.value = [
    ...new Set(ids.map((id) => String(id)).filter(Boolean)),
  ];
  deleteModalSelection.value = null;
  deleteModalForm.reason_code = '';
  deleteModalForm.comment = '';
  deleteError.value = '';
  deleteModalOpen.value = true;
}

function openDeleteForSelection(): void {
  if (selectionMode.value === 'filtered' && filteredSelection.value) {
    deleteModalIds.value = [];
    deleteModalSelection.value = {
      count: filteredSelection.value.count,
      selectionMode: 'filtered',
      filters: filteredSelection.value.filters,
    };
    deleteModalForm.reason_code = '';
    deleteModalForm.comment = '';
    deleteError.value = '';
    deleteModalOpen.value = true;
    return;
  }
  const deletableIds = deletableIdsFromCurrentRows(selectedIds.value);
  if (!deletableIds.length) {
    error.value =
      'Удаление доступно только для документов в статусах «Черновик» и «Начислено»';
    return;
  }
  openDeleteModal(deletableIds);
}

function closeDeleteModal(): void {
  deleteModalOpen.value = false;
  deleteModalIds.value = [];
  deleteModalSelection.value = null;
  deleteModalForm.reason_code = '';
  deleteModalForm.comment = '';
  deleteError.value = '';
}

async function submitDeleteModal(): Promise<void> {
  if (!deleteModalIds.value.length && !deleteModalSelection.value) return;
  deleteLoading.value = true;
  deleteError.value = '';
  try {
    const ids = [...deleteModalIds.value];
    if (!deleteModalSelection.value && ids.length === 1) {
      await apiFetch(`/admin/accounting/referee-accruals/${ids[0]}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason_code: deleteModalForm.reason_code,
          comment: deleteModalForm.comment || null,
        }),
      });
      showToast('Начисление удалено');
    } else {
      const selectionPayload =
        deleteModalSelection.value?.selectionMode === 'filtered'
          ? {
              selection_mode: 'filtered',
              filters: deleteModalSelection.value.filters,
            }
          : {
              selection_mode: 'explicit',
              ids,
            };
      const response = await apiFetch(
        '/admin/accounting/referee-accruals/bulk-delete',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...selectionPayload,
            reason_code: deleteModalForm.reason_code,
            comment: deleteModalForm.comment || null,
          }),
        }
      );
      const success = Number(response?.success || 0);
      const failed = Number(response?.failed || 0);
      showToast(
        failed > 0
          ? `Удалено: ${success}, ошибок: ${failed}`
          : `Удалено документов: ${success}`
      );
    }
    closeDeleteModal();
    clearSelection();
    await loadAccruals();
    if (selectedDocumentId.value) {
      await openDocument(selectedDocumentId.value);
    }
  } catch (err: any) {
    deleteError.value = err?.message || 'Не удалось удалить начисления';
  } finally {
    deleteLoading.value = false;
  }
}

async function createAdjustment(): Promise<void> {
  if (
    !selectedDocument.value?.id ||
    !canCreateAdjustment(selectedDocument.value)
  ) {
    return;
  }
  adjustmentLoading.value = true;
  adjustmentError.value = '';
  try {
    const response = await apiFetch(
      `/admin/accounting/referee-accruals/${selectedDocument.value.id}/adjust`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_amount_rub: normalizeRubInput(adjustmentForm.base_amount_rub),
          meal_amount_rub: normalizeRubInput(adjustmentForm.meal_amount_rub),
          travel_amount_rub: normalizeRubInput(
            adjustmentForm.travel_amount_rub
          ),
          reason_code: adjustmentForm.reason_code,
          comment: adjustmentForm.comment || null,
        }),
      }
    );
    showToast('Корректировка применена');
    adjustmentForm.base_amount_rub = '0,00';
    adjustmentForm.meal_amount_rub = '0,00';
    adjustmentForm.travel_amount_rub = '0,00';
    adjustmentForm.reason_code = '';
    adjustmentForm.comment = '';
    if (response?.document?.id) {
      await openDocument(response.document.id);
    } else {
      await openDocument(selectedDocument.value.id);
    }
    await loadAccruals();
  } catch (err: any) {
    adjustmentError.value =
      err?.message || 'Не удалось применить корректировку';
  } finally {
    adjustmentLoading.value = false;
  }
}

function resetFilters(): void {
  filters.tournament_id = '';
  filters.search = '';
  filters.number = '';
  filters.fare_code = '';
  filters.status = '';
  filters.source = '';
  filters.date_from = '';
  filters.date_to = '';
  filters.amount_from = '';
  filters.amount_to = '';
  showAdvancedFilters.value = false;
  submitFilters();
}

async function exportCsv(): Promise<void> {
  try {
    const query = buildQueryParams().toString();
    const blob = await apiFetchBlob(
      `/admin/accounting/referee-accruals/export.csv?${query}`
    );
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'referee-accruals-rub.csv';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  } catch (err: any) {
    error.value = err?.message || 'Не удалось выгрузить CSV';
  }
}

watch(page, () => {
  void loadAccruals();
});

watch(limit, () => {
  if (page.value !== 1) {
    page.value = 1;
    return;
  }
  void loadAccruals();
});

onMounted(async () => {
  filters.tournament_id = String(route.query['tournament_id'] || '').trim();
  filters.number = String(route.query['number'] || '').trim();
  if (!filters.number) {
    filters.search = String(route.query['search'] || '').trim();
  }
  if (filters.tournament_id || filters.number || filters.search) {
    showAdvancedFilters.value = Boolean(filters.number);
  }
  await loadRefData();
  await loadAccruals();
});
</script>

<template>
  <div class="py-4">
    <div class="container-fluid accounting-desktop px-2 px-xl-3">
      <div class="card section-card tile fade-in shadow-sm">
        <div class="card-body d-flex flex-column gap-3">
          <div
            class="d-flex justify-content-between align-items-center flex-wrap gap-2"
          >
            <div>
              <h1 class="h5 mb-1">Бухгалтерия</h1>
              <div class="small text-muted">
                Реестр начислений судьям и контроль проведения
              </div>
            </div>
            <button
              type="button"
              class="btn btn-outline-brand"
              @click="exportCsv"
            >
              Экспорт CSV
            </button>
          </div>

          <div
            class="d-flex flex-wrap gap-2 align-items-center small text-muted"
          >
            <span>Всего документов: {{ dataSummary.total }}</span>
            <span>На странице: {{ dataSummary.rows }}</span>
            <span>Выбрано: {{ dataSummary.selected }}</span>
          </div>

          <div v-if="refDataError" class="alert alert-danger mb-0 py-2">
            {{ refDataError }}
          </div>

          <form
            class="border rounded-3 p-3 sticky-tools"
            @submit.prevent="submitFilters"
          >
            <div class="row g-2 align-items-end">
              <div class="col-12 col-lg-4">
                <label class="form-label">Быстрый поиск</label>
                <input
                  v-model="filters.search"
                  type="search"
                  class="form-control"
                  placeholder="№, исходный №, судья, турнир, матч, статус"
                />
              </div>
              <div class="col-6 col-lg-2">
                <label class="form-label">Период от</label>
                <input
                  v-model="filters.date_from"
                  type="date"
                  class="form-control"
                />
              </div>
              <div class="col-6 col-lg-2">
                <label class="form-label">Период до</label>
                <input
                  v-model="filters.date_to"
                  type="date"
                  class="form-control"
                />
              </div>
              <div class="col-6 col-lg-2">
                <label class="form-label">Статус</label>
                <select v-model="filters.status" class="form-select">
                  <option value="">Все</option>
                  <option
                    v-for="status in refData.statuses"
                    :key="status.id"
                    :value="status.alias"
                  >
                    {{ status.name_ru }}
                  </option>
                </select>
              </div>
              <div class="col-6 col-lg-2 d-flex gap-2">
                <button type="submit" class="btn btn-brand w-100">Найти</button>
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  :aria-pressed="showAdvancedFilters"
                  @click="showAdvancedFilters = !showAdvancedFilters"
                >
                  Фильтры
                  <span
                    v-if="activeFilterCount"
                    class="badge text-bg-light ms-1"
                  >
                    {{ activeFilterCount }}
                  </span>
                </button>
              </div>
            </div>

            <div
              v-if="showAdvancedFilters"
              class="row g-2 align-items-end mt-1"
            >
              <div class="col-12 col-lg-2">
                <label class="form-label">№ начисления</label>
                <input
                  v-model="filters.number"
                  type="search"
                  class="form-control"
                />
              </div>
              <div class="col-12 col-lg-2">
                <label class="form-label">Код тарифа</label>
                <input
                  v-model="filters.fare_code"
                  type="search"
                  class="form-control"
                />
              </div>
              <div class="col-6 col-lg-2">
                <label class="form-label">Источник</label>
                <select v-model="filters.source" class="form-select">
                  <option value="">Все</option>
                  <option
                    v-for="source in refData.sources"
                    :key="source.id"
                    :value="source.alias"
                  >
                    {{ source.name_ru }}
                  </option>
                </select>
              </div>
              <div class="col-6 col-lg-2">
                <label class="form-label">Сумма от, ₽</label>
                <input
                  v-model="filters.amount_from"
                  type="text"
                  class="form-control"
                  placeholder="0,00"
                />
              </div>
              <div class="col-6 col-lg-2">
                <label class="form-label">Сумма до, ₽</label>
                <input
                  v-model="filters.amount_to"
                  type="text"
                  class="form-control"
                  placeholder="0,00"
                />
              </div>
              <div class="col-6 col-lg-2">
                <button
                  type="button"
                  class="btn btn-outline-brand w-100"
                  @click="submitFilters"
                >
                  Применить
                </button>
              </div>
              <div class="col-6 col-lg-2">
                <button
                  type="button"
                  class="btn btn-outline-secondary w-100"
                  @click="resetFilters"
                >
                  Сбросить
                </button>
              </div>
            </div>

            <div
              v-if="activeFilterItems.length"
              class="d-flex flex-wrap gap-2 mt-3"
            >
              <button
                v-for="item in activeFilterItems"
                :key="item.key"
                type="button"
                class="btn btn-sm btn-filter-chip"
                :aria-label="`Убрать фильтр ${item.label}`"
                @click="removeFilter(item.key)"
              >
                <span class="fw-semibold">{{ item.label }}:</span>
                <span>{{ item.value }}</span>
                <i class="bi bi-x-lg" aria-hidden="true"></i>
              </button>
            </div>
          </form>

          <div class="d-flex flex-wrap gap-2 align-items-center">
            <button
              v-if="canSelectAllFiltered"
              type="button"
              class="btn btn-outline-brand btn-sm"
              @click="selectAllFiltered"
            >
              Выбрать все ({{ total }})
            </button>
            <button
              v-if="approveBulkAction"
              type="button"
              class="btn btn-outline-success btn-sm action-icon-btn"
              :disabled="
                refDataLoading ||
                !canBulkApproveSelection ||
                actionLoading.startsWith('bulk:')
              "
              :title="approveBulkAction.name_ru"
              :aria-label="approveBulkAction.name_ru"
              @click="runBulkApproveSelection"
            >
              <i class="bi bi-check2-circle" aria-hidden="true"></i>
              <span
                v-if="
                  selectionMode === 'filtered'
                    ? dataSummary.selected
                    : selectedApprovableIds.length
                "
                class="badge text-bg-light border ms-1"
              >
                {{
                  selectionMode === 'filtered'
                    ? dataSummary.selected
                    : selectedApprovableIds.length
                }}
              </span>
            </button>
            <button
              type="button"
              class="btn btn-outline-danger btn-sm action-icon-btn"
              :disabled="!canBulkDeleteSelection || deleteLoading"
              title="Удалить выбранные начисления"
              aria-label="Удалить выбранные начисления"
              @click="openDeleteForSelection"
            >
              <i class="bi bi-trash3" aria-hidden="true"></i>
              <span
                v-if="
                  selectionMode === 'filtered'
                    ? dataSummary.selected
                    : selectedDeletableIds.length
                "
                class="badge text-bg-light border ms-1"
              >
                {{
                  selectionMode === 'filtered'
                    ? dataSummary.selected
                    : selectedDeletableIds.length
                }}
              </span>
            </button>
            <span
              v-if="dataSummary.selected"
              class="badge text-bg-light border"
            >
              Выбрано: {{ dataSummary.selected }}
            </span>
            <span
              v-if="selectionMode === 'filtered' && filteredSelection"
              class="badge bg-primary-subtle text-primary border"
            >
              Выбраны все начисления в текущем наборе
            </span>
            <button
              type="button"
              class="btn btn-link btn-sm"
              @click="clearSelection"
            >
              Снять выделение
            </button>
          </div>

          <div v-if="error" class="alert alert-danger mb-0">{{ error }}</div>
          <BrandSpinner v-if="loading" label="Загрузка начислений" />

          <div v-else class="row g-3">
            <div class="col-12 col-xxl-8">
              <div class="table-responsive border rounded-3 desktop-table-wrap">
                <table class="table table-sm align-middle mb-0 desktop-table">
                  <thead>
                    <tr>
                      <th class="text-center" style="width: 42px">
                        <input
                          class="form-check-input"
                          type="checkbox"
                          :checked="selectedAllOnPage"
                          :disabled="selectionMode === 'filtered'"
                          aria-label="Выделить все документы на странице"
                          @change="toggleSelectAllOnPage"
                        />
                      </th>
                      <th>№ начисления</th>
                      <th style="min-width: 110px">Дата</th>
                      <th style="min-width: 160px">Судья</th>
                      <th style="min-width: 230px">Матч</th>
                      <th style="min-width: 90px">Код</th>
                      <th class="text-end" style="min-width: 120px">
                        Итого, ₽
                      </th>
                      <th style="min-width: 130px">Статус</th>
                      <th class="text-end" style="min-width: 120px">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="row in rows"
                      :key="row.id"
                      class="accrual-row"
                      :class="{
                        'table-active': selectedDocumentId === String(row.id),
                      }"
                      @click="openDocument(row.id)"
                    >
                      <td class="text-center">
                        <input
                          class="form-check-input"
                          type="checkbox"
                          :checked="
                            selectionMode === 'filtered' ||
                            selectedIds.includes(String(row.id))
                          "
                          :disabled="selectionMode === 'filtered'"
                          :aria-label="`Выделить начисление ${row.accrual_number}`"
                          @click.stop
                          @change="toggleRow(row.id)"
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          class="btn btn-link btn-sm p-0"
                          :aria-label="`Открыть карточку ${row.accrual_number}`"
                          @click.stop
                          @click="openDocument(row.id)"
                        >
                          {{ row.accrual_number }}
                        </button>
                      </td>
                      <td>{{ row.match_date_snapshot || '—' }}</td>
                      <td>
                        {{ row.referee?.last_name || '' }}
                        {{ row.referee?.first_name || '' }}
                      </td>
                      <td>
                        {{ row.match?.home_team?.name || '—' }} -
                        {{ row.match?.away_team?.name || '—' }}
                      </td>
                      <td>
                        <span class="badge text-bg-light border">{{
                          row.fare_code_snapshot
                        }}</span>
                      </td>
                      <td class="text-end">
                        {{ formatRub(row.total_amount_rub) }}
                      </td>
                      <td>
                        <span
                          class="badge"
                          :class="
                            statusBadgeClass(String(row.status?.alias || ''))
                          "
                        >
                          {{ statusName(row.status) }}
                        </span>
                      </td>
                      <td class="text-end">
                        <div
                          class="d-inline-flex flex-wrap justify-content-end gap-1"
                        >
                          <button
                            v-if="canApproveDocument(row)"
                            type="button"
                            class="btn btn-outline-success btn-sm action-icon-btn"
                            :disabled="actionLoading === `APPROVE:${row.id}`"
                            :title="`Начислить ${row.accrual_number}`"
                            :aria-label="`Начислить ${row.accrual_number}`"
                            @click.stop="runAction(row.id, 'APPROVE')"
                          >
                            <i
                              class="bi bi-check2-circle"
                              aria-hidden="true"
                            ></i>
                          </button>
                          <button
                            v-if="canDeleteDocument(row)"
                            type="button"
                            class="btn btn-outline-danger btn-sm action-icon-btn"
                            :disabled="deleteLoading"
                            :title="`Удалить ${row.accrual_number}`"
                            :aria-label="`Удалить ${row.accrual_number}`"
                            @click.stop="openDeleteModal([row.id])"
                          >
                            <i class="bi bi-trash3" aria-hidden="true"></i>
                          </button>
                        </div>
                        <span
                          v-if="
                            !canApproveDocument(row) && !canDeleteDocument(row)
                          "
                          class="small text-muted"
                          >Нет действий</span
                        >
                      </td>
                    </tr>
                    <tr v-if="!rows.length">
                      <td colspan="9" class="text-center text-muted">
                        Начисления не найдены
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <PageNav
                :page="page"
                :total-pages="totalPages"
                :page-size="limit"
                :sizes="[20, 50, 100]"
                @update:page="(value) => (page = value)"
                @update:page-size="(value) => (limit = value)"
              />
            </div>

            <div class="col-12 col-xxl-4">
              <div class="border rounded-3 p-3 detail-card">
                <div class="fw-semibold mb-2">Карточка начисления</div>
                <div v-if="detailError" class="alert alert-danger py-2">
                  {{ detailError }}
                </div>
                <BrandSpinner
                  v-else-if="detailLoading"
                  label="Загрузка карточки"
                />

                <template v-else-if="selectedDocument">
                  <div class="small mb-3 d-flex flex-column gap-1">
                    <div>
                      <strong>№:</strong> {{ selectedDocument.accrual_number }}
                    </div>
                    <div>
                      <strong>Статус:</strong>
                      <span
                        class="badge"
                        :class="
                          statusBadgeClass(
                            String(selectedDocument.status?.alias || '')
                          )
                        "
                      >
                        {{ statusName(selectedDocument.status) }}
                      </span>
                    </div>
                    <div>
                      <strong>Турнир:</strong>
                      {{ selectedDocument.tournament?.name || '—' }}
                    </div>
                    <div>
                      <strong>Матч:</strong>
                      {{ selectedDocument.match?.home_team?.name || '—' }} -
                      {{ selectedDocument.match?.away_team?.name || '—' }}
                    </div>
                    <div>
                      <strong>Судья:</strong>
                      {{ fullName(selectedDocument.referee) || '—' }}
                    </div>
                    <div>
                      <strong>Код тарифа:</strong>
                      {{ selectedDocument.fare_code_snapshot }}
                    </div>
                    <div>
                      <strong>Итого:</strong>
                      {{ formatRub(selectedDocument.total_amount_rub) }} ₽
                    </div>
                  </div>

                  <div class="small mb-3">
                    <div class="fw-semibold mb-1">Проводки</div>
                    <div
                      v-if="selectedDocument.postings?.length"
                      class="d-flex flex-column gap-1"
                    >
                      <div
                        v-for="line in selectedDocument.postings"
                        :key="line.id"
                        class="d-flex justify-content-between gap-3"
                      >
                        <span>
                          {{ line.posting_type?.name_ru || '—' }} /
                          {{ line.component?.name_ru || '—' }}
                          <template v-if="line.reason_code">
                            · {{ line.reason_code }}
                          </template>
                          <template v-if="line.comment">
                            · {{ line.comment }}
                          </template>
                        </span>
                        <span>{{ formatRub(line.amount_rub) }} ₽</span>
                      </div>
                    </div>
                    <div v-else class="text-muted">Проводок нет</div>
                  </div>

                  <div class="small mb-3">
                    <div class="fw-semibold mb-1">
                      Корректировать начисление
                    </div>
                    <div
                      v-if="canCreateAdjustment(selectedDocument)"
                      class="row g-2"
                    >
                      <div class="col-12 col-md-4">
                        <label class="form-label">База, ₽</label>
                        <input
                          v-model="adjustmentForm.base_amount_rub"
                          type="text"
                          class="form-control form-control-sm"
                          placeholder="0,00"
                        />
                      </div>
                      <div class="col-12 col-md-4">
                        <label class="form-label">Питание, ₽</label>
                        <input
                          v-model="adjustmentForm.meal_amount_rub"
                          type="text"
                          class="form-control form-control-sm"
                          placeholder="0,00"
                        />
                      </div>
                      <div class="col-12 col-md-4">
                        <label class="form-label">Проезд, ₽</label>
                        <input
                          v-model="adjustmentForm.travel_amount_rub"
                          type="text"
                          class="form-control form-control-sm"
                          placeholder="0,00"
                        />
                      </div>
                      <div class="col-12">
                        <label class="form-label">Код причины</label>
                        <input
                          v-model="adjustmentForm.reason_code"
                          type="text"
                          class="form-control form-control-sm"
                        />
                      </div>
                      <div class="col-12">
                        <label class="form-label">Комментарий</label>
                        <textarea
                          v-model="adjustmentForm.comment"
                          class="form-control form-control-sm"
                          rows="2"
                        ></textarea>
                      </div>
                      <div class="col-12">
                        <button
                          type="button"
                          class="btn btn-brand btn-sm w-100"
                          :disabled="adjustmentLoading"
                          @click="createAdjustment"
                        >
                          Применить корректировку
                        </button>
                      </div>
                      <div
                        v-if="adjustmentError"
                        class="col-12 text-danger small"
                      >
                        {{ adjustmentError }}
                      </div>
                    </div>
                    <div v-else class="text-muted">
                      Корректировка доступна только для начисленного документа.
                    </div>
                  </div>

                  <div class="small">
                    <div class="fw-semibold mb-1">Аудит</div>
                    <div
                      v-if="selectedAuditEvents.length"
                      class="timeline-list d-flex flex-column gap-1"
                    >
                      <div
                        v-for="event in selectedAuditEvents"
                        :key="event.id"
                        class="text-muted"
                      >
                        {{ formatDateTime(event.created_at) }} ·
                        {{ auditActionName(event.action) }} ·
                        {{ fullName(event.actor) || 'Система' }}
                      </div>
                    </div>
                    <div v-else class="text-muted">События отсутствуют</div>
                  </div>
                </template>

                <div v-else class="small text-muted">
                  Выберите начисление в таблице
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div
    v-if="deleteModalOpen"
    class="modal fade show d-block"
    tabindex="-1"
    role="dialog"
    aria-modal="true"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title h6 mb-0">Удаление начислений</h2>
          <button
            type="button"
            class="btn-close"
            aria-label="Закрыть"
            :disabled="deleteLoading"
            @click="closeDeleteModal"
          ></button>
        </div>
        <div class="modal-body">
          <p class="small text-muted mb-2">
            Документы будут удалены из пользовательского интерфейса без
            возможности восстановления. Для исходного начисления с
            корректировками удаление недоступно.
          </p>
          <p class="small mb-3">
            Количество документов: <strong>{{ deleteModalCount }}</strong>
          </p>
          <div class="mb-2">
            <label class="form-label">Код причины</label>
            <input
              v-model="deleteModalForm.reason_code"
              type="text"
              class="form-control"
              maxlength="64"
              placeholder="DEL_DRAFT"
            />
          </div>
          <div>
            <label class="form-label">Комментарий</label>
            <textarea
              v-model="deleteModalForm.comment"
              class="form-control"
              rows="3"
              maxlength="1000"
            ></textarea>
          </div>
          <div v-if="deleteError" class="text-danger small mt-2">
            {{ deleteError }}
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            :disabled="deleteLoading"
            @click="closeDeleteModal"
          >
            Отмена
          </button>
          <button
            type="button"
            class="btn btn-danger"
            :disabled="deleteLoading"
            @click="submitDeleteModal"
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  </div>
  <div v-if="deleteModalOpen" class="modal-backdrop fade show"></div>
</template>

<style scoped>
.desktop-table-wrap {
  max-height: calc(100vh - 320px);
  min-height: 360px;
}

.desktop-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #fff;
}

.sticky-tools {
  position: sticky;
  top: 10px;
  z-index: 3;
  background: #fff;
  box-shadow: inset 0 -1px 0 rgba(17, 56, 103, 0.08);
}

.accrual-row {
  cursor: pointer;
}

.accrual-row:hover td {
  background-color: rgba(17, 56, 103, 0.03);
}

.action-icon-btn {
  min-width: 2.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.action-icon-btn .bi {
  font-size: 1rem;
  line-height: 1;
}

.btn-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid rgba(17, 56, 103, 0.16);
  background: rgba(17, 56, 103, 0.04);
  color: #113867;
}

.btn-filter-chip:hover {
  background: rgba(17, 56, 103, 0.08);
}

.detail-card {
  position: sticky;
  top: 10px;
  max-height: calc(100vh - 170px);
  overflow: auto;
}

.timeline-list {
  max-height: 180px;
  overflow: auto;
}

@media (max-width: 1399.98px) {
  .detail-card {
    position: static;
    max-height: none;
  }
}

@media (max-width: 991.98px) {
  .desktop-table-wrap {
    max-height: none;
    min-height: 0;
  }
}
</style>
