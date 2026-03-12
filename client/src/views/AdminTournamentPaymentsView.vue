<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import TabSelector from '../components/TabSelector.vue';
import PageNav from '../components/PageNav.vue';
import BrandSpinner from '../components/BrandSpinner.vue';
import { apiFetch, apiFetchBlob } from '../api';
import { useToast } from '../utils/toast';

type MainTabKey = 'setup' | 'accruals' | 'registry';
type SetupTabKey = 'tariffs' | 'travel';
type CoverageState = 'ok' | 'out_of_period' | 'missing';

interface StatusRef {
  id: string;
  alias: string;
  name_ru: string;
}

interface GroupOption {
  id: string;
  name: string;
}

interface RoleOption {
  id: string;
  name: string;
  group_name?: string | null;
}

interface ScheduleDate {
  day: string;
  count: number;
}

interface DashboardSummary {
  active_tariff_rules: number;
  active_travel_rates: number;
  draft_accruals: number;
  tariff_issue_count: number;
  travel_issue_count: number;
}

interface TariffCoverageIssue {
  stage_group_id: string;
  referee_role_id: string;
  stage_group_name: string | null;
  referee_role_name: string | null;
  state: CoverageState;
  active_count: number;
  in_period_count: number;
}

interface TariffCoverageMatrixRow {
  stage_group: GroupOption;
  role_states: TariffCoverageIssue[];
}

interface TravelCoverageIssue {
  ground_id: string;
  ground_name: string | null;
  state: CoverageState;
  active_count: number;
  in_period_count: number;
}

interface CoverageSummary {
  total: number;
  ok: number;
  out_of_period: number;
  missing: number;
}

interface DashboardPayload {
  summary: DashboardSummary;
  schedule_dates: ScheduleDate[];
  coverage_date: string;
  tariff_coverage_summary: CoverageSummary;
  tariff_coverage_issues: TariffCoverageIssue[];
  tariff_coverage_matrix: TariffCoverageMatrixRow[];
  travel_coverage_summary: CoverageSummary;
  travel_coverage_rows: TravelCoverageIssue[];
  travel_coverage_issues: TravelCoverageIssue[];
}

interface TariffRule {
  id: string;
  tournament_id: string;
  stage_group_id: string;
  referee_role_id: string;
  fare_code: string;
  base_amount_rub: string;
  meal_amount_rub: string;
  valid_from: string;
  valid_to: string | null;
  version: number;
  status: StatusRef | null;
  stage_group: GroupOption | null;
  referee_role: RoleOption | null;
}

interface TravelRate {
  id: string;
  ground_id: string;
  rate_code: string | null;
  travel_amount_rub: string;
  valid_from: string;
  valid_to: string | null;
  status: StatusRef | null;
}

interface PublicUser {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  patronymic?: string | null;
}

interface PostingLine {
  id: string;
  amount_rub: string;
  posting_type: StatusRef | null;
  component: StatusRef | null;
}

interface AuditEvent {
  id: string;
  action: string;
  created_at: string;
  actor: PublicUser | null;
}

interface AccrualDocument {
  id: string;
  accrual_number: string;
  tournament_id: string;
  fare_code_snapshot: string;
  match_date_snapshot: string | null;
  total_amount_rub: string;
  base_amount_rub: string;
  meal_amount_rub: string;
  travel_amount_rub: string;
  status: StatusRef | null;
  source: StatusRef | null;
  referee: PublicUser | null;
  referee_role: RoleOption | null;
  tournament: { id: string; name: string | null } | null;
  stage_group: GroupOption | null;
  ground: { id: string; name: string | null } | null;
  match: {
    id: string;
    date_start: string | null;
    home_team: { id: string; name: string | null } | null;
    away_team: { id: string; name: string | null } | null;
  } | null;
  travel_rate: {
    id: string;
    rate_code: string | null;
    travel_amount_rub: string;
  } | null;
  postings?: PostingLine[];
  adjustments?: Array<{
    id: string;
    accrual_number: string;
    total_amount_rub: string;
    created_at: string;
    status: StatusRef | null;
  }>;
  original_document?: {
    id: string;
    accrual_number: string;
    status: StatusRef | null;
  } | null;
}

interface GenerationResult {
  from_date: string;
  to_date: string;
  mode: 'preview' | 'apply';
  summary: {
    eligible_matches: number;
    eligible_assignments: number;
    calculated: number;
    created: number;
    skipped_existing: number;
    errors: number;
  };
  errors_by_code: Record<string, number>;
}

interface AccountingRefDataResponse {
  tariff_statuses?: StatusRef[];
  travel_rate_statuses?: StatusRef[];
  document_statuses?: StatusRef[];
  accrual_sources?: StatusRef[];
  generation_error_codes?: Array<{ alias: string; name_ru: string }>;
}

interface TournamentGroupsResponse {
  groups?: GroupOption[];
}

interface RefereeRolesResponse {
  groups?: Array<{
    id: string;
    name: string;
    roles?: Array<{ id: string; name: string }>;
  }>;
}

interface GroupRefereesResponse {
  assignments?: Array<{ referee_role_id: string; count: number }>;
}

interface TariffListResponse {
  tariff_rules?: TariffRule[];
  total?: number;
}

interface TariffMutationResponse {
  tariff_rule?: TariffRule | null;
  deleted?: boolean;
}

interface TravelRateListResponse {
  travel_rates?: TravelRate[];
  total?: number;
}

interface TravelRateMutationResponse {
  travel_rate?: TravelRate | null;
  deleted?: boolean;
}

interface AccrualListResponse {
  accruals?: AccrualDocument[];
  total?: number;
}

interface AccrualDetailResponse {
  document?: AccrualDocument | null;
  audit_events?: AuditEvent[];
}

interface TaxationTypeOption {
  alias: string;
  name: string;
}

interface PaymentRegistrySummary {
  referees_total: number;
  ready_total: number;
  incomplete_total: number;
  total_amount_rub: string;
}

interface PaymentRegistryRow {
  referee_id: string;
  last_name: string | null;
  first_name: string | null;
  patronymic: string | null;
  inn: string | null;
  phone: string | null;
  bank_account_number: string | null;
  bic: string | null;
  correspondent_account: string | null;
  total_amount_rub: string;
  taxation_type_alias: string | null;
  taxation_type: string | null;
  missing_fields: string[];
}

interface PaymentRegistryResponse {
  rows?: PaymentRegistryRow[];
  total?: number;
  page?: number;
  limit?: number;
  summary?: PaymentRegistrySummary;
  filter_options?: {
    taxation_types?: TaxationTypeOption[];
  };
}

interface TariffEditorForm {
  id: string;
  fare_code: string;
  stage_group_id: string;
  referee_role_id: string;
  base_amount_rub: string;
  meal_amount_rub: string;
  valid_from: string;
  valid_to: string;
}

interface TravelEditorForm {
  id: string;
  rate_code: string;
  travel_amount_rub: string;
  valid_from: string;
  valid_to: string;
}

const props = defineProps<{
  tournamentId: string;
  tournament?: { name?: string | null } | null;
}>();

const { showToast } = useToast();

const mainTab = ref<MainTabKey>('setup');
const setupTab = ref<SetupTabKey>('tariffs');
const topTabs = [
  { key: 'setup', label: 'Настройка оплаты' },
  { key: 'accruals', label: 'Начисления' },
  { key: 'registry', label: 'Реестры' },
];
const setupTabs = [
  { key: 'tariffs', label: 'Нормы' },
  { key: 'travel', label: 'Проезд' },
];

const mainCardRef = ref<HTMLElement | null>(null);
const tariffIssuesRef = ref<HTMLElement | null>(null);
const travelIssuesRef = ref<HTMLElement | null>(null);

const dashboardLoading = ref(false);
const dashboardError = ref('');
const dashboard = ref<DashboardPayload | null>(null);
const coverageDate = ref('');
const coverageInitialized = ref(false);
const showTariffMatrix = ref(false);
const showAllGroundCoverage = ref(false);

const refDataLoading = ref(false);
const refDataError = ref('');
const refData = reactive({
  tariffStatuses: [] as StatusRef[],
  travelRateStatuses: [] as StatusRef[],
  documentStatuses: [] as StatusRef[],
  sources: [] as StatusRef[],
  generationErrors: [] as Array<{ alias: string; name_ru: string }>,
});

const groupOptions = ref<GroupOption[]>([]);
const roleOptions = ref<RoleOption[]>([]);
const activeRoleIds = ref<string[]>([]);

const tariffLoading = ref(false);
const tariffError = ref('');
const tariffRows = ref<TariffRule[]>([]);
const tariffTotal = ref(0);
const tariffPage = ref(1);
const tariffLimit = ref(20);
const tariffActionLoading = ref('');
const showTariffFilters = ref(false);
const tariffFilters = reactive({
  search: '',
  stageGroupId: '',
  refereeRoleId: '',
});
const selectedTariffId = ref('');
const tariffEditorMode = ref<'create' | 'edit'>('create');
const tariffSaving = ref(false);
const tariffEditorError = ref('');
const tariffForm = reactive<TariffEditorForm>({
  id: '',
  fare_code: '',
  stage_group_id: '',
  referee_role_id: '',
  base_amount_rub: '0,00',
  meal_amount_rub: '0,00',
  valid_from: '',
  valid_to: '',
});

const selectedGroundId = ref('');
const travelRatesLoading = ref(false);
const travelRatesError = ref('');
const travelRates = ref<TravelRate[]>([]);
const travelGroundSearch = ref('');
const selectedTravelRateId = ref('');
const travelEditorMode = ref<'create' | 'edit'>('create');
const travelSaving = ref(false);
const travelEditorError = ref('');
const travelForm = reactive<TravelEditorForm>({
  id: '',
  rate_code: '',
  travel_amount_rub: '0,00',
  valid_from: '',
  valid_to: '',
});

const accrualLoading = ref(false);
const accrualError = ref('');
const accrualRows = ref<AccrualDocument[]>([]);
const accrualTotal = ref(0);
const accrualPage = ref(1);
const accrualLimit = ref(20);
const showAccrualFilters = ref(false);
const accrualFilters = reactive({
  search: '',
  status: '',
  source: '',
  dateFrom: '',
  dateTo: '',
});
const selectedAccrualId = ref('');
const accrualDetailLoading = ref(false);
const accrualDetailError = ref('');
const selectedAccrual = ref<AccrualDocument | null>(null);
const selectedAuditEvents = ref<AuditEvent[]>([]);

const generationLoading = ref(false);
const generationError = ref('');
const generationResult = ref<GenerationResult | null>(null);
const generationForm = reactive({
  from_date: '',
  to_date: '',
});
const registryLoading = ref(false);
const registryError = ref('');
const registryRows = ref<PaymentRegistryRow[]>([]);
const registryTotal = ref(0);
const registryPage = ref(1);
const registryLimit = ref(20);
const registryLoaded = ref(false);
const registryExporting = ref(false);
const registrySummary = ref<PaymentRegistrySummary>({
  referees_total: 0,
  ready_total: 0,
  incomplete_total: 0,
  total_amount_rub: '0.00',
});
const registryFilterOptions = reactive({
  taxationTypes: [] as TaxationTypeOption[],
});
const registryFilters = reactive({
  dateFrom: '',
  dateTo: '',
  taxationTypeAlias: '',
});

