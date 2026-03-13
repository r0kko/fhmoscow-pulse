<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';

import { apiFetch } from '../../api';
import PageNav from '../PageNav.vue';
import TabSelector from '../TabSelector.vue';
import BrandSpinner from '../BrandSpinner.vue';
import {
  findOrganizationsByInn,
  type OrganizationSuggestion,
} from '../../dadata';
import { documentStatusBadgeClass } from '../../utils/documentStatus';
import { useToast } from '../../utils/toast';

type ClosingTabKey = 'prepare' | 'documents';

interface PartySnapshot {
  name?: string | null;
  short_name?: string | null;
  full_name?: string | null;
  inn?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
  address?: string | null;
  position?: string | null;
  email?: string | null;
}

interface ContractSnapshot {
  document_id?: string | null;
  number?: string | null;
  document_date?: string | null;
  title?: string | null;
}

interface TotalsSnapshot {
  items_count?: number;
  total_amount_rub?: string;
  total_amount_words?: string;
  vat_label?: string | null;
}

interface ClosingItemSnapshot {
  line_no?: number | null;
  accrual_id?: string | null;
  service_datetime?: string | null;
  service_name?: string | null;
  match_label?: string | null;
  competition_name?: string | null;
  role_name?: string | null;
  tariff_label?: string | null;
  amount_rub?: string | null;
  total_amount_rub?: string | null;
}

interface ClosingProfileResponse {
  profile?: {
    organizer?: {
      inn?: string | null;
      name?: string | null;
      short_name?: string | null;
      kpp?: string | null;
      ogrn?: string | null;
      address?: string | null;
    } | null;
    organizer_json?: OrganizationSuggestion | null;
    last_verified_at?: string | null;
  } | null;
}

interface AccrualRow {
  id: string;
  accrual_number: string;
  match_date_snapshot: string | null;
  total_amount_rub: string;
  fare_code_snapshot: string;
  status?: { alias?: string; name_ru?: string } | null;
  referee?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    patronymic?: string | null;
  } | null;
  referee_role?: { name?: string | null } | null;
  match?: {
    home_team?: { name?: string | null } | null;
    away_team?: { name?: string | null } | null;
  } | null;
}

interface AccrualListResponse {
  accruals?: AccrualRow[];
  total?: number;
  summary?: {
    total_amount_rub?: string;
  } | null;
}

interface ClosingSelectionFilters {
  status: string;
  search?: string;
  date_from?: string;
  date_to?: string;
}

interface PreviewGroup {
  referee?: {
    id?: string;
    full_name?: string | null;
    email?: string | null;
  } | null;
  customer_snapshot?: PartySnapshot | null;
  performer_snapshot?: PartySnapshot | null;
  contract_snapshot?: ContractSnapshot | null;
  fhmo_signer_snapshot?: PartySnapshot | null;
  totals?: TotalsSnapshot | null;
  items?: ClosingItemSnapshot[];
  issues?: string[];
  accrual_ids?: string[];
}

interface PreviewResponse {
  profile?: {
    organizer?: {
      inn?: string | null;
      name?: string | null;
      short_name?: string | null;
      kpp?: string | null;
      ogrn?: string | null;
      address?: string | null;
    } | null;
  } | null;
  fhmo_signer?: {
    full_name?: string | null;
    position?: string | null;
  } | null;
  ready_groups?: PreviewGroup[];
  blocked_groups?: PreviewGroup[];
  summary?: {
    selection_mode?: 'explicit' | 'filtered';
    selected_total?: number;
    selected_amount_rub?: string;
    ready_groups?: number;
    blocked_groups?: number;
  } | null;
}

interface ClosingDocumentRow {
  id: string;
  status: string;
  number?: string | null;
  sent_at?: string | null;
  posted_at?: string | null;
  canceled_at?: string | null;
  referee?: { full_name?: string | null; email?: string | null } | null;
  totals?: TotalsSnapshot | null;
  document_status?: { alias?: string; name?: string } | null;
  signature_timeline?: Array<{
    sign_id?: string | null;
    party?: string | null;
    created_at?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    patronymic?: string | null;
  }>;
  download_url?: string | null;
  can_delete?: boolean;
  items?: ClosingItemSnapshot[];
  customer_snapshot?: PartySnapshot | null;
  performer_snapshot?: PartySnapshot | null;
  contract_snapshot?: ContractSnapshot | null;
  fhmo_signer_snapshot?: PartySnapshot | null;
}

interface ClosingListResponse {
  documents?: ClosingDocumentRow[];
  total?: number;
  summary?: {
    sendable_total?: number;
  } | null;
}

const props = defineProps<{
  tournamentId: string;
  tournament?: { name?: string | null } | null;
}>();

const { showToast } = useToast();

const activeTab = ref<ClosingTabKey>('prepare');
const tabs = [
  { key: 'prepare', label: 'К формированию' },
  { key: 'documents', label: 'Акты' },
];

const profileLoading = ref(false);
const profileSaving = ref(false);
const profile = ref<ClosingProfileResponse['profile'] | null>(null);
const profileError = ref('');
const organizerInn = ref('');
const organizerLookupLoading = ref(false);
const organizerLookupError = ref('');
const organizerSuggestions = ref<OrganizationSuggestion[]>([]);
const selectedOrganizerIndex = ref(0);

const accrualLoading = ref(false);
const accrualError = ref('');
const accrualRows = ref<AccrualRow[]>([]);
const accrualTotal = ref(0);
const accrualTotalAmountRub = ref('0.00');
const accrualPage = ref(1);
const accrualLimit = ref(20);
const accrualFilters = reactive({
  search: '',
  dateFrom: '',
  dateTo: '',
});
const selectedIds = ref<string[]>([]);
const selectionMode = ref<'explicit' | 'filtered'>('explicit');
const filteredSelection = ref<{
  count: number;
  totalAmountRub: string;
  filters: ClosingSelectionFilters;
} | null>(null);

const previewLoading = ref(false);
const previewError = ref('');
const preview = ref<PreviewResponse | null>(null);
const createLoading = ref(false);

const documentsLoading = ref(false);
const documentsError = ref('');
const documents = ref<ClosingDocumentRow[]>([]);
const documentsTotal = ref(0);
const documentsPage = ref(1);
const documentsLimit = ref(20);
const documentsFilters = reactive({
  search: '',
  status: '',
});
const selectedSendDocumentIds = ref<string[]>([]);
const sendSelectionMode = ref<'explicit' | 'filtered'>('explicit');
const filteredSendSelection = ref<{
  count: number;
  filters: {
    status?: string;
    search?: string;
  };
} | null>(null);
const sendableDocumentsTotal = ref(0);
const selectedDocumentId = ref('');
const selectedDocument = computed(
  () =>
    documents.value.find((item) => item.id === selectedDocumentId.value) || null
);
const actionLoading = ref('');
const bulkSendLoading = ref(false);

const accrualTotalPages = computed(() =>
  Math.max(1, Math.ceil(Number(accrualTotal.value || 0) / accrualLimit.value))
);
const documentsTotalPages = computed(() =>
  Math.max(
    1,
    Math.ceil(Number(documentsTotal.value || 0) / documentsLimit.value)
  )
);
const explicitSelectedSummary = computed(() => ({
  count: selectedIds.value.length,
  total: selectedIds.value.reduce((sum, id) => {
    const row = accrualRows.value.find((item) => item.id === id);
    const amount = Number(String(row?.total_amount_rub ?? 0).replace(',', '.'));
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0),
}));
const selectedSummary = computed(() => {
  if (selectionMode.value === 'filtered' && filteredSelection.value) {
    return {
      count: filteredSelection.value.count,
      total: Number(
        String(filteredSelection.value.totalAmountRub || 0).replace(',', '.')
      ),
      mode: 'filtered' as const,
    };
  }
  return {
    count: explicitSelectedSummary.value.count,
    total: explicitSelectedSummary.value.total,
    mode: 'explicit' as const,
  };
});
const selectedOrganizerSuggestion = computed<OrganizationSuggestion | null>(
  () => organizerSuggestions.value[selectedOrganizerIndex.value] || null
);
const organizerReady = computed(
  () =>
    Boolean(profile.value?.organizer?.inn) &&
    Boolean(profile.value?.organizer?.name) &&
    Boolean(profile.value?.organizer?.address)
);
const previewSummary = computed(() => {
  const readyGroups = preview.value?.ready_groups || [];
  const blockedGroups = preview.value?.blocked_groups || [];
  const readyAmount = readyGroups.reduce((sum, group) => {
    const amount = Number(
      String(group.totals?.total_amount_rub ?? 0).replace(',', '.')
    );
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  return {
    readyGroups: readyGroups.length,
    blockedGroups: blockedGroups.length,
    readyAmount,
  };
});
const isFilteredSelection = computed(() => selectionMode.value === 'filtered');
const allRowsSelected = computed(
  () =>
    Boolean(accrualRows.value.length) &&
    accrualRows.value.every((row) =>
      isFilteredSelection.value ? true : selectedIds.value.includes(row.id)
    )
);
const canSelectAllFiltered = computed(
  () => selectionMode.value === 'explicit' && accrualTotal.value > 0
);
const sendableDocumentsOnPage = computed(() =>
  documents.value.filter((item) => item.status === 'DRAFT')
);
const selectedSendSummary = computed(() => {
  if (sendSelectionMode.value === 'filtered' && filteredSendSelection.value) {
    return {
      count: filteredSendSelection.value.count,
      mode: 'filtered' as const,
    };
  }
  return {
    count: selectedSendDocumentIds.value.length,
    mode: 'explicit' as const,
  };
});
const allSendableDocumentsSelected = computed(
  () =>
    Boolean(sendableDocumentsOnPage.value.length) &&
    sendableDocumentsOnPage.value.every((item) =>
      sendSelectionMode.value === 'filtered'
        ? true
        : selectedSendDocumentIds.value.includes(item.id)
    )
);
const canSelectAllSendFiltered = computed(
  () =>
    sendSelectionMode.value === 'explicit' && sendableDocumentsTotal.value > 0
);

function fullName(
  person: AccrualRow['referee'] | ClosingDocumentRow['referee']
) {
  if (person && 'full_name' in person) {
    return String(person.full_name || '').trim();
  }
  if (!person) return '';
  const personWithParts = person as {
    last_name?: string | null;
    first_name?: string | null;
    patronymic?: string | null;
  };
  return [
    personWithParts.last_name,
    personWithParts.first_name,
    personWithParts.patronymic,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('ru-RU');
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatRub(value: unknown) {
  const number = Number(String(value ?? 0).replace(',', '.'));
  if (!Number.isFinite(number)) return '0,00';
  return number.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function issueLabel(issue: string) {
  const labels: Record<string, string> = {
    missing_customer_profile: 'Не заполнен организатор турнира',
    missing_fhmo_signer: 'Не найден подписант ФХМ',
    missing_referee_email: 'У судьи нет e-mail',
    missing_referee_address: 'Не заполнен адрес судьи',
    missing_referee_contract: 'Нет заявления о присоединении к договору',
    missing_simple_esign: 'У судьи не подключена ПЭП',
    missing_interaction_agreement: 'Нет подписанного соглашения о ПЭП',
    accrual_already_linked: 'Начисление уже включено в активный акт',
    invalid_accrual_status: 'Выбраны начисления не в статусе "Начислено"',
  };
  return labels[issue] || issue;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: 'Черновик',
    AWAITING_SIGNATURE: 'Ожидает подписания',
    POSTED: 'Проведен',
    CANCELED: 'Отменен',
    SIGNED: 'Подписан',
  };
  return labels[String(status || '')] || status || '—';
}

function snapshotTitle(
  snapshot: PartySnapshot | null | undefined,
  fallback = '—'
) {
  return (
    snapshot?.full_name || snapshot?.name || snapshot?.short_name || fallback
  );
}

function formatContract(contract: ContractSnapshot | null | undefined) {
  if (!contract) return 'Нет ссылки на договор';
  const bits = [contract.title || 'Заявление о присоединении'];
  if (contract.number) bits.push(`№ ${contract.number}`);
  const date = formatDate(contract.document_date);
  if (date !== '—') bits.push(`от ${date}`);
  return bits.join(' ');
}

function signaturePartyLabel(party: string | null | undefined) {
  return party === 'REFEREE' ? 'Исполнитель' : 'Заказчик';
}

function buildAccrualQuery(): URLSearchParams {
  const params = new URLSearchParams({
    page: String(accrualPage.value),
    limit: String(accrualLimit.value),
    status: 'ACCRUED',
  });
  if (accrualFilters.search.trim()) {
    params.set('search', accrualFilters.search.trim());
  }
  if (accrualFilters.dateFrom) params.set('date_from', accrualFilters.dateFrom);
  if (accrualFilters.dateTo) params.set('date_to', accrualFilters.dateTo);
  return params;
}

function buildDocumentsQuery(): URLSearchParams {
  const params = new URLSearchParams({
    page: String(documentsPage.value),
    limit: String(documentsLimit.value),
  });
  if (documentsFilters.search.trim()) {
    params.set('search', documentsFilters.search.trim());
  }
  if (documentsFilters.status) params.set('status', documentsFilters.status);
  return params;
}

function buildAccrualFilterSnapshot(): ClosingSelectionFilters {
  const snapshot: ClosingSelectionFilters = {
    status: 'ACCRUED',
  };
  if (accrualFilters.search.trim()) {
    snapshot.search = accrualFilters.search.trim();
  }
  if (accrualFilters.dateFrom) {
    snapshot.date_from = accrualFilters.dateFrom;
  }
  if (accrualFilters.dateTo) {
    snapshot.date_to = accrualFilters.dateTo;
  }
  return snapshot;
}

function buildSelectionPayload() {
  if (selectionMode.value === 'filtered' && filteredSelection.value) {
    return {
      selection_mode: 'filtered',
      filters: filteredSelection.value.filters,
    };
  }
  return {
    selection_mode: 'explicit',
    accrual_ids: selectedIds.value,
  };
}

function buildDocumentFilterSnapshot() {
  const snapshot: { status?: string; search?: string } = {};
  if (documentsFilters.status) {
    snapshot.status = documentsFilters.status;
  }
  if (documentsFilters.search.trim()) {
    snapshot.search = documentsFilters.search.trim();
  }
  return snapshot;
}

function buildDocumentSelectionPayload() {
  if (sendSelectionMode.value === 'filtered' && filteredSendSelection.value) {
    return {
      selection_mode: 'filtered',
      filters: filteredSendSelection.value.filters,
    };
  }
  return {
    selection_mode: 'explicit',
    closing_document_ids: selectedSendDocumentIds.value,
  };
}

function clearSelection() {
  selectionMode.value = 'explicit';
  filteredSelection.value = null;
  selectedIds.value = [];
}

function clearSendSelection() {
  sendSelectionMode.value = 'explicit';
  filteredSendSelection.value = null;
  selectedSendDocumentIds.value = [];
}

async function loadProfile() {
  profileLoading.value = true;
  profileError.value = '';
  try {
    const response = (await apiFetch(
      `/tournaments/${props.tournamentId}/referee-closing-profile`
    )) as ClosingProfileResponse;
    profile.value = response.profile || null;
    organizerInn.value = String(response.profile?.organizer?.inn || '');
    organizerSuggestions.value = response.profile?.organizer_json
      ? [response.profile.organizer_json as OrganizationSuggestion]
      : [];
    selectedOrganizerIndex.value = 0;
  } catch (err: any) {
    profileError.value =
      err?.message || 'Не удалось загрузить профиль организатора';
  } finally {
    profileLoading.value = false;
  }
}

async function lookupOrganization() {
  organizerLookupLoading.value = true;
  organizerLookupError.value = '';
  organizerSuggestions.value = [];
  selectedOrganizerIndex.value = 0;
  try {
    organizerSuggestions.value = await findOrganizationsByInn(
      organizerInn.value
    );
    if (!organizerSuggestions.value.length) {
      organizerLookupError.value = 'Организация по ИНН не найдена';
    }
  } catch (err: any) {
    organizerLookupError.value =
      err?.message || 'Не удалось получить данные организации';
  } finally {
    organizerLookupLoading.value = false;
  }
}

async function saveProfile() {
  if (!selectedOrganizerSuggestion.value) {
    organizerLookupError.value = 'Сначала подтяните организацию по ИНН';
    return;
  }
  profileSaving.value = true;
  try {
    const response = (await apiFetch(
      `/tournaments/${props.tournamentId}/referee-closing-profile`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization: selectedOrganizerSuggestion.value,
        }),
      }
    )) as ClosingProfileResponse;
    profile.value = response.profile || null;
    organizerSuggestions.value = response.profile?.organizer_json
      ? [response.profile.organizer_json as OrganizationSuggestion]
      : [];
    selectedOrganizerIndex.value = 0;
    showToast('Организатор турнира сохранен');
  } catch (err: any) {
    organizerLookupError.value =
      err?.message || 'Не удалось сохранить организатора';
  } finally {
    profileSaving.value = false;
  }
}

async function loadAccruals() {
  accrualLoading.value = true;
  accrualError.value = '';
  try {
    if (
      selectionMode.value === 'filtered' &&
      JSON.stringify(filteredSelection.value?.filters || {}) !==
        JSON.stringify(buildAccrualFilterSnapshot())
    ) {
      clearSelection();
    }
    const response = (await apiFetch(
      `/tournaments/${props.tournamentId}/referee-accruals?${buildAccrualQuery().toString()}`
    )) as AccrualListResponse;
    accrualRows.value = response.accruals || [];
    accrualTotal.value = Number(response.total || 0);
    accrualTotalAmountRub.value = String(
      response.summary?.total_amount_rub || '0.00'
    );
  } catch (err: any) {
    accrualError.value = err?.message || 'Не удалось загрузить начисления';
    accrualRows.value = [];
    accrualTotal.value = 0;
    accrualTotalAmountRub.value = '0.00';
  } finally {
    accrualLoading.value = false;
  }
}

async function loadDocuments() {
  documentsLoading.value = true;
  documentsError.value = '';
  try {
    if (
      sendSelectionMode.value === 'filtered' &&
      JSON.stringify(filteredSendSelection.value?.filters || {}) !==
        JSON.stringify(buildDocumentFilterSnapshot())
    ) {
      clearSendSelection();
    }
    const response = (await apiFetch(
      `/tournaments/${props.tournamentId}/referee-closing-documents?${buildDocumentsQuery().toString()}`
    )) as ClosingListResponse;
    documents.value = response.documents || [];
    documentsTotal.value = Number(response.total || 0);
    sendableDocumentsTotal.value = Number(
      response.summary?.sendable_total || 0
    );
    if (!selectedDocumentId.value && documents.value.length) {
      selectedDocumentId.value = documents.value[0]?.id || '';
    }
    if (
      selectedDocumentId.value &&
      !documents.value.some((item) => item.id === selectedDocumentId.value)
    ) {
      selectedDocumentId.value = documents.value[0]?.id || '';
    }
  } catch (err: any) {
    documentsError.value = err?.message || 'Не удалось загрузить акты';
    documents.value = [];
    documentsTotal.value = 0;
    sendableDocumentsTotal.value = 0;
  } finally {
    documentsLoading.value = false;
  }
}

function toggleSelection(id: string) {
  if (selectionMode.value === 'filtered') return;
  const set = new Set(selectedIds.value);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  selectedIds.value = [...set];
}

function toggleSelectAllOnPage() {
  if (selectionMode.value === 'filtered') return;
  if (allRowsSelected.value) {
    const idsOnPage = new Set(accrualRows.value.map((item) => item.id));
    selectedIds.value = selectedIds.value.filter((id) => !idsOnPage.has(id));
    return;
  }
  const set = new Set(selectedIds.value);
  for (const row of accrualRows.value) set.add(row.id);
  selectedIds.value = [...set];
}

function selectAllFiltered() {
  selectionMode.value = 'filtered';
  filteredSelection.value = {
    count: accrualTotal.value,
    totalAmountRub: accrualTotalAmountRub.value,
    filters: buildAccrualFilterSnapshot(),
  };
}

async function runPreview() {
  if (!selectedSummary.value.count) {
    previewError.value = 'Выберите хотя бы одно начисление';
    return;
  }
  previewLoading.value = true;
  previewError.value = '';
  try {
    preview.value = (await apiFetch(
      `/tournaments/${props.tournamentId}/referee-closing-documents/preview`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSelectionPayload()),
      }
    )) as PreviewResponse;
  } catch (err: any) {
    previewError.value = err?.message || 'Не удалось собрать предпросмотр';
    preview.value = null;
  } finally {
    previewLoading.value = false;
  }
}