const today = new Date().toISOString().slice(0, 10);
const REGISTRY_MISSING_FIELD_LABELS: Record<string, string> = {
  inn: 'ИНН',
  phone: 'телефон',
  bank_account_number: 'номер банковского счета',
  bic: 'БИК',
  correspondent_account: 'корр. счет',
  taxation_type: 'тип налогообложения',
};

const filteredRoleOptions = computed(() => {
  const allowed = new Set(activeRoleIds.value);
  return roleOptions.value.filter((role) => allowed.has(String(role.id)));
});

const selectedTariff = computed(
  () =>
    tariffRows.value.find((row) => String(row.id) === selectedTariffId.value) ||
    null
);

const coverageDateOptions = computed(
  () => dashboard.value?.schedule_dates || []
);

const visibleTariffIssues = computed(() => {
  const rows = dashboard.value?.tariff_coverage_issues || [];
  return rows.filter((row) => {
    if (
      tariffFilters.stageGroupId &&
      String(row.stage_group_id) !== String(tariffFilters.stageGroupId)
    ) {
      return false;
    }
    if (
      tariffFilters.refereeRoleId &&
      String(row.referee_role_id) !== String(tariffFilters.refereeRoleId)
    ) {
      return false;
    }
    return true;
  });
});

const travelCoverageRows = computed(() => {
  const allRows = dashboard.value?.travel_coverage_rows || [];
  if (showAllGroundCoverage.value) {
    if (!travelGroundSearch.value.trim()) return allRows;
    const needle = travelGroundSearch.value.trim().toLowerCase();
    return allRows.filter((row) =>
      String(row.ground_name || '')
        .toLowerCase()
        .includes(needle)
    );
  }

  const issueRows = (dashboard.value?.travel_coverage_issues || []).filter(
    (row) => row.state !== 'ok'
  );
  const base = issueRows.length ? issueRows : allRows;
  if (!travelGroundSearch.value.trim()) return base;
  const needle = travelGroundSearch.value.trim().toLowerCase();
  return base.filter((row) =>
    String(row.ground_name || '')
      .toLowerCase()
      .includes(needle)
  );
});

const selectedGroundCoverage = computed(
  () =>
    travelCoverageRows.value.find(
      (row) => String(row.ground_id) === String(selectedGroundId.value)
    ) || null
);

const selectedTravelRate = computed(
  () =>
    travelRates.value.find(
      (row) => String(row.id) === String(selectedTravelRateId.value)
    ) || null
);

const tariffTotalPages = computed(() =>
  Math.max(1, Math.ceil(Number(tariffTotal.value || 0) / tariffLimit.value))
);

const accrualTotalPages = computed(() =>
  Math.max(1, Math.ceil(Number(accrualTotal.value || 0) / accrualLimit.value))
);

const registryTotalPages = computed(() =>
  Math.max(1, Math.ceil(Number(registryTotal.value || 0) / registryLimit.value))
);

const generationErrorChips = computed(() => {
  const nameMap = new Map(
    (refData.generationErrors || []).map((item) => [item.alias, item.name_ru])
  );
  return Object.entries(generationResult.value?.errors_by_code || {}).map(
    ([alias, count]) => ({
      alias,
      count,
      label: nameMap.get(alias) || alias,
    })
  );
});

const globalAccountingHref = computed(
  () =>
    `/admin/accounting?tournament_id=${encodeURIComponent(props.tournamentId)}`
);

const selectedAccountingHref = computed(() => {
  const base = new URLSearchParams({ tournament_id: props.tournamentId });
  if (selectedAccrual.value?.accrual_number) {
    base.set('number', selectedAccrual.value.accrual_number);
  }
  return `/admin/accounting?${base.toString()}`;
});

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

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('ru-RU');
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function statusName(status: StatusRef | null | undefined): string {
  return status?.name_ru || status?.alias || '—';
}

function statusBadgeClass(alias: string): string {
  if (alias === 'ACTIVE' || alias === 'ACCRUED') return 'text-bg-success';
  if (alias === 'FILED') return 'text-bg-primary';
  if (alias === 'RETIRED') return 'text-bg-dark';
  if (alias === 'DELETED') return 'text-bg-danger';
  return 'text-bg-secondary';
}

function coverageStateLabel(state: CoverageState, activeCount = 0): string {
  if (state === 'ok') return activeCount > 0 ? `Ок (${activeCount})` : 'Ок';
  if (state === 'out_of_period') {
    return activeCount > 0 ? `Вне периода (${activeCount})` : 'Вне периода';
  }
  return 'Нет настройки';
}

function coverageStateBadgeClass(state: CoverageState): string {
  if (state === 'ok') return 'text-bg-success';
  if (state === 'out_of_period') return 'text-bg-warning text-dark';
  return 'text-bg-danger';
}