async function createDocuments() {
  if (!preview.value?.ready_groups?.length) return;
  createLoading.value = true;
  try {
    await apiFetch(
      `/tournaments/${props.tournamentId}/referee-closing-documents`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSelectionPayload()),
      }
    );
    showToast('Черновики актов созданы');
    clearSelection();
    preview.value = null;
    activeTab.value = 'documents';
    await Promise.all([loadAccruals(), loadDocuments()]);
  } catch (err: any) {
    previewError.value = err?.message || 'Не удалось создать акты';
  } finally {
    createLoading.value = false;
  }
}

async function sendDocument(id: string) {
  actionLoading.value = `send:${id}`;
  try {
    await apiFetch(
      `/tournaments/${props.tournamentId}/referee-closing-documents/${id}/send`,
      {
        method: 'POST',
      }
    );
    showToast('Акт отправлен на подпись');
    selectedSendDocumentIds.value = selectedSendDocumentIds.value.filter(
      (item) => item !== id
    );
    await Promise.all([loadAccruals(), loadDocuments()]);
  } catch (err: any) {
    documentsError.value = err?.message || 'Не удалось отправить акт';
  } finally {
    actionLoading.value = '';
  }
}

function toggleSendSelection(id: string) {
  if (sendSelectionMode.value === 'filtered') return;
  const set = new Set(selectedSendDocumentIds.value);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  selectedSendDocumentIds.value = [...set];
}