function fullName(person: PublicUser | null | undefined): string {
  return [person?.last_name, person?.first_name, person?.patronymic]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function registryFullName(row: PaymentRegistryRow | null | undefined): string {
  return [row?.last_name, row?.first_name, row?.patronymic]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function registryMissingFieldLabels(fields: string[] = []): string[] {
  return fields.map((field) => REGISTRY_MISSING_FIELD_LABELS[field] || field);
}

function buildRegistryExportFilename(): string {
  const source = String(props.tournament?.name || props.tournamentId || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return `payment-registry-${source || 'tournament'}-${today}.xlsx`;
}

function buildTariffEditorDefaults(
  overrides: Partial<TariffEditorForm> = {}
): TariffEditorForm {
  return {
    id: '',
    fare_code: '',
    stage_group_id: groupOptions.value[0]?.id || '',
    referee_role_id: filteredRoleOptions.value[0]?.id || '',
    base_amount_rub: '0,00',
    meal_amount_rub: '0,00',
    valid_from: coverageDate.value || today,
    valid_to: '',
    ...overrides,
  };
}

function applyTariffForm(next: TariffEditorForm): void {
  tariffForm.id = next.id;
  tariffForm.fare_code = next.fare_code;
  tariffForm.stage_group_id = next.stage_group_id;
  tariffForm.referee_role_id = next.referee_role_id;
  tariffForm.base_amount_rub = next.base_amount_rub;
  tariffForm.meal_amount_rub = next.meal_amount_rub;
  tariffForm.valid_from = next.valid_from;
  tariffForm.valid_to = next.valid_to;
}

function buildTravelEditorDefaults(
  overrides: Partial<TravelEditorForm> = {}
): TravelEditorForm {
  return {
    id: '',
    rate_code: '',
    travel_amount_rub: '0,00',
    valid_from: coverageDate.value || today,
    valid_to: '',
    ...overrides,
  };
}

function applyTravelForm(next: TravelEditorForm): void {
  travelForm.id = next.id;
  travelForm.rate_code = next.rate_code;
  travelForm.travel_amount_rub = next.travel_amount_rub;
  travelForm.valid_from = next.valid_from;
  travelForm.valid_to = next.valid_to;
}

async function loadRefData(): Promise<void> {
  refDataLoading.value = true;
  refDataError.value = '';
  try {
    const response = (await apiFetch(
      '/admin/accounting/ref-data'
    )) as AccountingRefDataResponse;
    refData.tariffStatuses = response.tariff_statuses || [];
    refData.travelRateStatuses = response.travel_rate_statuses || [];
    refData.documentStatuses = response.document_statuses || [];
    refData.sources = response.accrual_sources || [];
    refData.generationErrors = response.generation_error_codes || [];
  } catch (err: any) {
    refDataError.value = err?.message || 'Не удалось загрузить справочники';
  } finally {
    refDataLoading.value = false;
  }
}

async function loadReferences(): Promise<void> {
  const params = new URLSearchParams({
    page: '1',
    limit: '1000',
    tournament_id: props.tournamentId,
  });
  const [groupsRes, rolesRes, assignmentsRes] = (await Promise.all([
    apiFetch(`/tournaments/groups?${params.toString()}`),
    apiFetch('/tournaments/referee-roles'),
    apiFetch(`/tournaments/groups/referees?${params.toString()}`),
  ])) as [
    TournamentGroupsResponse,
    RefereeRolesResponse,
    GroupRefereesResponse,
  ];

  groupOptions.value = groupsRes.groups || [];
  roleOptions.value = (rolesRes.groups || []).flatMap((group: any) =>
    (group.roles || []).map((role: any) => ({
      id: String(role.id),
      name: String(role.name || 'Без названия'),
      group_name: String(group.name || ''),
    }))
  );

  const roleIds = new Set<string>();
  for (const assignment of assignmentsRes.assignments || []) {
    if (Number(assignment?.count || 0) > 0) {
      roleIds.add(String(assignment.referee_role_id || ''));
    }
  }
  activeRoleIds.value = [...roleIds].filter(Boolean);
}

async function loadDashboard(forceDate?: string): Promise<void> {
  dashboardLoading.value = true;
  dashboardError.value = '';
  try {
    const params = new URLSearchParams();
    const onDate = forceDate || coverageDate.value;
    if (onDate) params.set('on_date', onDate);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = (await apiFetch(
      `/tournaments/${props.tournamentId}/referee-payments/dashboard${suffix}`
    )) as DashboardPayload;
    dashboard.value = response;
    coverageInitialized.value = true;
    if (
      response?.coverage_date &&
      response.coverage_date !== coverageDate.value
    ) {
      coverageDate.value = String(response.coverage_date);
    }
    if (!generationForm.from_date && response?.schedule_dates?.length) {
      generationForm.from_date = String(response.schedule_dates[0]?.day || '');
      generationForm.to_date = String(
        response.schedule_dates[response.schedule_dates.length - 1]?.day || ''
      );
    }
  } catch (err: any) {
    dashboardError.value =
      err?.message || 'Не удалось загрузить состояние оплаты турнира';
  } finally {
    dashboardLoading.value = false;
  }
}

function buildTariffQuery(): URLSearchParams {
  const params = new URLSearchParams({
    page: String(tariffPage.value),
    limit: String(tariffLimit.value),
  });
  if (tariffFilters.search.trim()) {
    params.set('fare_code', tariffFilters.search.trim().toUpperCase());
  }
  if (tariffFilters.stageGroupId) {
    params.set('stage_group_id', tariffFilters.stageGroupId);
  }
  if (tariffFilters.refereeRoleId) {
    params.set('referee_role_id', tariffFilters.refereeRoleId);
  }
  if (coverageDate.value) params.set('on_date', coverageDate.value);
  return params;
}

async function loadTariffs(): Promise<void> {
  tariffLoading.value = true;
  tariffError.value = '';
  try {
    const response = (await apiFetch(
      `/tournaments/${props.tournamentId}/referee-tariffs?${buildTariffQuery().toString()}`
    )) as TariffListResponse;
    tariffRows.value = response.tariff_rules || [];
    tariffTotal.value = Number(response.total || 0);

    if (
      selectedTariffId.value &&
      !tariffRows.value.some((row) => String(row.id) === selectedTariffId.value)
    ) {
      selectedTariffId.value = '';
    }

    const firstTariff = tariffRows.value[0];
    if (
      !selectedTariffId.value &&
      firstTariff &&
      tariffEditorMode.value !== 'create'
    ) {
      selectTariff(firstTariff);
    }
  } catch (err: any) {
    tariffRows.value = [];
    tariffTotal.value = 0;
    tariffError.value = err?.message || 'Не удалось загрузить нормы оплаты';
  } finally {
    tariffLoading.value = false;
  }
}

function resetTariffFilters(): void {
  tariffFilters.search = '';
  tariffFilters.stageGroupId = '';
  tariffFilters.refereeRoleId = '';
  showTariffFilters.value = false;
  if (tariffPage.value !== 1) {
    tariffPage.value = 1;
    return;
  }
  void loadTariffs();
}

function submitTariffFilters(): void {
  if (tariffPage.value !== 1) {
    tariffPage.value = 1;
    return;
  }
  void loadTariffs();
}

function selectTariff(row: TariffRule): void {
  selectedTariffId.value = String(row.id);
  tariffEditorMode.value = 'edit';
  tariffEditorError.value = '';
  applyTariffForm(
    buildTariffEditorDefaults({
      id: String(row.id),
      fare_code: row.fare_code || '',
      stage_group_id: String(row.stage_group_id || ''),
      referee_role_id: String(row.referee_role_id || ''),
      base_amount_rub: formatRub(row.base_amount_rub),
      meal_amount_rub: formatRub(row.meal_amount_rub),
      valid_from: row.valid_from || coverageDate.value || today,
      valid_to: row.valid_to || '',
    })
  );
}

function startCreateTariff(prefill: Partial<TariffEditorForm> = {}): void {
  selectedTariffId.value = '';
  tariffEditorMode.value = 'create';
  tariffEditorError.value = '';
  applyTariffForm(buildTariffEditorDefaults(prefill));
}

function duplicateTariff(row?: TariffRule | null): void {
  const source = row || selectedTariff.value;
  if (!source) {
    startCreateTariff();
    return;
  }
  startCreateTariff({
    fare_code: source.fare_code,
    stage_group_id: String(source.stage_group_id || ''),
    referee_role_id: String(source.referee_role_id || ''),
    base_amount_rub: formatRub(source.base_amount_rub),
    meal_amount_rub: formatRub(source.meal_amount_rub),
    valid_from: coverageDate.value || source.valid_from || today,
    valid_to: source.valid_to || '',
  });
}

async function saveTariff(): Promise<void> {
  tariffSaving.value = true;
  tariffEditorError.value = '';
  try {
    const payload = {
      fare_code: tariffForm.fare_code.trim().toUpperCase(),
      stage_group_id: tariffForm.stage_group_id,
      referee_role_id: tariffForm.referee_role_id,
      base_amount_rub: normalizeRubInput(tariffForm.base_amount_rub),
      meal_amount_rub: normalizeRubInput(tariffForm.meal_amount_rub),
      valid_from: tariffForm.valid_from,
      valid_to: tariffForm.valid_to || null,
    };
    const isEdit = Boolean(tariffForm.id);
    const response = (await apiFetch(
      isEdit
        ? `/tournaments/${props.tournamentId}/referee-tariffs/${tariffForm.id}`
        : `/tournaments/${props.tournamentId}/referee-tariffs`,
      {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )) as TariffMutationResponse;
    const saved = (response?.tariff_rule || null) as TariffRule | null;
    showToast(isEdit ? 'Норма оплаты сохранена' : 'Норма оплаты создана');
    await Promise.all([loadTariffs(), loadDashboard()]);
    if (saved?.id) {
      await nextTick();
      selectTariff(saved);
    } else {
      startCreateTariff();
    }
  } catch (err: any) {
    tariffEditorError.value =
      err?.message || 'Не удалось сохранить норму оплаты';
  } finally {
    tariffSaving.value = false;
  }
}

async function deleteTariff(): Promise<void> {
  if (!selectedTariff.value?.id) return;
  tariffActionLoading.value = `delete:${selectedTariff.value.id}`;
  tariffEditorError.value = '';
  try {
    const response = (await apiFetch(
      `/tournaments/${props.tournamentId}/referee-tariffs/${selectedTariff.value.id}/retire`,
      { method: 'POST' }
    )) as TariffMutationResponse;
    showToast('Норма оплаты архивирована');
    await Promise.all([loadTariffs(), loadDashboard()]);
    if (response?.deleted) {
      selectedTariffId.value = '';
      startCreateTariff();
      return;
    }
    const updated = (response?.tariff_rule || null) as TariffRule | null;
    if (updated?.id) {
      await nextTick();
      selectTariff(updated);
    }
  } catch (err: any) {
    tariffEditorError.value = err?.message || 'Не удалось архивировать норму';
  } finally {
    tariffActionLoading.value = '';
  }
}

async function loadGroundTravelRates(): Promise<void> {
  if (!selectedGroundId.value) {
    travelRates.value = [];
    selectedTravelRateId.value = '';
    return;
  }
  travelRatesLoading.value = true;
  travelRatesError.value = '';
  try {
    const response = (await apiFetch(
      `/grounds/${selectedGroundId.value}/referee-travel-rates?limit=200&page=1`
    )) as TravelRateListResponse;
    travelRates.value = response.travel_rates || [];
    if (
      selectedTravelRateId.value &&
      !travelRates.value.some(
        (row) => String(row.id) === String(selectedTravelRateId.value)
      )
    ) {
      selectedTravelRateId.value = '';
    }
    const firstRate = travelRates.value[0];
    if (
      !selectedTravelRateId.value &&
      firstRate &&
      travelEditorMode.value !== 'create'
    ) {
      selectTravelRate(firstRate);
    }
  } catch (err: any) {
    travelRates.value = [];
    travelRatesError.value =
      err?.message || 'Не удалось загрузить ставки проезда';
  } finally {
    travelRatesLoading.value = false;
  }
}

function selectTravelRate(row: TravelRate): void {
  selectedTravelRateId.value = String(row.id);
  travelEditorMode.value = 'edit';
  travelEditorError.value = '';
  applyTravelForm(
    buildTravelEditorDefaults({
      id: String(row.id),
      rate_code: row.rate_code || '',
      travel_amount_rub: formatRub(row.travel_amount_rub),
      valid_from: row.valid_from || coverageDate.value || today,
      valid_to: row.valid_to || '',
    })
  );
}

function startCreateTravelRate(prefill: Partial<TravelEditorForm> = {}): void {
  selectedTravelRateId.value = '';
  travelEditorMode.value = 'create';
  travelEditorError.value = '';
  applyTravelForm(buildTravelEditorDefaults(prefill));
}

function duplicateTravelRate(row?: TravelRate | null): void {
  const source = row || selectedTravelRate.value;
  if (!source) {
    startCreateTravelRate();
    return;
  }
  startCreateTravelRate({
    rate_code: source.rate_code || '',
    travel_amount_rub: formatRub(source.travel_amount_rub),
    valid_from: coverageDate.value || source.valid_from || today,
    valid_to: source.valid_to || '',
  });
}

async function saveTravelRate(): Promise<void> {
  if (!selectedGroundId.value) return;
  travelSaving.value = true;
  travelEditorError.value = '';
  try {
    const payload = {
      rate_code: travelForm.rate_code.trim() || null,
      travel_amount_rub: normalizeRubInput(travelForm.travel_amount_rub),
      valid_from: travelForm.valid_from,
      valid_to: travelForm.valid_to || null,
    };
    const isEdit = Boolean(travelForm.id);
    const response = (await apiFetch(
      isEdit
        ? `/grounds/${selectedGroundId.value}/referee-travel-rates/${travelForm.id}`
        : `/grounds/${selectedGroundId.value}/referee-travel-rates`,
      {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )) as TravelRateMutationResponse;
    const saved = (response?.travel_rate || null) as TravelRate | null;
    showToast(isEdit ? 'Ставка проезда сохранена' : 'Ставка проезда создана');
    await Promise.all([loadGroundTravelRates(), loadDashboard()]);
    if (saved?.id) {
      await nextTick();
      selectTravelRate(saved);
    } else {
      startCreateTravelRate();
    }
  } catch (err: any) {
    travelEditorError.value =
      err?.message || 'Не удалось сохранить ставку проезда';
  } finally {
    travelSaving.value = false;
  }
}

async function deleteTravelRate(): Promise<void> {
  if (!selectedGroundId.value || !selectedTravelRate.value?.id) return;
  travelSaving.value = true;
  travelEditorError.value = '';
  try {
    const response = (await apiFetch(
      `/grounds/${selectedGroundId.value}/referee-travel-rates/${selectedTravelRate.value.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RETIRED' }),
      }
    )) as TravelRateMutationResponse;
    showToast('Ставка проезда архивирована');
    await Promise.all([loadGroundTravelRates(), loadDashboard()]);
    if (response?.deleted) {
      selectedTravelRateId.value = '';
      startCreateTravelRate();
      return;
    }
    const saved = (response?.travel_rate || null) as TravelRate | null;
    if (saved?.id) {
      await nextTick();
      selectTravelRate(saved);
    }
  } catch (err: any) {
    travelEditorError.value =
      err?.message || 'Не удалось архивировать ставку проезда';
  } finally {
    travelSaving.value = false;
  }
}

function buildAccrualQuery(): URLSearchParams {
  const params = new URLSearchParams({
    page: String(accrualPage.value),
    limit: String(accrualLimit.value),
  });
  if (accrualFilters.search.trim())
    params.set('search', accrualFilters.search.trim());
  if (accrualFilters.status) params.set('status', accrualFilters.status);
  if (accrualFilters.source) params.set('source', accrualFilters.source);
  if (accrualFilters.dateFrom) params.set('date_from', accrualFilters.dateFrom);
  if (accrualFilters.dateTo) params.set('date_to', accrualFilters.dateTo);
  return params;
}

function buildRegistryQuery(includePagination = true): URLSearchParams {
  const params = new URLSearchParams();
  if (includePagination) {
    params.set('page', String(registryPage.value));
    params.set('limit', String(registryLimit.value));
  }
  if (registryFilters.dateFrom)
    params.set('date_from', registryFilters.dateFrom);
  if (registryFilters.dateTo) params.set('date_to', registryFilters.dateTo);
  if (registryFilters.taxationTypeAlias) {
    params.set('taxation_type_alias', registryFilters.taxationTypeAlias);
  }
  return params;
}

async function loadAccruals(): Promise<void> {
  accrualLoading.value = true;
  accrualError.value = '';
  try {
    const response = (await apiFetch(
      `/tournaments/${props.tournamentId}/referee-accruals?${buildAccrualQuery().toString()}`
    )) as AccrualListResponse;
    accrualRows.value = response.accruals || [];
    accrualTotal.value = Number(response.total || 0);
    if (
      selectedAccrualId.value &&
      !accrualRows.value.some(
        (row) => String(row.id) === String(selectedAccrualId.value)
      )
    ) {
      selectedAccrualId.value = '';
      selectedAccrual.value = null;
      selectedAuditEvents.value = [];
    }
    const firstAccrual = accrualRows.value[0];
    if (!selectedAccrualId.value && firstAccrual) {
      void openAccrual(firstAccrual.id);
    }
  } catch (err: any) {
    accrualRows.value = [];
    accrualTotal.value = 0;
    selectedAccrual.value = null;
    selectedAuditEvents.value = [];
    accrualError.value = err?.message || 'Не удалось загрузить начисления';
  } finally {
    accrualLoading.value = false;
  }
}

async function loadRegistry(): Promise<void> {
  registryLoading.value = true;
  registryError.value = '';
  try {
    const response = (await apiFetch(
      `/tournaments/${props.tournamentId}/referee-payment-registry?${buildRegistryQuery().toString()}`
    )) as PaymentRegistryResponse;
    registryRows.value = response.rows || [];
    registryTotal.value = Number(response.total || 0);
    registrySummary.value = {
      referees_total: Number(response.summary?.referees_total || 0),
      ready_total: Number(response.summary?.ready_total || 0),
      incomplete_total: Number(response.summary?.incomplete_total || 0),
      total_amount_rub: String(response.summary?.total_amount_rub || '0.00'),
    };
    registryFilterOptions.taxationTypes =
      response.filter_options?.taxation_types || [];
    registryLoaded.value = true;
  } catch (err: any) {
    registryRows.value = [];
    registryTotal.value = 0;
    registrySummary.value = {
      referees_total: 0,
      ready_total: 0,
      incomplete_total: 0,
      total_amount_rub: '0.00',
    };
    registryError.value = err?.message || 'Не удалось загрузить реестр оплат';
  } finally {
    registryLoading.value = false;
  }
}

async function openAccrual(id: string): Promise<void> {
  if (!id) return;
  selectedAccrualId.value = String(id);
  accrualDetailLoading.value = true;
  accrualDetailError.value = '';
  try {
    const response = (await apiFetch(
      `/tournaments/${props.tournamentId}/referee-accruals/${id}`
    )) as AccrualDetailResponse;
    selectedAccrual.value = response.document || null;
    selectedAuditEvents.value = response.audit_events || [];
  } catch (err: any) {
    selectedAccrual.value = null;
    selectedAuditEvents.value = [];
    accrualDetailError.value =
      err?.message || 'Не удалось загрузить карточку начисления';
  } finally {
    accrualDetailLoading.value = false;
  }
}

function submitAccrualFilters(): void {
  if (accrualPage.value !== 1) {
    accrualPage.value = 1;
    return;
  }
  void loadAccruals();
}

function resetAccrualFilters(): void {
  accrualFilters.search = '';
  accrualFilters.status = '';
  accrualFilters.source = '';
  accrualFilters.dateFrom = '';
  accrualFilters.dateTo = '';
  showAccrualFilters.value = false;
  if (accrualPage.value !== 1) {
    accrualPage.value = 1;
    return;
  }
  void loadAccruals();
}

function submitRegistryFilters(): void {
  if (registryPage.value !== 1) {
    registryPage.value = 1;
    return;
  }
  void loadRegistry();
}

function resetRegistryFilters(): void {
  registryFilters.dateFrom = '';
  registryFilters.dateTo = '';
  registryFilters.taxationTypeAlias = '';
  if (registryPage.value !== 1) {
    registryPage.value = 1;
    return;
  }
  void loadRegistry();
}

async function exportRegistry(): Promise<void> {
  registryExporting.value = true;
  try {
    const blob = await apiFetchBlob(
      `/tournaments/${props.tournamentId}/referee-payment-registry/export.xlsx?${buildRegistryQuery(false).toString()}`
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = buildRegistryExportFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Реестр выгружен');
  } catch (err: any) {
    showToast(err?.message || 'Не удалось выгрузить реестр', 'danger');
  } finally {
    registryExporting.value = false;
  }
}

async function generateAccruals(apply: boolean): Promise<void> {
  generationLoading.value = true;
  generationError.value = '';
  try {
    const response = (await apiFetch(
      `/tournaments/${props.tournamentId}/referee-accruals/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_date: generationForm.from_date || null,
          to_date: generationForm.to_date || null,
          apply,
        }),
      }
    )) as GenerationResult;
    generationResult.value = response;
    if (apply) {
      showToast('Черновики начислений сформированы');
      await Promise.all([loadAccruals(), loadDashboard()]);
      mainTab.value = 'accruals';
    }
  } catch (err: any) {
    generationError.value =
      err?.message || 'Не удалось сформировать начисления';
  } finally {
    generationLoading.value = false;
  }
}

function resetGeneration(): void {
  generationError.value = '';
  generationResult.value = null;
  if (dashboard.value?.schedule_dates?.length) {
    generationForm.from_date = String(
      dashboard.value.schedule_dates[0]?.day || ''
    );
    generationForm.to_date = String(
      dashboard.value.schedule_dates[dashboard.value.schedule_dates.length - 1]
        ?.day || ''
    );
    return;
  }
  generationForm.from_date = '';
  generationForm.to_date = '';
}

async function focusSetupSection(target: SetupTabKey): Promise<void> {
  mainTab.value = 'setup';
  setupTab.value = target;
  await nextTick();
  const element =
    target === 'tariffs' ? tariffIssuesRef.value : travelIssuesRef.value;
  element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function handleGenerationHint(alias: string): Promise<void> {
  if (alias === 'missing_tariff_rule' || alias === 'missing_stage_group') {
    await focusSetupSection('tariffs');
    return;
  }
  if (
    alias === 'missing_ground_travel_rate' ||
    alias === 'missing_match_ground'
  ) {
    await focusSetupSection('travel');
  }
}

function openTariffIssuesCard(): void {
  mainTab.value = 'setup';
  setupTab.value = 'tariffs';
  showTariffMatrix.value = false;
  nextTick(() => {
    tariffIssuesRef.value?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  });
}

function openTravelIssuesCard(): void {
  mainTab.value = 'setup';
  setupTab.value = 'travel';
  showAllGroundCoverage.value = false;
  nextTick(() => {
    travelIssuesRef.value?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  });
}

function openDraftAccrualsCard(): void {
  mainTab.value = 'accruals';
  accrualFilters.status = 'DRAFT';
  showAccrualFilters.value = true;
  submitAccrualFilters();
  nextTick(() => {
    mainCardRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

watch(coverageDate, (value, oldValue) => {
  if (!coverageInitialized.value || !value || value === oldValue) return;
  void loadDashboard(value);
  void loadTariffs();
});

watch(selectedGroundId, () => {
  void loadGroundTravelRates();
  if (selectedGroundId.value) {
    startCreateTravelRate();
  }
});

watch(
  () => filteredRoleOptions.value,
  (roles) => {
    const allowed = new Set(roles.map((role) => String(role.id)));
    if (!allowed.has(String(tariffForm.referee_role_id || ''))) {
      tariffForm.referee_role_id = roles[0]?.id || '';
    }
    if (
      tariffFilters.refereeRoleId &&
      !allowed.has(String(tariffFilters.refereeRoleId))
    ) {
      tariffFilters.refereeRoleId = '';
    }
  },
  { immediate: true }
);

watch(
  () => travelCoverageRows.value,
  (rows) => {
    const allowed = new Set(rows.map((row) => String(row.ground_id)));
    if (
      !selectedGroundId.value ||
      !allowed.has(String(selectedGroundId.value))
    ) {
      selectedGroundId.value =
        rows[0]?.ground_id ||
        dashboard.value?.travel_coverage_rows?.[0]?.ground_id ||
        '';
    }
  },
  { immediate: true }
);

watch([tariffPage, tariffLimit], () => {
  void loadTariffs();
});

watch([accrualPage, accrualLimit], () => {
  void loadAccruals();
});

watch([registryPage, registryLimit], () => {
  if (!registryLoaded.value) return;
  void loadRegistry();
});

watch(mainTab, (value) => {
  if (value === 'registry' && !registryLoaded.value) {
    void loadRegistry();
  }
});

onMounted(async () => {
  await Promise.all([loadRefData(), loadReferences(), loadDashboard()]);
  startCreateTariff();
  startCreateTravelRate();
  await Promise.all([loadTariffs(), loadAccruals()]);
});
</script>

<template>
  <div ref="mainCardRef" class="card section-card tile fade-in shadow-sm">
    <div class="card-body d-flex flex-column gap-3">
      <div
        class="d-flex flex-wrap justify-content-between gap-2 align-items-start"
      >
        <div>
          <h1 class="h5 mb-1">Оплата судей турнира</h1>
          <div class="small text-muted">
            Локальная настройка норм и проезда, контроль покрытия и формирование
            черновиков начислений.
          </div>
        </div>
        <a class="btn btn-outline-brand btn-sm" :href="globalAccountingHref">
          Открыть турнир в бухгалтерии
        </a>
      </div>

      <TabSelector
        :model-value="mainTab"
        :tabs="topTabs"
        v-bind="{ ariaLabel: 'Сценарии оплаты судей' }"
        @update:model-value="(value) => (mainTab = String(value) as MainTabKey)"
      />

      <div
        v-if="refDataError || dashboardError"
        class="d-flex flex-column gap-2"
      >
        <div v-if="refDataError" class="alert alert-danger mb-0">
          {{ refDataError }}
        </div>
        <div v-if="dashboardError" class="alert alert-danger mb-0">
          {{ dashboardError }}
        </div>
      </div>

      <div class="row g-3">
        <div class="col-12 col-md-4">
          <button
            type="button"
            class="btn w-100 text-start payment-kpi-card"
            :class="
              (dashboard?.summary.tariff_issue_count || 0) > 0
                ? 'payment-kpi-card--danger'
                : 'payment-kpi-card--success'
            "
            @click="openTariffIssuesCard"
          >
            <span class="small text-uppercase fw-semibold">Нормы оплаты</span>
            <span class="d-block payment-kpi-card__value">
              {{
                dashboard?.summary.tariff_issue_count
                  ? `${dashboard?.summary.tariff_issue_count} проблем`
                  : 'Покрытие в порядке'
              }}
            </span>
            <span class="small text-muted">
              Активных норм: {{ dashboard?.summary.active_tariff_rules || 0 }}
            </span>
          </button>
        </div>
        <div class="col-12 col-md-4">
          <button
            type="button"
            class="btn w-100 text-start payment-kpi-card"
            :class="
              (dashboard?.summary.travel_issue_count || 0) > 0
                ? 'payment-kpi-card--warning'
                : 'payment-kpi-card--success'
            "
            @click="openTravelIssuesCard"
          >
            <span class="small text-uppercase fw-semibold">Проезд</span>
            <span class="d-block payment-kpi-card__value">
              {{
                dashboard?.summary.travel_issue_count
                  ? `${dashboard?.summary.travel_issue_count} проблем`
                  : 'Покрытие в порядке'
              }}
            </span>
            <span class="small text-muted">
              Активных ставок: {{ dashboard?.summary.active_travel_rates || 0 }}
            </span>
          </button>
        </div>
        <div class="col-12 col-md-4">
          <button
            type="button"
            class="btn w-100 text-start payment-kpi-card payment-kpi-card--neutral"
            @click="openDraftAccrualsCard"
          >
            <span class="small text-uppercase fw-semibold"
              >Черновики начислений</span
            >
            <span class="d-block payment-kpi-card__value">
              {{ dashboard?.summary.draft_accruals || 0 }}
            </span>
            <span class="small text-muted"
              >Открыть список документов турнира</span
            >
          </button>
        </div>
      </div>

      <template v-if="mainTab === 'setup'">
        <TabSelector
          :model-value="setupTab"
          :tabs="setupTabs"
          v-bind="{ ariaLabel: 'Разделы настройки оплаты' }"
          @update:model-value="
            (value) => (setupTab = String(value) as SetupTabKey)
          "
        />

        <div class="border rounded-3 p-3 sticky-panel">
          <div class="row g-2 align-items-end">
            <div class="col-12 col-lg-4">
              <label class="form-label">Дата контроля покрытия</label>
              <select
                v-model="coverageDate"
                class="form-select"
                :disabled="dashboardLoading || !coverageDateOptions.length"
              >
                <option v-if="!coverageDateOptions.length" value="">
                  Нет дат матчей в турнире
                </option>
                <option
                  v-for="item in coverageDateOptions"
                  :key="item.day"
                  :value="item.day"
                >
                  {{ formatDate(item.day) }} ({{ item.count }})
                </option>
              </select>
            </div>
            <div class="col-12 col-lg-8">
              <div class="small text-muted pt-lg-4">
                Проверка покрытия идет по ближайшей дате матча или по выбранной
                дате. В списках ниже по умолчанию показаны только проблемные
                места, чтобы не перегружать экран.
              </div>
            </div>
          </div>
        </div>

        <BrandSpinner
          v-if="dashboardLoading && !dashboard"
          label="Загрузка состояния оплаты"
        />

        <template v-else-if="setupTab === 'tariffs'">
          <div class="row g-3 align-items-start">
            <div class="col-12 col-xl-7">
              <form
                class="border rounded-3 p-3"
                @submit.prevent="submitTariffFilters"
              >
                <div class="row g-2 align-items-end">
                  <div class="col-12 col-lg-4">
                    <label class="form-label">Быстрый поиск по коду</label>
                    <input
                      v-model="tariffFilters.search"
                      type="search"
                      class="form-control"
                      placeholder="A1"
                    />
                  </div>
                  <div class="col-6 col-lg-3">
                    <label class="form-label">Группа этапа</label>
                    <select
                      v-model="tariffFilters.stageGroupId"
                      class="form-select"
                    >
                      <option value="">Все</option>
                      <option
                        v-for="group in groupOptions"
                        :key="group.id"
                        :value="group.id"
                      >
                        {{ group.name }}
                      </option>
                    </select>
                  </div>
                  <div class="col-6 col-lg-3">
                    <label class="form-label">Амплуа</label>
                    <select
                      v-model="tariffFilters.refereeRoleId"
                      class="form-select"
                    >
                      <option value="">Все</option>
                      <option
                        v-for="role in filteredRoleOptions"
                        :key="role.id"
                        :value="role.id"
                      >
                        {{ role.name }}
                      </option>
                    </select>
                  </div>
                  <div class="col-6 col-lg-2">
                    <button type="submit" class="btn btn-brand w-100">
                      Найти
                    </button>
                  </div>
                  <div class="col-6 col-lg-2">
                    <button
                      type="button"
                      class="btn btn-outline-secondary w-100"
                      @click="showTariffFilters = !showTariffFilters"
                    >
                      Еще
                    </button>
                  </div>
                </div>

                <div
                  v-if="showTariffFilters"
                  class="row g-2 align-items-end mt-1"
                >
                  <div class="col-6 col-lg-2">
                    <button
                      type="button"
                      class="btn btn-outline-brand w-100"
                      @click="submitTariffFilters"
                    >
                      Применить
                    </button>
                  </div>
                  <div class="col-6 col-lg-2">
                    <button
                      type="button"
                      class="btn btn-outline-secondary w-100"
                      @click="resetTariffFilters"
                    >
                      Сбросить
                    </button>
                  </div>
                </div>
              </form>

              <div class="border rounded-3 p-3 mt-3">
                <div
                  class="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-2"
                >
                  <div>
                    <div class="fw-semibold">Список норм оплаты</div>
                    <div class="small text-muted">
                      Выберите строку для просмотра и редактирования
                    </div>
                  </div>
                  <button
                    type="button"
                    class="btn btn-outline-brand btn-sm"
                    @click="startCreateTariff()"
                  >
                    Добавить норму
                  </button>
                </div>

                <div v-if="tariffError" class="alert alert-danger py-2 mb-2">
                  {{ tariffError }}
                </div>
                <BrandSpinner
                  v-if="tariffLoading"
                  label="Загрузка норм оплаты"
                />

                <template v-else>
                  <div
                    class="d-none d-lg-block table-responsive desktop-table-wrap"
                  >
                    <table
                      class="table table-sm align-middle mb-0 desktop-table"
                    >
                      <thead>
                        <tr>
                          <th>Код</th>
                          <th>Группа</th>
                          <th>Амплуа</th>
                          <th>Период</th>
                          <th class="text-end">База</th>
                          <th class="text-end">Питание</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="row in tariffRows"
                          :key="row.id"
                          class="interactive-row"
                          :class="{
                            'table-active': selectedTariffId === row.id,
                          }"
                          @click="selectTariff(row)"
                        >
                          <td>
                            <span class="badge text-bg-light border">{{
                              row.fare_code
                            }}</span>
                          </td>
                          <td>{{ row.stage_group?.name || '—' }}</td>
                          <td>{{ row.referee_role?.name || '—' }}</td>
                          <td>
                            {{ formatDate(row.valid_from) }} —
                            {{ row.valid_to ? formatDate(row.valid_to) : '∞' }}
                          </td>
                          <td class="text-end">
                            {{ formatRub(row.base_amount_rub) }}
                          </td>
                          <td class="text-end">
                            {{ formatRub(row.meal_amount_rub) }}
                          </td>
                        </tr>
                        <tr v-if="!tariffRows.length">
                          <td colspan="6" class="text-center text-muted">
                            Нормы оплаты не найдены
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div class="d-flex d-lg-none flex-column gap-2">
                    <button
                      v-for="row in tariffRows"
                      :key="row.id"
                      type="button"
                      class="btn text-start border rounded-3 tariff-mobile-card"
                      :class="{
                        'tariff-mobile-card--active':
                          selectedTariffId === row.id,
                      }"
                      @click="selectTariff(row)"
                    >
                      <div
                        class="d-flex justify-content-between align-items-start gap-2"
                      >
                        <div>
                          <div class="fw-semibold">
                            {{ row.stage_group?.name || '—' }}
                          </div>
                          <div class="small text-muted">
                            {{ row.referee_role?.name || '—' }} ·
                            {{ row.fare_code }}
                          </div>
                        </div>
                      </div>
                      <div class="small text-muted mt-2">
                        {{ formatDate(row.valid_from) }} —
                        {{ row.valid_to ? formatDate(row.valid_to) : '∞' }}
                      </div>
                      <div class="small mt-1">
                        База {{ formatRub(row.base_amount_rub) }} ₽ · Питание
                        {{ formatRub(row.meal_amount_rub) }} ₽
                      </div>
                    </button>
                    <div
                      v-if="!tariffRows.length"
                      class="text-center text-muted small py-3"
                    >
                      Нормы оплаты не найдены
                    </div>
                  </div>

                  <PageNav
                    :page="tariffPage"
                    :total-pages="tariffTotalPages"
                    :page-size="tariffLimit"
                    :sizes="[20, 50, 100]"
                    @update:page="(value) => (tariffPage = value)"
                    @update:page-size="(value) => (tariffLimit = value)"
                  />
                </template>
              </div>

              <div ref="tariffIssuesRef" class="border rounded-3 p-3 mt-3">
                <div
                  class="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-2"
                >
                  <div>
                    <div class="fw-semibold">Проблемы покрытия норм</div>
                    <div class="small text-muted">
                      На дату {{ formatDate(coverageDate) }} показываются только
                      комбинации с отсутствующей или просроченной настройкой.
                    </div>
                  </div>
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm"
                    @click="showTariffMatrix = !showTariffMatrix"
                  >
                    {{
                      showTariffMatrix
                        ? 'Скрыть матрицу'
                        : 'Показать всю матрицу'
                    }}
                  </button>
                </div>

                <div class="d-flex flex-wrap gap-2 mb-3 small">
                  <span class="badge text-bg-success"
                    >Ок: {{ dashboard?.tariff_coverage_summary.ok || 0 }}</span
                  >
                  <span class="badge text-bg-warning text-dark">
                    Вне периода:
                    {{ dashboard?.tariff_coverage_summary.out_of_period || 0 }}
                  </span>
                  <span class="badge text-bg-danger">
                    Нет настройки:
                    {{ dashboard?.tariff_coverage_summary.missing || 0 }}
                  </span>
                </div>

                <div
                  v-if="!visibleTariffIssues.length"
                  class="text-muted small"
                >
                  Для выбранных фильтров проблем покрытия нет.
                </div>
                <div v-else class="d-flex flex-column gap-2">
                  <div
                    v-for="issue in visibleTariffIssues"
                    :key="`${issue.stage_group_id}:${issue.referee_role_id}`"
                    class="coverage-issue-row"
                  >
                    <div>
                      <div class="fw-semibold">
                        {{ issue.stage_group_name || 'Группа' }} ·
                        {{ issue.referee_role_name || 'Амплуа' }}
                      </div>
                      <div class="small text-muted">
                        {{
                          coverageStateLabel(issue.state, issue.active_count)
                        }}
                      </div>
                    </div>
                    <button
                      type="button"
                      class="btn btn-outline-brand btn-sm"
                      @click="
                        startCreateTariff({
                          stage_group_id: issue.stage_group_id,
                          referee_role_id: issue.referee_role_id,
                          valid_from: coverageDate || today,
                        })
                      "
                    >
                      Добавить норму
                    </button>
                  </div>
                </div>

                <div
                  v-if="showTariffMatrix"
                  class="table-responsive desktop-table-wrap mt-3"
                >
                  <table class="table table-sm align-middle mb-0 desktop-table">
                    <thead>
                      <tr>
                        <th>Группа этапа</th>
                        <th v-for="role in filteredRoleOptions" :key="role.id">
                          {{ role.name }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="row in dashboard?.tariff_coverage_matrix || []"
                        :key="row.stage_group.id"
                      >
                        <td>{{ row.stage_group.name }}</td>
                        <td
                          v-for="cell in row.role_states"
                          :key="cell.referee_role_id"
                        >
                          <span
                            class="badge"
                            :class="coverageStateBadgeClass(cell.state)"
                          >
                            {{ coverageStateLabel(cell.state) }}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div class="col-12 col-xl-5">
              <div class="border rounded-3 p-3 detail-card">
                <div
                  class="d-flex flex-wrap justify-content-between gap-2 align-items-start mb-3"
                >
                  <div>
                    <div class="fw-semibold">
                      {{
                        tariffEditorMode === 'edit'
                          ? 'Карточка нормы'
                          : 'Новая норма оплаты'
                      }}
                    </div>
                    <div class="small text-muted">
                      {{
                        tariffEditorMode === 'edit'
                          ? 'Редактирование выбранной нормы. Если она уже использовалась в начислениях, изменяйте через дублирование.'
                          : 'Создание новой нормы оплаты с сохранением в турнир.'
                      }}
                    </div>
                  </div>
                  <div class="d-flex gap-2">
                    <button
                      type="button"
                      class="btn btn-outline-secondary btn-sm"
                      @click="startCreateTariff()"
                    >
                      Очистить
                    </button>
                    <button
                      type="button"
                      class="btn btn-outline-brand btn-sm"
                      :disabled="!selectedTariff"
                      @click="duplicateTariff()"
                    >
                      Дублировать
                    </button>
                  </div>
                </div>

                <div v-if="tariffEditorError" class="alert alert-danger py-2">
                  {{ tariffEditorError }}
                </div>

                <div class="row g-2">
                  <div class="col-12 col-lg-4">
                    <label class="form-label">Код тарифа</label>
                    <input
                      v-model="tariffForm.fare_code"
                      type="text"
                      maxlength="8"
                      class="form-control"
                      placeholder="A1"
                    />
                  </div>
                  <div class="col-12 col-lg-8">
                    <label class="form-label">Группа этапа</label>
                    <select
                      v-model="tariffForm.stage_group_id"
                      class="form-select"
                    >
                      <option
                        v-for="group in groupOptions"
                        :key="group.id"
                        :value="group.id"
                      >
                        {{ group.name }}
                      </option>
                    </select>
                  </div>
                  <div class="col-12">
                    <label class="form-label">Амплуа судьи</label>
                    <select
                      v-model="tariffForm.referee_role_id"
                      class="form-select"
                      :disabled="!filteredRoleOptions.length"
                    >
                      <option v-if="!filteredRoleOptions.length" value="">
                        Нет амплуа с квотой больше нуля
                      </option>
                      <option
                        v-for="role in filteredRoleOptions"
                        :key="role.id"
                        :value="role.id"
                      >
                        {{ role.name }}
                      </option>
                    </select>
                  </div>
                  <div class="col-6">
                    <label class="form-label">База, ₽</label>
                    <input
                      v-model="tariffForm.base_amount_rub"
                      type="text"
                      class="form-control"
                      placeholder="0,00"
                    />
                  </div>
                  <div class="col-6">
                    <label class="form-label">Питание, ₽</label>
                    <input
                      v-model="tariffForm.meal_amount_rub"
                      type="text"
                      class="form-control"
                      placeholder="0,00"
                    />
                  </div>
                  <div class="col-6">
                    <label class="form-label">Действует с</label>
                    <input
                      v-model="tariffForm.valid_from"
                      type="date"
                      class="form-control"
                    />
                  </div>
                  <div class="col-6">
                    <label class="form-label">По</label>
                    <input
                      v-model="tariffForm.valid_to"
                      type="date"
                      class="form-control"
                    />
                  </div>
                </div>

                <div class="d-grid gap-2 mt-3">
                  <button
                    type="button"
                    class="btn btn-brand"
                    :disabled="tariffSaving || !tariffForm.referee_role_id"
                    @click="saveTariff"
                  >
                    {{
                      tariffEditorMode === 'edit'
                        ? 'Сохранить изменения'
                        : 'Создать норму'
                    }}
                  </button>
                </div>

                <div v-if="selectedTariff" class="d-flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    class="btn btn-outline-danger btn-sm"
                    :disabled="
                      tariffActionLoading === `delete:${selectedTariff.id}`
                    "
                    @click="deleteTariff"
                  >
                    Архивировать норму
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="row g-3 align-items-start">
            <div class="col-12 col-xl-7">
              <div ref="travelIssuesRef" class="border rounded-3 p-3">
                <div
                  class="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-2"
                >
                  <div>
                    <div class="fw-semibold">Проблемы покрытия проезда</div>
                    <div class="small text-muted">
                      По умолчанию показаны только арены с отсутствующей или
                      просроченной ставкой.
                    </div>
                  </div>
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm"
                    @click="showAllGroundCoverage = !showAllGroundCoverage"
                  >
                    {{
                      showAllGroundCoverage
                        ? 'Показывать только проблемы'
                        : 'Показать все арены'
                    }}
                  </button>
                </div>

                <div class="d-flex flex-wrap gap-2 mb-3 small">
                  <span class="badge text-bg-success"
                    >Ок: {{ dashboard?.travel_coverage_summary.ok || 0 }}</span
                  >
                  <span class="badge text-bg-warning text-dark">
                    Вне периода:
                    {{ dashboard?.travel_coverage_summary.out_of_period || 0 }}
                  </span>
                  <span class="badge text-bg-danger">
                    Нет настройки:
                    {{ dashboard?.travel_coverage_summary.missing || 0 }}
                  </span>
                </div>

                <div class="row g-2 align-items-end mb-2">
                  <div class="col-12 col-lg-8">
                    <label class="form-label">Поиск арены</label>
                    <input
                      v-model="travelGroundSearch"
                      type="search"
                      class="form-control"
                      placeholder="Название арены"
                    />
                  </div>
                  <div class="col-12 col-lg-4 small text-muted">
                    Выбрана дата {{ formatDate(coverageDate) }}
                  </div>
                </div>

                <div class="d-flex flex-column gap-2 coverage-list">
                  <button
                    v-for="ground in travelCoverageRows"
                    :key="ground.ground_id"
                    type="button"
                    class="btn text-start border rounded-3 coverage-item"
                    :class="{
                      'coverage-item--active':
                        selectedGroundId === ground.ground_id,
                    }"
                    @click="selectedGroundId = ground.ground_id"
                  >
                    <div
                      class="d-flex justify-content-between gap-2 align-items-center"
                    >
                      <div>
                        <div class="fw-semibold">
                          {{ ground.ground_name || 'Арена' }}
                        </div>
                        <div class="small text-muted">
                          {{
                            coverageStateLabel(
                              ground.state,
                              ground.active_count
                            )
                          }}
                        </div>
                      </div>
                      <span
                        class="badge"
                        :class="coverageStateBadgeClass(ground.state)"
                      >
                        {{ coverageStateLabel(ground.state) }}
                      </span>
                    </div>
                  </button>
                  <div
                    v-if="!travelCoverageRows.length"
                    class="text-muted small py-2"
                  >
                    Подходящих арен не найдено.
                  </div>
                </div>
              </div>

              <div class="border rounded-3 p-3 mt-3">
                <div
                  class="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-2"
                >
                  <div>
                    <div class="fw-semibold">Ставки по выбранной арене</div>
                    <div class="small text-muted">
                      {{
                        selectedGroundCoverage?.ground_name ||
                        'Выберите арену слева'
                      }}
                    </div>
                  </div>
                  <button
                    type="button"
                    class="btn btn-outline-brand btn-sm"
                    :disabled="!selectedGroundId"
                    @click="startCreateTravelRate()"
                  >
                    Добавить ставку
                  </button>
                </div>

                <div
                  v-if="travelRatesError"
                  class="alert alert-danger py-2 mb-2"
                >
                  {{ travelRatesError }}
                </div>
                <BrandSpinner
                  v-if="travelRatesLoading"
                  label="Загрузка ставок проезда"
                />
                <template v-else>
                  <div class="d-flex flex-column gap-2">
                    <button
                      v-for="rate in travelRates"
                      :key="rate.id"
                      type="button"
                      class="btn text-start border rounded-3"
                      :class="{
                        'coverage-item--active':
                          selectedTravelRateId === rate.id,
                      }"
                      @click="selectTravelRate(rate)"
                    >
                      <div
                        class="d-flex justify-content-between align-items-start gap-2"
                      >
                        <div>
                          <div class="fw-semibold">
                            {{ rate.rate_code || 'Без кода' }}
                          </div>
                          <div class="small text-muted">
                            {{ formatDate(rate.valid_from) }} —
                            {{
                              rate.valid_to ? formatDate(rate.valid_to) : '∞'
                            }}
                          </div>
                        </div>
                      </div>
                      <div class="small mt-1">
                        {{ formatRub(rate.travel_amount_rub) }} ₽
                      </div>
                    </button>
                    <div
                      v-if="!travelRates.length"
                      class="text-muted small py-2"
                    >
                      Для выбранной арены ставки пока не заведены.
                    </div>
                  </div>
                </template>
              </div>
            </div>

            <div class="col-12 col-xl-5">
              <div class="border rounded-3 p-3 detail-card">
                <div
                  class="d-flex flex-wrap justify-content-between gap-2 align-items-start mb-3"
                >
                  <div>
                    <div class="fw-semibold">
                      {{
                        travelEditorMode === 'edit'
                          ? 'Карточка ставки проезда'
                          : 'Новая ставка проезда'
                      }}
                    </div>
                    <div class="small text-muted">
                      {{
                        selectedGroundCoverage?.ground_name ||
                        'Выберите арену, затем заполните ставку.'
                      }}
                    </div>
                  </div>
                  <div class="d-flex gap-2">
                    <button
                      type="button"
                      class="btn btn-outline-secondary btn-sm"
                      :disabled="!selectedGroundId"
                      @click="startCreateTravelRate()"
                    >
                      Очистить
                    </button>
                    <button
                      type="button"
                      class="btn btn-outline-brand btn-sm"
                      :disabled="!selectedTravelRate"
                      @click="duplicateTravelRate()"
                    >
                      Дублировать
                    </button>
                  </div>
                </div>

                <div v-if="travelEditorError" class="alert alert-danger py-2">
                  {{ travelEditorError }}
                </div>

                <div class="row g-2">
                  <div class="col-12">
                    <label class="form-label">Код ставки</label>
                    <input
                      v-model="travelForm.rate_code"
                      type="text"
                      class="form-control"
                      placeholder="TRV1"
                    />
                  </div>
                  <div class="col-12">
                    <label class="form-label">Сумма, ₽</label>
                    <input
                      v-model="travelForm.travel_amount_rub"
                      type="text"
                      class="form-control"
                      placeholder="0,00"
                    />
                  </div>
                  <div class="col-6">
                    <label class="form-label">Действует с</label>
                    <input
                      v-model="travelForm.valid_from"
                      type="date"
                      class="form-control"
                    />
                  </div>
                  <div class="col-6">
                    <label class="form-label">По</label>
                    <input
                      v-model="travelForm.valid_to"
                      type="date"
                      class="form-control"
                    />
                  </div>
                </div>

                <div class="d-grid gap-2 mt-3">
                  <button
                    type="button"
                    class="btn btn-brand"
                    :disabled="travelSaving || !selectedGroundId"
                    @click="saveTravelRate"
                  >
                    {{
                      travelEditorMode === 'edit'
                        ? 'Сохранить изменения'
                        : 'Создать ставку'
                    }}
                  </button>
                </div>

                <div
                  v-if="selectedTravelRate"
                  class="d-flex flex-wrap gap-2 mt-3"
                >
                  <button
                    type="button"
                    class="btn btn-outline-danger btn-sm"
                    :disabled="travelSaving"
                    @click="deleteTravelRate"
                  >
                    Архивировать ставку
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>

      <template v-else-if="mainTab === 'accruals'">
        <div class="border rounded-3 p-3 sticky-panel">
          <div class="row g-2 align-items-end">
            <div class="col-12 col-lg-3">
              <label class="form-label">Период с</label>
              <input
                v-model="generationForm.from_date"
                type="date"
                class="form-control"
              />
            </div>
            <div class="col-12 col-lg-3">
              <label class="form-label">Период по</label>
              <input
                v-model="generationForm.to_date"
                type="date"
                class="form-control"
              />
            </div>
            <div class="col-12 col-lg-6">
              <div class="small text-muted mb-2">
                В расчет попадут только допустимые назначения по завершенным
                матчам выбранного периода.
              </div>
              <div class="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  :disabled="generationLoading"
                  @click="resetGeneration"
                >
                  Сбросить
                </button>
                <button
                  type="button"
                  class="btn btn-outline-brand"
                  :disabled="generationLoading"
                  @click="generateAccruals(false)"
                >
                  Предпросмотр
                </button>
                <button
                  type="button"
                  class="btn btn-brand"
                  :disabled="generationLoading"
                  @click="generateAccruals(true)"
                >
                  Создать черновики
                </button>
              </div>
            </div>
          </div>

          <div v-if="generationError" class="alert alert-danger mt-2 mb-0">
            {{ generationError }}
          </div>
        </div>

        <div v-if="generationResult" class="border rounded-3 p-3">
          <div class="fw-semibold mb-2">Что получилось по расчету</div>
          <div class="row g-2 small">
            <div class="col-6 col-lg-2">
              Матчей: {{ generationResult.summary.eligible_matches || 0 }}
            </div>
            <div class="col-6 col-lg-2">
              Назначений:
              {{ generationResult.summary.eligible_assignments || 0 }}
            </div>
            <div class="col-6 col-lg-2">
              Рассчитано: {{ generationResult.summary.calculated || 0 }}
            </div>
            <div class="col-6 col-lg-2">
              Создано: {{ generationResult.summary.created || 0 }}
            </div>
            <div class="col-6 col-lg-2">
              Пропущено: {{ generationResult.summary.skipped_existing || 0 }}
            </div>
            <div class="col-6 col-lg-2">
              Ошибок: {{ generationResult.summary.errors || 0 }}
            </div>
          </div>
          <div v-if="generationErrorChips.length" class="mt-3">
            <div class="fw-semibold small mb-2">Что мешает расчету</div>
            <div class="d-flex flex-wrap gap-2">
              <button
                v-for="item in generationErrorChips"
                :key="item.alias"
                type="button"
                class="btn btn-sm btn-outline-danger"
                @click="handleGenerationHint(item.alias)"
              >
                {{ item.label }}: {{ item.count }}
              </button>
            </div>
          </div>
        </div>

        <div class="row g-3 align-items-start">
          <div class="col-12 col-xxl-7">
            <form
              class="border rounded-3 p-3"
              @submit.prevent="submitAccrualFilters"
            >
              <div class="row g-2 align-items-end">
                <div class="col-12 col-lg-4">
                  <label class="form-label">Быстрый поиск</label>
                  <input
                    v-model="accrualFilters.search"
                    type="search"
                    class="form-control"
                    placeholder="№ начисления, судья, матч"
                  />
                </div>
                <div class="col-6 col-lg-3">
                  <label class="form-label">Статус</label>
                  <select v-model="accrualFilters.status" class="form-select">
                    <option value="">Все</option>
                    <option
                      v-for="status in refData.documentStatuses"
                      :key="status.id"
                      :value="status.alias"
                    >
                      {{ status.name_ru }}
                    </option>
                  </select>
                </div>
                <div class="col-6 col-lg-3">
                  <label class="form-label">Источник</label>
                  <select v-model="accrualFilters.source" class="form-select">
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
                  <button type="submit" class="btn btn-brand w-100">
                    Найти
                  </button>
                </div>
                <div class="col-6 col-lg-2">
                  <button
                    type="button"
                    class="btn btn-outline-secondary w-100"
                    @click="showAccrualFilters = !showAccrualFilters"
                  >
                    Еще
                  </button>
                </div>
              </div>

              <div
                v-if="showAccrualFilters"
                class="row g-2 align-items-end mt-1"
              >
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
                <div class="col-6 col-lg-2">
                  <button
                    type="button"
                    class="btn btn-outline-brand w-100"
                    @click="submitAccrualFilters"
                  >
                    Применить
                  </button>
                </div>
                <div class="col-6 col-lg-2">
                  <button
                    type="button"
                    class="btn btn-outline-secondary w-100"
                    @click="resetAccrualFilters"
                  >
                    Сбросить
                  </button>
                </div>
              </div>
            </form>

            <div class="border rounded-3 p-3 mt-3">
              <div
                class="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-2"
              >
                <div>
                  <div class="fw-semibold">Начисления турнира</div>
                  <div class="small text-muted">
                    Компактный просмотр документов. Полные бухгалтерские
                    операции доступны в общем реестре.
                  </div>
                </div>
                <a
                  class="btn btn-outline-brand btn-sm"
                  :href="globalAccountingHref"
                >
                  Открыть в бухгалтерии
                </a>
              </div>

              <div v-if="accrualError" class="alert alert-danger py-2 mb-2">
                {{ accrualError }}
              </div>
              <BrandSpinner v-if="accrualLoading" label="Загрузка начислений" />

              <template v-else>
                <div
                  class="d-none d-lg-block table-responsive desktop-table-wrap"
                >
                  <table class="table table-sm align-middle mb-0 desktop-table">
                    <thead>
                      <tr>
                        <th>№ начисления</th>
                        <th>Дата</th>
                        <th>Судья</th>
                        <th>Матч</th>
                        <th>Код</th>
                        <th class="text-end">Итого</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="row in accrualRows"
                        :key="row.id"
                        class="interactive-row"
                        :class="{
                          'table-active': selectedAccrualId === row.id,
                        }"
                        @click="openAccrual(row.id)"
                      >
                        <td>{{ row.accrual_number }}</td>
                        <td>{{ formatDate(row.match_date_snapshot) }}</td>
                        <td>{{ fullName(row.referee) || '—' }}</td>
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
                      </tr>
                      <tr v-if="!accrualRows.length">
                        <td colspan="7" class="text-center text-muted">
                          Начисления не найдены
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div class="d-flex d-lg-none flex-column gap-2">
                  <button
                    v-for="row in accrualRows"
                    :key="row.id"
                    type="button"
                    class="btn text-start border rounded-3 tariff-mobile-card"
                    :class="{
                      'tariff-mobile-card--active':
                        selectedAccrualId === row.id,
                    }"
                    @click="openAccrual(row.id)"
                  >
                    <div
                      class="d-flex justify-content-between gap-2 align-items-start"
                    >
                      <div>
                        <div class="fw-semibold">{{ row.accrual_number }}</div>
                        <div class="small text-muted">
                          {{ fullName(row.referee) || '—' }}
                        </div>
                      </div>
                      <span
                        class="badge"
                        :class="
                          statusBadgeClass(String(row.status?.alias || ''))
                        "
                      >
                        {{ statusName(row.status) }}
                      </span>
                    </div>
                    <div class="small text-muted mt-2">
                      {{ row.match?.home_team?.name || '—' }} -
                      {{ row.match?.away_team?.name || '—' }}
                    </div>
                    <div class="small mt-1">
                      {{ formatDate(row.match_date_snapshot) }} ·
                      {{ formatRub(row.total_amount_rub) }} ₽
                    </div>
                  </button>
                  <div
                    v-if="!accrualRows.length"
                    class="text-center text-muted small py-3"
                  >
                    Начисления не найдены
                  </div>
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
            <div class="border rounded-3 p-3 detail-card">
              <div
                class="d-flex flex-wrap justify-content-between gap-2 align-items-start mb-3"
              >
                <div>
                  <div class="fw-semibold">Карточка начисления</div>
                  <div class="small text-muted">
                    Детали документа, проводки и история изменений.
                  </div>
                </div>
                <a
                  v-if="selectedAccrual"
                  class="btn btn-outline-brand btn-sm"
                  :href="selectedAccountingHref"
                >
                  Открыть в бухгалтерии
                </a>
              </div>

              <div v-if="accrualDetailError" class="alert alert-danger py-2">
                {{ accrualDetailError }}
              </div>
              <BrandSpinner
                v-else-if="accrualDetailLoading"
                label="Загрузка карточки"
              />

              <template v-else-if="selectedAccrual">
                <div class="d-flex flex-column gap-2 small mb-3">
                  <div>
                    <strong>№:</strong> {{ selectedAccrual.accrual_number }}
                  </div>
                  <div>
                    <strong>Статус:</strong>
                    <span
                      class="badge ms-1"
                      :class="
                        statusBadgeClass(
                          String(selectedAccrual.status?.alias || '')
                        )
                      "
                    >
                      {{ statusName(selectedAccrual.status) }}
                    </span>
                  </div>
                  <div>
                    <strong>Судья:</strong>
                    {{ fullName(selectedAccrual.referee) || '—' }}
                  </div>
                  <div>
                    <strong>Матч:</strong>
                    {{ selectedAccrual.match?.home_team?.name || '—' }} -
                    {{ selectedAccrual.match?.away_team?.name || '—' }}
                  </div>
                  <div>
                    <strong>Дата:</strong>
                    {{ formatDate(selectedAccrual.match_date_snapshot) }}
                  </div>
                  <div>
                    <strong>Код тарифа:</strong>
                    {{ selectedAccrual.fare_code_snapshot || '—' }}
                  </div>
                  <div>
                    <strong>Итого:</strong>
                    {{ formatRub(selectedAccrual.total_amount_rub) }} ₽
                  </div>
                </div>

                <div class="detail-block">
                  <div class="fw-semibold small mb-2">Состав суммы</div>
                  <div class="small d-flex flex-column gap-1">
                    <div class="d-flex justify-content-between gap-2">
                      <span>База</span>
                      <span
                        >{{
                          formatRub(selectedAccrual.base_amount_rub)
                        }}
                        ₽</span
                      >
                    </div>
                    <div class="d-flex justify-content-between gap-2">
                      <span>Питание</span>
                      <span
                        >{{
                          formatRub(selectedAccrual.meal_amount_rub)
                        }}
                        ₽</span
                      >
                    </div>
                    <div class="d-flex justify-content-between gap-2">
                      <span>Проезд</span>
                      <span
                        >{{
                          formatRub(selectedAccrual.travel_amount_rub)
                        }}
                        ₽</span
                      >
                    </div>
                  </div>
                </div>

                <div class="detail-block">
                  <div class="fw-semibold small mb-2">Проводки</div>
                  <div
                    v-if="selectedAccrual.postings?.length"
                    class="small d-flex flex-column gap-1"
                  >
                    <div
                      v-for="line in selectedAccrual.postings"
                      :key="line.id"
                      class="d-flex justify-content-between gap-2"
                    >
                      <span>
                        {{ line.posting_type?.name_ru || '—' }} /
                        {{ line.component?.name_ru || '—' }}
                      </span>
                      <span>{{ formatRub(line.amount_rub) }} ₽</span>
                    </div>
                  </div>
                  <div v-else class="small text-muted">Проводок нет</div>
                </div>

                <div class="detail-block">
                  <div class="fw-semibold small mb-2">Цепочка документа</div>
                  <div class="small d-flex flex-column gap-1">
                    <div v-if="selectedAccrual.original_document">
                      Исходный документ:
                      {{ selectedAccrual.original_document.accrual_number }}
                    </div>
                    <div v-if="selectedAccrual.adjustments?.length">
                      Корректировки:
                    </div>
                    <div
                      v-for="item in selectedAccrual.adjustments || []"
                      :key="item.id"
                      class="d-flex justify-content-between gap-2"
                    >
                      <span>{{ item.accrual_number }}</span>
                      <span>{{ formatRub(item.total_amount_rub) }} ₽</span>
                    </div>
                    <div
                      v-if="
                        !selectedAccrual.original_document &&
                        !(selectedAccrual.adjustments || []).length
                      "
                      class="text-muted"
                    >
                      Связанных документов нет
                    </div>
                  </div>
                </div>

                <div class="detail-block">
                  <div class="fw-semibold small mb-2">Аудит</div>
                  <div
                    v-if="selectedAuditEvents.length"
                    class="small d-flex flex-column gap-1 timeline-list"
                  >
                    <div
                      v-for="event in selectedAuditEvents"
                      :key="event.id"
                      class="text-muted"
                    >
                      {{ formatDateTime(event.created_at) }} ·
                      {{ event.action }} ·
                      {{ fullName(event.actor) || 'Система' }}
                    </div>
                  </div>
                  <div v-else class="small text-muted">Событий пока нет</div>
                </div>
              </template>

              <div v-else class="small text-muted">
                Выберите начисление слева, чтобы открыть карточку документа.
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <form
          class="border rounded-3 p-3 sticky-panel"
          @submit.prevent="submitRegistryFilters"
        >
          <div class="row g-2 align-items-end">
            <div class="col-12 col-lg-3">
              <label class="form-label">Дата матча с</label>
              <input
                v-model="registryFilters.dateFrom"
                type="date"
                class="form-control"
              />
            </div>
            <div class="col-12 col-lg-3">
              <label class="form-label">Дата матча по</label>
              <input
                v-model="registryFilters.dateTo"
                type="date"
                class="form-control"
              />
            </div>
            <div class="col-12 col-lg-3">
              <label class="form-label">Тип занятости</label>
              <select
                v-model="registryFilters.taxationTypeAlias"
                class="form-select"
              >
                <option value="">Все</option>
                <option
                  v-for="item in registryFilterOptions.taxationTypes"
                  :key="item.alias"
                  :value="item.alias"
                >
                  {{ item.name }}
                </option>
              </select>
            </div>
            <div class="col-6 col-lg-1">
              <button type="submit" class="btn btn-brand w-100">Найти</button>
            </div>
            <div class="col-6 col-lg-1">
              <button
                type="button"
                class="btn btn-outline-secondary w-100"
                @click="resetRegistryFilters"
              >
                Сбросить
              </button>
            </div>
            <div class="col-12 col-lg-1">
              <button
                type="button"
                class="btn btn-outline-brand w-100"
                :disabled="registryExporting || registryLoading"
                @click="exportRegistry"
              >
                <span
                  v-if="registryExporting"
                  class="spinner-border spinner-border-sm"
                  aria-hidden="true"
                ></span>
                <span v-else>XLSX</span>
              </button>
            </div>
          </div>
        </form>

        <div class="row g-3">
          <div class="col-12 col-md-6 col-xl-3">
            <div class="payment-kpi-card payment-kpi-card--neutral h-100">
              <span class="small text-uppercase fw-semibold">Судей</span>
              <span class="d-block payment-kpi-card__value">
                {{ registrySummary.referees_total || 0 }}
              </span>
              <span class="small text-muted">Строк в итоговом реестре</span>
            </div>
          </div>
          <div class="col-12 col-md-6 col-xl-3">
            <div class="payment-kpi-card payment-kpi-card--success h-100">
              <span class="small text-uppercase fw-semibold">Готово</span>
              <span class="d-block payment-kpi-card__value">
                {{ registrySummary.ready_total || 0 }}
              </span>
              <span class="small text-muted">Полные платежные реквизиты</span>
            </div>
          </div>
          <div class="col-12 col-md-6 col-xl-3">
            <div class="payment-kpi-card payment-kpi-card--warning h-100">
              <span class="small text-uppercase fw-semibold"
                >Есть пропуски</span
              >
              <span class="d-block payment-kpi-card__value">
                {{ registrySummary.incomplete_total || 0 }}
              </span>
              <span class="small text-muted"
                >Требуется дозаполнение профиля</span
              >
            </div>
          </div>
          <div class="col-12 col-md-6 col-xl-3">
            <div class="payment-kpi-card payment-kpi-card--neutral h-100">
              <span class="small text-uppercase fw-semibold">Сумма</span>
              <span class="d-block payment-kpi-card__value">
                {{ formatRub(registrySummary.total_amount_rub) }}
              </span>
              <span class="small text-muted">К выплате по фильтру</span>
            </div>
          </div>
        </div>

        <div class="border rounded-3 p-3">
          <div
            class="d-flex flex-wrap justify-content-between gap-2 align-items-start mb-2"
          >
            <div>
              <div class="fw-semibold">Реестр оплат судей</div>
              <div class="small text-muted">
                Одна строка на судью. Сумма агрегируется по начисленным
                документам турнира.
              </div>
            </div>
            <div class="small text-muted">
              Проблемные строки остаются в реестре и помечаются отдельно.
            </div>
          </div>

          <div v-if="registryError" class="alert alert-danger py-2 mb-2">
            {{ registryError }}
          </div>
          <BrandSpinner v-if="registryLoading" label="Загрузка реестра" />

          <template v-else>
            <div class="d-none d-lg-block table-responsive desktop-table-wrap">
              <table class="table table-sm align-middle mb-0 desktop-table">
                <thead>
                  <tr>
                    <th>Фамилия</th>
                    <th>Имя</th>
                    <th>Отчество</th>
                    <th>ИНН</th>
                    <th>Телефон</th>
                    <th>Номер банковского счета</th>
                    <th>БИК</th>
                    <th>Корр. счет</th>
                    <th class="text-end">Сумма</th>
                    <th>Тип налогообложения</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in registryRows" :key="row.referee_id">
                    <td>{{ row.last_name || '—' }}</td>
                    <td>{{ row.first_name || '—' }}</td>
                    <td>{{ row.patronymic || '—' }}</td>
                    <td>{{ row.inn || '—' }}</td>
                    <td>{{ row.phone || '—' }}</td>
                    <td>{{ row.bank_account_number || '—' }}</td>
                    <td>{{ row.bic || '—' }}</td>
                    <td>{{ row.correspondent_account || '—' }}</td>
                    <td class="text-end">
                      {{ formatRub(row.total_amount_rub) }}
                    </td>
                    <td>{{ row.taxation_type || '—' }}</td>
                    <td>
                      <span
                        v-if="row.missing_fields.length"
                        class="badge text-bg-warning text-dark"
                        :title="`Пропущены поля: ${registryMissingFieldLabels(row.missing_fields).join(', ')}`"
                      >
                        Пропуски
                      </span>
                      <span v-else class="badge text-bg-success">Готово</span>
                    </td>
                  </tr>
                  <tr v-if="!registryRows.length">
                    <td colspan="11" class="text-center text-muted">
                      Реестр по выбранным фильтрам пуст
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="d-flex d-lg-none flex-column gap-2">
              <article
                v-for="row in registryRows"
                :key="row.referee_id"
                class="border rounded-3 p-3 registry-mobile-card"
              >
                <div
                  class="d-flex justify-content-between gap-2 align-items-start"
                >
                  <div>
                    <div class="fw-semibold">
                      {{ registryFullName(row) || 'Судья без ФИО' }}
                    </div>
                    <div class="small text-muted">
                      {{ row.taxation_type || 'Тип налогообложения не указан' }}
                    </div>
                  </div>
                  <span
                    v-if="row.missing_fields.length"
                    class="badge text-bg-warning text-dark"
                    :title="`Пропущены поля: ${registryMissingFieldLabels(row.missing_fields).join(', ')}`"
                  >
                    Пропуски
                  </span>
                  <span v-else class="badge text-bg-success">Готово</span>
                </div>
                <div class="row g-2 small mt-2">
                  <div class="col-6">
                    <div class="text-muted">ИНН</div>
                    <div>{{ row.inn || '—' }}</div>
                  </div>
                  <div class="col-6">
                    <div class="text-muted">Телефон</div>
                    <div>{{ row.phone || '—' }}</div>
                  </div>
                  <div class="col-12">
                    <div class="text-muted">Счет</div>
                    <div>{{ row.bank_account_number || '—' }}</div>
                  </div>
                  <div class="col-6">
                    <div class="text-muted">БИК</div>
                    <div>{{ row.bic || '—' }}</div>
                  </div>
                  <div class="col-6">
                    <div class="text-muted">Корр. счет</div>
                    <div>{{ row.correspondent_account || '—' }}</div>
                  </div>
                </div>
                <div class="registry-mobile-card__sum mt-3">
                  {{ formatRub(row.total_amount_rub) }} ₽
                </div>
                <div
                  v-if="row.missing_fields.length"
                  class="small text-warning-emphasis mt-2"
                >
                  Пропущены поля:
                  {{
                    registryMissingFieldLabels(row.missing_fields).join(', ')
                  }}
                </div>
              </article>
              <div
                v-if="!registryRows.length"
                class="text-center text-muted small py-3"
              >
                Реестр по выбранным фильтрам пуст
              </div>
            </div>

            <PageNav
              :page="registryPage"
              :total-pages="registryTotalPages"
              :page-size="registryLimit"
              :sizes="[20, 50, 100]"
              @update:page="(value) => (registryPage = value)"
              @update:page-size="(value) => (registryLimit = value)"
            />
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.sticky-panel {
  position: sticky;
  top: 10px;
  z-index: 3;
  background: #fff;
  box-shadow: inset 0 -1px 0 rgba(17, 56, 103, 0.08);
}

.payment-kpi-card {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-section);
  background: #fff;
  padding: 1rem;
  min-height: 124px;
}

.payment-kpi-card--danger {
  border-color: rgba(220, 53, 69, 0.22);
  background: linear-gradient(
    180deg,
    rgba(220, 53, 69, 0.06),
    rgba(255, 255, 255, 0.92)
  );
}

.payment-kpi-card--warning {
  border-color: rgba(255, 193, 7, 0.28);
  background: linear-gradient(
    180deg,
    rgba(255, 193, 7, 0.08),
    rgba(255, 255, 255, 0.92)
  );
}

.payment-kpi-card--success {
  border-color: rgba(25, 135, 84, 0.2);
  background: linear-gradient(
    180deg,
    rgba(25, 135, 84, 0.06),
    rgba(255, 255, 255, 0.92)
  );
}

.payment-kpi-card--neutral {
  border-color: rgba(17, 56, 103, 0.16);
  background: linear-gradient(
    180deg,
    rgba(17, 56, 103, 0.06),
    rgba(255, 255, 255, 0.92)
  );
}

.payment-kpi-card__value {
  font-size: 1.2rem;
  line-height: 1.3;
  margin: 0.4rem 0;
}

.desktop-table-wrap {
  max-height: calc(100vh - 360px);
  min-height: 220px;
}

.desktop-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #fff;
}

.interactive-row {
  cursor: pointer;
}

.interactive-row:hover td {
  background-color: rgba(17, 56, 103, 0.03);
}

.detail-card {
  position: sticky;
  top: 10px;
  max-height: calc(100vh - 150px);
  overflow: auto;
}

.detail-block + .detail-block {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(17, 56, 103, 0.08);
}

.coverage-issue-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid rgba(17, 56, 103, 0.08);
  border-radius: 0.875rem;
  padding: 0.875rem 1rem;
}

.coverage-list {
  max-height: 420px;
  overflow: auto;
}

.coverage-item {
  background: #fff;
}

.coverage-item--active,
.tariff-mobile-card--active {
  border-color: var(--brand-color) !important;
  background: rgba(17, 56, 103, 0.04);
}

.tariff-mobile-card {
  background: #fff;
}

.registry-mobile-card {
  background: linear-gradient(
    180deg,
    rgba(17, 56, 103, 0.04),
    rgba(255, 255, 255, 0.96)
  );
}

.registry-mobile-card__sum {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--brand-color);
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

  .sticky-panel {
    position: static;
  }
}
</style>