function toggleSelectAllSendableOnPage() {
  if (sendSelectionMode.value === 'filtered') return;
  const idsOnPage = new Set(
    sendableDocumentsOnPage.value.map((item) => item.id)
  );
  if (allSendableDocumentsSelected.value) {
    selectedSendDocumentIds.value = selectedSendDocumentIds.value.filter(
      (id) => !idsOnPage.has(id)
    );
    return;
  }
  const set = new Set(selectedSendDocumentIds.value);
  for (const row of sendableDocumentsOnPage.value) {
    set.add(row.id);
  }
  selectedSendDocumentIds.value = [...set];
}

function selectAllSendFiltered() {
  sendSelectionMode.value = 'filtered';
  filteredSendSelection.value = {
    count: sendableDocumentsTotal.value,
    filters: buildDocumentFilterSnapshot(),
  };
}

async function sendSelectedDocuments() {
  if (!selectedSendSummary.value.count) {
    documentsError.value = 'Выберите хотя бы один черновик акта';
    return;
  }
  bulkSendLoading.value = true;
  documentsError.value = '';
  try {
    const response = (await apiFetch(
      `/tournaments/${props.tournamentId}/referee-closing-documents/send-batch`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildDocumentSelectionPayload()),
      }
    )) as {
      failures?: Array<{ id?: string; code?: string }>;
      summary?: {
        sent_total?: number;
        failed_total?: number;
      };
    };
    const sentTotal = Number(response.summary?.sent_total || 0);
    const failedTotal = Number(response.summary?.failed_total || 0);
    if (sentTotal) {
      showToast(
        failedTotal
          ? `Отправлено актов: ${sentTotal}. Ошибок: ${failedTotal}.`
          : `Отправлено актов: ${sentTotal}`
      );
    }
    if (failedTotal) {
      documentsError.value = `Не удалось отправить ${failedTotal} ${failedTotal === 1 ? 'акт' : 'акта(ов)'}. Обновите журнал и повторите попытку для оставшихся черновиков.`;
    }
    clearSendSelection();
    await Promise.all([loadAccruals(), loadDocuments()]);
  } catch (err: any) {
    documentsError.value =
      err?.message || 'Не удалось выполнить массовую отправку актов';
  } finally {
    bulkSendLoading.value = false;
  }
}

async function deleteDocument(id: string) {
  if (
    !window.confirm(
      'Удалить акт и вернуть начисления в статус «Начислено»? Действие доступно только до подписи судьи.'
    )
  ) {
    return;
  }
  actionLoading.value = `delete:${id}`;
  try {
    await apiFetch(
      `/tournaments/${props.tournamentId}/referee-closing-documents/${id}`,
      {
        method: 'DELETE',
      }
    );
    showToast('Акт удален');
    selectedSendDocumentIds.value = selectedSendDocumentIds.value.filter(
      (item) => item !== id
    );
    if (selectedDocumentId.value === id) {
      selectedDocumentId.value = '';
    }
    await Promise.all([loadAccruals(), loadDocuments()]);
  } catch (err: any) {
    documentsError.value = err?.message || 'Не удалось удалить акт';
  } finally {
    actionLoading.value = '';
  }
}

watch([accrualPage, accrualLimit], () => {
  void loadAccruals();
});

watch([documentsPage, documentsLimit], () => {
  void loadDocuments();
});

watch(activeTab, (value) => {
  if (value === 'documents') {
    void loadDocuments();
  }
});

onMounted(async () => {
  await Promise.all([loadProfile(), loadAccruals()]);
});
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <TabSelector
      :model-value="activeTab"
      :tabs="tabs"
      v-bind="{ ariaLabel: 'Закрывающие документы' }"
      @update:model-value="
        (value) => (activeTab = String(value) as ClosingTabKey)
      "
    />

    <div class="border rounded-3 p-3 sticky-panel">
      <div
        class="d-flex flex-wrap justify-content-between gap-2 align-items-start"
      >
        <div>
          <div class="d-flex flex-wrap align-items-center gap-2">
            <div class="fw-semibold">Реквизиты заказчика</div>
            <span
              class="badge"
              :class="
                organizerReady
                  ? 'bg-success-subtle text-success border'
                  : 'bg-warning-subtle text-warning border'
              "
            >
              {{
                organizerReady
                  ? 'Профиль заказчика готов'
                  : 'Нужно проверить реквизиты'
              }}
            </span>
          </div>
          <div class="small text-muted">
            Реквизиты попадут в шапку каждого акта и будут сохранены снимком на
            момент создания документа.
          </div>
        </div>
        <div v-if="profile?.last_verified_at" class="small text-muted">
          Обновлено: {{ formatDateTime(profile.last_verified_at) }}
        </div>
      </div>

      <div v-if="profileError" class="alert alert-danger mt-3 mb-0 py-2">
        {{ profileError }}
      </div>
      <BrandSpinner
        v-else-if="profileLoading"
        label="Загрузка профиля организатора"
      />

      <div v-else class="row g-3 mt-1">
        <div class="col-12 col-xl-4">
          <label class="form-label">ИНН организатора</label>
          <div class="input-group">
            <input
              v-model="organizerInn"
              type="text"
              class="form-control"
              inputmode="numeric"
              maxlength="10"
              placeholder="10 цифр"
            />
            <button
              type="button"
              class="btn btn-outline-brand"
              :disabled="organizerLookupLoading"
              @click="lookupOrganization"
            >
              Найти
            </button>
          </div>
          <div class="small text-muted mt-2">
            Используется поиск организации через DaData по ИНН.
          </div>
        </div>

        <div class="col-12 col-xl-8">
          <div class="border rounded-3 p-3 h-100">
            <div class="fw-semibold mb-2">Предпросмотр реквизитов</div>
            <div
              v-if="organizerLookupError"
              class="alert alert-danger py-2 mb-2"
            >
              {{ organizerLookupError }}
            </div>
            <BrandSpinner
              v-else-if="organizerLookupLoading"
              label="Получение данных организации"
            />
            <template v-else>
              <div v-if="organizerSuggestions.length > 1" class="mb-3">
                <label class="form-label">Найденные организации</label>
                <select v-model="selectedOrganizerIndex" class="form-select">
                  <option
                    v-for="(item, index) in organizerSuggestions"
                    :key="`${item.data?.inn || 'inn'}:${item.data?.kpp || index}`"
                    :value="index"
                  >
                    {{ item.value || 'Без названия' }}
                    {{ item.data?.kpp ? ` · КПП ${item.data.kpp}` : '' }}
                  </option>
                </select>
              </div>
              <div class="small d-flex flex-column gap-1">
                <div>
                  <strong>Наименование:</strong>
                  {{
                    selectedOrganizerSuggestion?.value ||
                    profile?.organizer?.name ||
                    '—'
                  }}
                </div>
                <div>
                  <strong>ИНН:</strong>
                  {{
                    selectedOrganizerSuggestion?.data?.inn ||
                    profile?.organizer?.inn ||
                    '—'
                  }}
                </div>
                <div>
                  <strong>КПП:</strong>
                  {{
                    selectedOrganizerSuggestion?.data?.kpp ||
                    profile?.organizer?.kpp ||
                    '—'
                  }}
                </div>
                <div>
                  <strong>ОГРН:</strong>
                  {{
                    selectedOrganizerSuggestion?.data?.ogrn ||
                    profile?.organizer?.ogrn ||
                    '—'
                  }}
                </div>
                <div>
                  <strong>Адрес:</strong>
                  {{
                    selectedOrganizerSuggestion?.data?.address
                      ?.unrestricted_value ||
                    selectedOrganizerSuggestion?.unrestricted_value ||
                    profile?.organizer?.address ||
                    '—'
                  }}
                </div>
              </div>
              <div class="mt-3">
                <button
                  type="button"
                  class="btn btn-brand"
                  :disabled="profileSaving || !selectedOrganizerSuggestion"
                  @click="saveProfile"
                >
                  Сохранить организатора
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <template v-if="activeTab === 'prepare'">
      <div class="row g-3 align-items-start">
        <div class="col-12 col-xxl-7">
          <form class="border rounded-3 p-3" @submit.prevent="loadAccruals">
            <div class="row g-2 align-items-end">
              <div class="col-12 col-lg-5">
                <label class="form-label">Поиск начислений</label>
                <input
                  v-model="accrualFilters.search"
                  type="search"
                  class="form-control"
                  placeholder="Судья, матч, номер начисления"
                />
              </div>
              <div class="col-6 col-lg-3">
                <label class="form-label">Дата от</label>
                <input
                  v-model="accrualFilters.dateFrom"
                  type="date"
                  class="form-control"
                />
              </div>
              <div class="col-6 col-lg-3">
                <label class="form-label">Дата до</label>
                <input
                  v-model="accrualFilters.dateTo"
                  type="date"
                  class="form-control"
                />
              </div>
              <div class="col-12 col-lg-1">
                <button type="submit" class="btn btn-brand w-100">OK</button>
              </div>
            </div>
          </form>

          <div class="border rounded-3 p-3 mt-3">
            <div
              class="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-2"
            >
              <div>
                <div class="fw-semibold">Начисления к оформлению</div>
                <div class="small text-muted">
                  Для v1 доступны только начисления в статусе «Начислено».
                </div>
              </div>
              <div class="small text-muted">
                Выбрано: {{ selectedSummary.count }} ·
                {{ formatRub(selectedSummary.total) }} ₽
              </div>
            </div>

            <div v-if="accrualError" class="alert alert-danger py-2 mb-2">
              {{ accrualError }}
            </div>
            <BrandSpinner
              v-else-if="accrualLoading"
              label="Загрузка начислений"
            />

            <template v-else>
              <div class="table-responsive">
                <table class="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th class="text-center" style="width: 52px">
                        <input
                          class="form-check-input"
                          type="checkbox"
                          :checked="allRowsSelected"
                          :disabled="isFilteredSelection || !accrualRows.length"
                          aria-label="Выбрать все начисления на странице"
                          @change="toggleSelectAllOnPage"
                        />
                      </th>
                      <th>№</th>
                      <th>Судья</th>
                      <th>Матч</th>
                      <th>Дата</th>
                      <th>Роль</th>
                      <th class="text-end">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in accrualRows" :key="row.id">
                      <td class="text-center">
                        <input
                          :checked="
                            isFilteredSelection || selectedIds.includes(row.id)
                          "
                          class="form-check-input"
                          type="checkbox"
                          :disabled="isFilteredSelection"
                          :aria-label="`Выбрать начисление ${row.accrual_number}`"
                          @change="toggleSelection(row.id)"
                        />
                      </td>
                      <td>{{ row.accrual_number }}</td>
                      <td>{{ fullName(row.referee) || '—' }}</td>
                      <td>
                        {{ row.match?.home_team?.name || '—' }} -
                        {{ row.match?.away_team?.name || '—' }}
                      </td>
                      <td>{{ formatDate(row.match_date_snapshot) }}</td>
                      <td>{{ row.referee_role?.name || '—' }}</td>
                      <td class="text-end">
                        {{ formatRub(row.total_amount_rub) }}
                      </td>
                    </tr>
                    <tr v-if="!accrualRows.length">
                      <td colspan="7" class="text-center text-muted py-3">
                        Подходящих начислений нет
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div
                v-if="canSelectAllFiltered || isFilteredSelection"
                class="d-flex flex-wrap align-items-center gap-2 mt-3"
              >
                <button
                  v-if="canSelectAllFiltered"
                  type="button"
                  class="btn btn-outline-brand btn-sm"
                  @click="selectAllFiltered"
                >
                  Выбрать все ({{ accrualTotal }})
                </button>
                <span
                  v-if="isFilteredSelection"
                  class="badge bg-primary-subtle text-primary border"
                >
                  Выбраны все начисления в текущем наборе
                </span>
                <button
                  v-if="selectedSummary.count"
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  @click="clearSelection"
                >
                  Снять выбор
                </button>
              </div>

              <PageNav
                :page="accrualPage"
                :total-pages="accrualTotalPages"
                :page-size="accrualLimit"
                :sizes="[20, 50, 100]"
                @update:page="(value) => (accrualPage = value)"
                @update:page-size="(value) => (accrualLimit = value)"
              />
            </template>
          </div>
        </div>

        <div class="col-12 col-xxl-5">
          <div class="border rounded-3 p-3 detail-card sticky-panel">
            <div
              class="d-flex flex-wrap justify-content-between gap-2 align-items-center"
            >
              <div>
                <div class="fw-semibold">Предпросмотр пакета актов</div>
                <div class="small text-muted">
                  Система соберет будущие акты по правилу: 1 судья = 1 акт и
                  сразу покажет, какие группы готовы к отправке.
                </div>
              </div>
              <button
                type="button"
                class="btn btn-outline-brand btn-sm"
                :disabled="previewLoading || !selectedSummary.count"
                @click="runPreview"
              >
                Пересчитать
              </button>
            </div>

            <div v-if="previewError" class="alert alert-danger mt-3 mb-0 py-2">
              {{ previewError }}
            </div>
            <BrandSpinner
              v-else-if="previewLoading"
              label="Сбор предпросмотра актов"
            />

            <template v-else-if="preview">
              <div class="row g-2 mt-1">
                <div class="col-12 col-md-4">
                  <div class="closing-summary-card h-100">
                    <div class="closing-summary-card__label">Готово актов</div>
                    <div class="closing-summary-card__value">
                      {{ previewSummary.readyGroups }}
                    </div>
                  </div>
                </div>
                <div class="col-12 col-md-4">
                  <div class="closing-summary-card h-100">
                    <div class="closing-summary-card__label">
                      Требуют исправлений
                    </div>
                    <div class="closing-summary-card__value">
                      {{ previewSummary.blockedGroups }}
                    </div>
                  </div>
                </div>
                <div class="col-12 col-md-4">
                  <div class="closing-summary-card h-100">
                    <div class="closing-summary-card__label">Сумма готовых</div>
                    <div class="closing-summary-card__value">
                      {{ formatRub(previewSummary.readyAmount) }} ₽
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="preview.fhmo_signer" class="small mt-2">
                <strong>Подписант ФХМ:</strong>
                {{ preview.fhmo_signer.full_name || '—' }}
                <span v-if="preview.fhmo_signer.position" class="text-muted">
                  · {{ preview.fhmo_signer.position }}
                </span>
              </div>

              <div class="mt-3">
                <div class="fw-semibold small mb-2">Готовы к созданию</div>
                <div
                  v-if="preview.ready_groups?.length"
                  class="d-flex flex-column gap-2"
                >
                  <div
                    v-for="group in preview.ready_groups"
                    :key="group.referee?.id"
                    class="border rounded-3 p-3 preview-card"
                  >
                    <div
                      class="d-flex flex-wrap justify-content-between gap-2 align-items-start"
                    >
                      <div>
                        <div class="fw-semibold">
                          {{ group.referee?.full_name || '—' }}
                        </div>
                        <div class="small text-muted">
                          {{ formatContract(group.contract_snapshot) }}
                        </div>
                      </div>
                      <span class="badge bg-success-subtle text-success border">
                        Готов к созданию
                      </span>
                    </div>
                    <div class="small text-muted mt-2">
                      {{
                        group.performer_snapshot?.address || 'Адрес не указан'
                      }}
                    </div>
                    <div class="small text-muted mt-1">
                      {{ group.totals?.items_count || 0 }} начисл. ·
                      {{ formatRub(group.totals?.total_amount_rub) }} ₽
                    </div>
                  </div>
                </div>
                <div v-else class="small text-muted">
                  Нет групп, которые можно оформить без исправлений.
                </div>
              </div>

              <div class="mt-3">
                <div class="fw-semibold small mb-2">Требуют исправлений</div>
                <div
                  v-if="preview.blocked_groups?.length"
                  class="d-flex flex-column gap-2"
                >
                  <div
                    v-for="group in preview.blocked_groups"
                    :key="group.referee?.id"
                    class="border rounded-3 p-3 preview-card preview-card--blocked"
                  >
                    <div
                      class="d-flex flex-wrap justify-content-between gap-2 align-items-start"
                    >
                      <div>
                        <div class="fw-semibold">
                          {{ group.referee?.full_name || '—' }}
                        </div>
                        <div class="small text-muted">
                          {{ formatContract(group.contract_snapshot) }}
                        </div>
                      </div>
                      <span class="badge bg-danger-subtle text-danger border">
                        Есть блокировки
                      </span>
                    </div>
                    <div class="small text-muted mt-2">
                      {{
                        group.performer_snapshot?.address || 'Адрес не указан'
                      }}
                    </div>
                    <div class="small text-muted mb-2">
                      {{ group.totals?.items_count || 0 }} начисл. ·
                      {{ formatRub(group.totals?.total_amount_rub) }} ₽
                    </div>
                    <div class="d-flex flex-wrap gap-1">
                      <span
                        v-for="issue in group.issues || []"
                        :key="issue"
                        class="badge text-bg-light border"
                      >
                        {{ issueLabel(issue) }}
                      </span>
                    </div>
                  </div>
                </div>
                <div v-else class="small text-muted">
                  Все выбранные группы валидны.
                </div>
              </div>

              <div class="mt-3 d-flex gap-2">
                <button
                  type="button"
                  class="btn btn-brand"
                  :disabled="
                    createLoading || !(preview.ready_groups || []).length
                  "
                  @click="createDocuments"
                >
                  Создать черновики актов
                </button>
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  :disabled="createLoading"
                  @click="preview = null"
                >
                  Очистить preview
                </button>
              </div>
            </template>

            <div v-else class="small text-muted mt-3">
              Выберите начисления и выполните предпросмотр.
            </div>
          </div>
        </div>
      </div>

      <div v-if="selectedSummary.count" class="closing-sticky-bar">
        <div class="fw-semibold">
          {{
            selectedSummary.mode === 'filtered'
              ? `Выбраны все начисления по фильтру: ${selectedSummary.count}`
              : `Выбрано начислений: ${selectedSummary.count}`
          }}
        </div>
        <div class="small">Сумма: {{ formatRub(selectedSummary.total) }} ₽</div>
        <div class="d-flex gap-2">
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            @click="clearSelection"
          >
            Снять выбор
          </button>
          <button
            type="button"
            class="btn btn-brand btn-sm"
            @click="runPreview"
          >
            Проверить пакет
          </button>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="border rounded-3 p-3">
        <div class="row g-2 align-items-end">
          <div class="col-12 col-lg-6">
            <label class="form-label">Поиск по акту</label>
            <input
              v-model="documentsFilters.search"
              type="search"
              class="form-control"
              placeholder="Номер акта или ФИО судьи"
            />
          </div>
          <div class="col-6 col-lg-3">
            <label class="form-label">Статус</label>
            <select v-model="documentsFilters.status" class="form-select">
              <option value="">Все</option>
              <option value="DRAFT">Черновик</option>
              <option value="AWAITING_SIGNATURE">Ожидает подписания</option>
              <option value="POSTED">Проведен</option>
              <option value="CANCELED">Отменен</option>
            </select>
          </div>
          <div class="col-6 col-lg-3">
            <button
              type="button"
              class="btn btn-brand w-100"
              @click="loadDocuments"
            >
              Обновить
            </button>
          </div>
        </div>
      </div>

      <div class="row g-3 align-items-start">
        <div class="col-12 col-xxl-7">
          <div class="border rounded-3 p-3">
            <div
              class="d-flex flex-wrap justify-content-between gap-2 align-items-start mb-2"
            >
              <div>
                <div class="fw-semibold">Журнал актов</div>
                <div class="small text-muted">
                  Отслеживайте черновики, акты в ожидании подписи и проведенные
                  документы в одном журнале.
                </div>
              </div>
              <div class="small text-muted text-end">
                Готово к подписи ФХМ: {{ sendableDocumentsTotal }}
              </div>
            </div>
            <div
              v-if="
                canSelectAllSendFiltered || sendSelectionMode === 'filtered'
              "
              class="d-flex flex-wrap align-items-center gap-2 mb-3"
            >
              <button
                v-if="canSelectAllSendFiltered"
                type="button"
                class="btn btn-outline-brand btn-sm"
                @click="selectAllSendFiltered"
              >
                Выбрать все черновики ({{ sendableDocumentsTotal }})
              </button>
              <span
                v-if="sendSelectionMode === 'filtered'"
                class="badge bg-primary-subtle text-primary border"
              >
                Выбраны все черновики по текущему фильтру
              </span>
              <button
                v-if="selectedSendSummary.count"
                type="button"
                class="btn btn-outline-secondary btn-sm"
                @click="clearSendSelection"
              >
                Снять выбор
              </button>
              <button
                v-if="selectedSendSummary.count"
                type="button"
                class="btn btn-brand btn-sm"
                :disabled="bulkSendLoading"
                @click="sendSelectedDocuments"
              >
                Подписать и отправить выбранные
              </button>
            </div>
            <div v-if="documentsError" class="alert alert-danger py-2 mb-2">
              {{ documentsError }}
            </div>
            <BrandSpinner v-else-if="documentsLoading" label="Загрузка актов" />

            <template v-else>
              <div class="table-responsive">
                <table class="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th class="text-center" style="width: 52px">
                        <input
                          class="form-check-input"
                          type="checkbox"
                          :checked="allSendableDocumentsSelected"
                          :disabled="
                            sendSelectionMode === 'filtered' ||
                            !sendableDocumentsOnPage.length
                          "
                          aria-label="Выбрать все черновики актов на странице"
                          @change="toggleSelectAllSendableOnPage"
                        />
                      </th>
                      <th>№</th>
                      <th>Судья</th>
                      <th>Статус</th>
                      <th>Отправлен</th>
                      <th>Подписей</th>
                      <th class="text-end">Сумма</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="item in documents"
                      :key="item.id"
                      :class="{
                        'table-active': selectedDocumentId === item.id,
                      }"
                      @click="selectedDocumentId = item.id"
                    >
                      <td class="text-center" @click.stop>
                        <input
                          class="form-check-input"
                          type="checkbox"
                          :checked="
                            item.status === 'DRAFT' &&
                            (sendSelectionMode === 'filtered' ||
                              selectedSendDocumentIds.includes(item.id))
                          "
                          :disabled="
                            item.status !== 'DRAFT' ||
                            sendSelectionMode === 'filtered'
                          "
                          :aria-label="`Выбрать акт ${item.number || item.id}`"
                          @change="toggleSendSelection(item.id)"
                        />
                      </td>
                      <td>{{ item.number || '—' }}</td>
                      <td>{{ item.referee?.full_name || '—' }}</td>
                      <td>
                        <span
                          class="badge"
                          :class="documentStatusBadgeClass(item.status)"
                        >
                          {{ statusLabel(item.status) }}
                        </span>
                      </td>
                      <td>{{ formatDateTime(item.sent_at) }}</td>
                      <td>{{ item.signature_timeline?.length || 0 }}</td>
                      <td class="text-end">
                        {{ formatRub(item.totals?.total_amount_rub) }}
                      </td>
                      <td class="text-end">
                        <div class="d-flex justify-content-end gap-2">
                          <button
                            v-if="item.can_delete"
                            type="button"
                            class="btn btn-outline-danger btn-sm"
                            :disabled="actionLoading === `delete:${item.id}`"
                            @click.stop="deleteDocument(item.id)"
                          >
                            Удалить
                          </button>
                          <a
                            v-if="item.download_url"
                            :href="item.download_url"
                            class="btn btn-outline-secondary btn-sm"
                            target="_blank"
                            rel="noopener"
                            @click.stop
                          >
                            PDF
                          </a>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="!documents.length">
                      <td colspan="8" class="text-center text-muted py-3">
                        Актов пока нет
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <PageNav
                :page="documentsPage"
                :total-pages="documentsTotalPages"
                :page-size="documentsLimit"
                :sizes="[20, 50, 100]"
                @update:page="(value) => (documentsPage = value)"
                @update:page-size="(value) => (documentsLimit = value)"
              />
            </template>
          </div>
        </div>

        <div class="col-12 col-xxl-5">
          <div class="border rounded-3 p-3 detail-card sticky-panel">
            <div class="fw-semibold mb-2">Карточка акта</div>
            <template v-if="selectedDocument">
              <div class="d-flex align-items-center gap-2 mb-3">
                <span
                  class="badge"
                  :class="documentStatusBadgeClass(selectedDocument.status)"
                >
                  {{ statusLabel(selectedDocument.status) }}
                </span>
                <span class="small text-muted">
                  № {{ selectedDocument.number || '—' }}
                </span>
              </div>

              <div class="small d-flex flex-column gap-2">
                <div>
                  <strong>Исполнитель:</strong>
                  {{ snapshotTitle(selectedDocument.performer_snapshot) }}
                </div>
                <div>
                  <strong>Заказчик:</strong>
                  {{ snapshotTitle(selectedDocument.customer_snapshot) }}
                </div>
                <div>
                  <strong>Договорная ссылка:</strong>
                  {{ formatContract(selectedDocument.contract_snapshot) }}
                </div>
                <div>
                  <strong>Адрес исполнителя:</strong>
                  {{
                    selectedDocument.performer_snapshot?.address ||
                    'Адрес не указан'
                  }}
                </div>
                <div>
                  <strong>Отправлен:</strong>
                  {{ formatDateTime(selectedDocument.sent_at) }}
                </div>
                <div>
                  <strong>Проведен:</strong>
                  {{ formatDateTime(selectedDocument.posted_at) }}
                </div>
                <div>
                  <strong>Итого:</strong>
                  {{ formatRub(selectedDocument.totals?.total_amount_rub) }} ₽
                </div>
                <div v-if="selectedDocument.totals?.total_amount_words">
                  <strong>Сумма прописью:</strong>
                  {{ selectedDocument.totals?.total_amount_words }}
                </div>
              </div>

              <div class="mt-3">
                <div class="fw-semibold small mb-2">Состав акта</div>
                <div
                  v-if="selectedDocument.items?.length"
                  class="border rounded-3 overflow-auto closing-items-panel"
                >
                  <table class="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Дата и время</th>
                        <th>Матч</th>
                        <th>Амплуа</th>
                        <th>Тариф</th>
                        <th class="text-end">Сумма</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="item in selectedDocument.items"
                        :key="String(item.accrual_id || item.line_no)"
                      >
                        <td class="small">
                          {{ item.service_datetime || '—' }}
                        </td>
                        <td class="small">
                          <div class="fw-semibold">
                            {{ item.match_label || item.service_name || '—' }}
                          </div>
                          <div
                            v-if="item.competition_name"
                            class="text-muted closing-competition-name"
                          >
                            {{ item.competition_name }}
                          </div>
                        </td>
                        <td class="small">{{ item.role_name || '—' }}</td>
                        <td class="small">{{ item.tariff_label || '—' }}</td>
                        <td class="small text-end">
                          {{
                            formatRub(item.amount_rub || item.total_amount_rub)
                          }}
                          ₽
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else class="small text-muted">
                  Состав услуг будет доступен после формирования акта.
                </div>
              </div>

              <div class="mt-3">
                <div class="fw-semibold small mb-2">Таймлайн подписей</div>
                <div
                  v-if="selectedDocument.signature_timeline?.length"
                  class="small d-flex flex-column gap-1"
                >
                  <div
                    v-for="(
                      signature, index
                    ) in selectedDocument.signature_timeline"
                    :key="
                      String(signature.sign_id || signature.created_at || index)
                    "
                  >
                    {{ signaturePartyLabel(signature.party) }} ·
                    {{
                      [
                        signature.last_name,
                        signature.first_name,
                        signature.patronymic,
                      ]
                        .filter(Boolean)
                        .join(' ') || '—'
                    }}
                    · {{ formatDateTime(signature.created_at) }}
                  </div>
                </div>
                <div v-else class="small text-muted">Подписей пока нет</div>
              </div>

              <div class="mt-3">
                <div class="fw-semibold small mb-2">Действия</div>
                <div class="d-flex flex-wrap gap-2">
                  <button
                    v-if="selectedDocument.status === 'DRAFT'"
                    type="button"
                    class="btn btn-brand btn-sm"
                    :disabled="actionLoading === `send:${selectedDocument.id}`"
                    @click="sendDocument(selectedDocument.id)"
                  >
                    Отправить на подпись
                  </button>
                  <button
                    v-if="selectedDocument.can_delete"
                    type="button"
                    class="btn btn-outline-danger btn-sm"
                    :disabled="
                      actionLoading === `delete:${selectedDocument.id}`
                    "
                    @click="deleteDocument(selectedDocument.id)"
                  >
                    Удалить
                  </button>
                  <a
                    v-if="selectedDocument.download_url"
                    :href="selectedDocument.download_url"
                    class="btn btn-outline-secondary btn-sm"
                    target="_blank"
                    rel="noopener"
                  >
                    Скачать PDF
                  </a>
                </div>
              </div>
            </template>
            <div v-else class="small text-muted">
              Выберите акт в журнале слева.
            </div>
          </div>
        </div>
      </div>
      <div v-if="selectedSendSummary.count" class="closing-sticky-bar">
        <div class="fw-semibold">
          {{
            selectedSendSummary.mode === 'filtered'
              ? `Выбраны все черновики по фильтру: ${selectedSendSummary.count}`
              : `Выбрано черновиков актов: ${selectedSendSummary.count}`
          }}
        </div>
        <div class="small">
          После подтверждения акты будут подписаны ФХМ и отправлены судьям.
        </div>
        <div class="d-flex gap-2">
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            @click="clearSendSelection"
          >
            Снять выбор
          </button>
          <button
            type="button"
            class="btn btn-brand btn-sm"
            :disabled="bulkSendLoading"
            @click="sendSelectedDocuments"
          >
            Подписать и отправить
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.closing-summary-card {
  height: 100%;
  padding: 0.85rem 1rem;
  border: 1px solid var(--border-subtle, #dfe5ec);
  border-radius: var(--radius-tile, 0.75rem);
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: var(--shadow-tile);
}

.closing-summary-card__label {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.closing-summary-card__value {
  margin-top: 0.35rem;
  font-size: 1.15rem;
  font-weight: 700;
  color: #141922;
}

.preview-card {
  background: #f8fafc;
}

.preview-card--blocked {
  border-color: #f0c8ce !important;
  background: #fff7f8;
}

.closing-items-panel {
  max-height: 20rem;
}

.closing-competition-name {
  font-size: 0.78rem;
}

.closing-sticky-bar {
  position: sticky;
  bottom: 0;
  z-index: 5;
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-subtle, #dfe5ec);
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(6px);
  box-shadow: var(--shadow-tile);
}

@media (max-width: 991.98px) {
  .closing-sticky-bar {
    flex-wrap: wrap;
  }
}
</style>
