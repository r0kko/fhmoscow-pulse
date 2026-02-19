<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import { useRoute } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';

import { apiFetch } from '../api';
import { cleanPassport, suggestFmsUnit } from '../dadata';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import BrandSpinner from '../components/BrandSpinner.vue';
import WorkspaceSummary from '../components/admin-user-workspace/WorkspaceSummary.vue';
import { useAdminUserWorkspace } from '../composables/useAdminUserWorkspace';
import { isValidAccountNumber } from '../utils/bank';
import {
  formatSnils,
  isValidInn,
  isValidSnils,
  normalizeRussianPhone,
} from '../utils/personal';
import { useToast } from '../utils/toast';
import type {
  AdminUserProfileWorkspace,
  ClubsResponse,
  ProfileSectionKey,
  RolesResponse,
  SexesResponse,
  TeamsResponse,
  FieldError,
  TaxationInfo,
} from '../types/adminUserProfile';

interface OptionItem {
  id: string;
  name: string;
}

interface RoleOption extends OptionItem {
  alias: string;
  group_alias: string | null;
  group_name: string | null;
  department_alias: string | null;
  department_name: string | null;
  display_order: number | null;
}

interface RoleDepartmentGroup {
  key: string;
  name: string;
  roles: RoleOption[];
}

const route = useRoute();
const { showToast } = useToast();

const {
  workspace,
  loading,
  error,
  sections,
  loadWorkspace,
  abortWorkspaceLoad,
  startEdit,
  cancelEdit,
  markDirty,
  updatePersonal,
  upsertPassport,
  upsertInn,
  upsertSnils,
  upsertBankAccount,
  upsertAddress,
  checkTaxation,
  upsertTaxation,
  updateRoles,
  updateSportSchools,
} = useAdminUserWorkspace();

const userId = computed(() => String(route.params['id'] || ''));

type WorkspaceTile = 'profile' | 'documents' | 'access' | 'links' | 'taxes';
type DocumentsSection =
  | 'passport'
  | 'inn'
  | 'snils'
  | 'bank_account'
  | 'addresses';

const tiles = computed(() => {
  const current = workspace.value;
  if (!current) {
    return [];
  }

  const missingDocuments = [
    !current.profile.passport && 'Паспорт',
    !current.profile.inn && 'ИНН',
    !current.profile.snils && 'СНИЛС',
    !current.profile.bank_account && 'Банк',
    !current.profile.addresses.REGISTRATION ||
    !current.profile.addresses.RESIDENCE
      ? 'Адреса'
      : null,
  ].filter(Boolean) as string[];

  return [
    {
      id: 'profile',
      title: 'Профиль',
      iconClass: 'bi bi-person-vcard',
      complete: missingDocuments.length === 0,
    },
    {
      id: 'documents',
      title: 'Документы',
      iconClass: 'bi bi-file-earmark-text',
      complete:
        current.completeness.missing.filter((item) =>
          ['passport', 'inn', 'snils', 'bank_account', 'addresses'].includes(
            item
          )
        ).length === 0,
    },
    {
      id: 'access',
      title: 'Роли и доступ',
      iconClass: 'bi bi-shield-lock',
      complete: true,
    },
    {
      id: 'links',
      title: 'Клубы/команды',
      iconClass: 'bi bi-diagram-3',
      complete: true,
    },
    {
      id: 'taxes',
      title: 'Налоги',
      iconClass: 'bi bi-receipt-cutoff',
      complete: current.profile.taxation?.type?.id ? true : false,
    },
  ] as Array<{
    id: WorkspaceTile;
    title: string;
    iconClass: string;
    complete: boolean;
  }>;
});

const activeWorkspaceTile = ref<WorkspaceTile | null>(null);
const activeDocumentsSection = ref<DocumentsSection>('passport');
const workspaceModalRef = ref<HTMLElement | null>(null);
let workspaceModal: Modal | null = null;

const activeEditingSection = ref<ProfileSectionKey | null>(null);
const taxationPreview = ref<TaxationInfo | null>(null);
const passportSuggestions = ref<
  Array<{
    value: string;
    data?: {
      code?: string;
      name?: string;
      region?: string;
    };
  }>
>([]);
const passportCodeLookupTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const passportValidityStatus = ref<
  'idle' | 'checking' | 'valid' | 'invalid' | 'error'
>('idle');
const passportValidityMessage = ref('');

const sexes = ref<OptionItem[]>([]);
const rolesCatalog = ref<RoleOption[]>([]);
const clubsCatalog = ref<OptionItem[]>([]);
const teamsCatalog = ref<OptionItem[]>([]);
const linksSearch = reactive({
  clubQuery: '',
  teamQuery: '',
  clubsLoading: false,
  teamsLoading: false,
});
const clubSearchTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const teamSearchTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const LINKS_SEARCH_LIMIT = 200;
let clubSearchRequestSeq = 0;
let teamSearchRequestSeq = 0;

const dictionaries = reactive({
  sexesLoaded: false,
  rolesLoaded: false,
  loadingRoles: false,
});

const personalDraft = reactive({
  last_name: '',
  first_name: '',
  patronymic: '',
  birth_date: '',
  sex_id: '',
  phone: '',
  email: '',
});

const passportDraft = reactive({
  document_type: 'CIVIL',
  country: 'RU',
  series: '',
  number: '',
  issue_date: '',
  valid_until: '',
  issuing_authority: '',
  issuing_authority_code: '',
  place_of_birth: '',
});

const innDraft = reactive({
  inn_number: '',
});

const snilsDraft = reactive({
  snils_number: '',
});

const bankDraft = reactive({
  number: '',
  bic: '',
});

const addressesDraft = reactive({
  registration: '',
  residence: '',
});

const roleSelection = ref<string[]>([]);
const clubSelection = ref<string[]>([]);
const teamSelection = ref<string[]>([]);

const sectionSnapshot = reactive<Record<ProfileSectionKey, string>>({
  personal: '',
  passport: '',
  inn: '',
  snils: '',
  bank_account: '',
  addresses: '',
  taxation: '',
  roles: '',
  sport_schools: '',
});

const breadcrumbs = computed(() => [
  { label: 'Администрирование', to: '/admin' },
  { label: 'Пользователи', to: '/admin/users' },
  { label: 'Рабочее место профиля' },
]);

const activeSectionState = computed(() => {
  if (!activeEditingSection.value) return null;
  return sections[activeEditingSection.value];
});

const currentDate = computed(() => new Date().toISOString().slice(0, 10));

const canSaveActiveSection = computed(() => {
  const section = activeEditingSection.value;
  if (!section || !activeSectionState.value) return false;
  if (activeSectionState.value.saving || !activeSectionState.value.dirty)
    return false;
  if (section === 'roles' && !workspace.value?.permissions.can_edit_roles)
    return false;
  if (
    section === 'sport_schools' &&
    !workspace.value?.permissions.can_manage_links
  )
    return false;
  return true;
});

const canEditRolesPermission = computed(() =>
  Boolean(workspace.value?.permissions.can_edit_roles)
);

function buildLinkOptions(
  catalog: OptionItem[],
  linked: Array<{ id: string; name: string }>,
  selectedIds: string[],
  fallbackLabel: string
): OptionItem[] {
  const selected = new Set(selectedIds);
  const optionsMap = new Map<string, string>();

  for (const item of catalog) {
    optionsMap.set(item.id, item.name);
  }
  for (const item of linked) {
    if (!optionsMap.has(item.id)) {
      optionsMap.set(item.id, item.name);
    }
  }
  for (const id of selected) {
    if (!optionsMap.has(id)) {
      optionsMap.set(id, `${fallbackLabel} ${id}`);
    }
  }

  return [...optionsMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => {
      const leftSelected = selected.has(left.id) ? 0 : 1;
      const rightSelected = selected.has(right.id) ? 0 : 1;
      if (leftSelected !== rightSelected) return leftSelected - rightSelected;
      return left.name.localeCompare(right.name, 'ru');
    });
}

const clubOptions = computed(() =>
  buildLinkOptions(
    clubsCatalog.value,
    workspace.value?.profile.sport_school_links.clubs || [],
    clubSelection.value,
    'Клуб'
  )
);

const teamOptions = computed(() =>
  buildLinkOptions(
    teamsCatalog.value,
    workspace.value?.profile.sport_school_links.teams || [],
    teamSelection.value,
    'Команда'
  )
);

const clubOptionsById = computed(
  () => new Map(clubOptions.value.map((item) => [item.id, item.name]))
);
const teamOptionsById = computed(
  () => new Map(teamOptions.value.map((item) => [item.id, item.name]))
);

const workspaceTaxation = computed(() => workspace.value?.profile.taxation ?? null);

const activeModalTitle = computed(() => {
  const tile = activeWorkspaceTile.value;
  const tileTitle = tile
    ? tiles.value.find((item) => item.id === tile)?.title
    : null;
  if (tileTitle) return tileTitle;
  if (!activeEditingSection.value) return 'Секция';

  const map: Record<ProfileSectionKey, string> = {
    personal: 'Профиль',
    passport: 'Документы',
    inn: 'Документы',
    snils: 'Документы',
    bank_account: 'Документы',
    addresses: 'Документы',
    taxation: 'Налоги',
    roles: 'Роли и доступ',
    sport_schools: 'Клубы/команды',
  };
  return map[activeEditingSection.value];
});

const federationRoles = computed(() =>
  rolesCatalog.value.filter(
    (role) =>
      role.group_alias === 'FHMO_STAFF' || role.alias.startsWith('FHMO_')
  )
);

const otherRoles = computed(() =>
  rolesCatalog.value.filter(
    (role) =>
      role.group_alias !== 'FHMO_STAFF' && !role.alias.startsWith('FHMO_')
  )
);

const federationRoleDepartments = computed<RoleDepartmentGroup[]>(() => {
  const groups = new Map<string, RoleDepartmentGroup>();

  for (const role of federationRoles.value) {
    const key = role.department_alias || 'FHMO_UNASSIGNED';
    const name = role.department_name || 'Без отдела';
    const current = groups.get(key);
    if (current) {
      current.roles.push(role);
      continue;
    }
    groups.set(key, {
      key,
      name,
      roles: [role],
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      roles: [...group.roles].sort((left, right) => {
        const leftOrder = left.display_order ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.display_order ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return left.name.localeCompare(right.name, 'ru');
      }),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
});

const federationEmployment = ref(false);
const federationDepartmentAlias = ref('');
const federationPositionAlias = ref('');

const federationSelectedCount = computed(
  () => roleSelection.value.filter((alias) => isFederationRoleAlias(alias)).length
);

const otherSelectedCount = computed(
  () => otherRoles.value.filter((role) => roleSelection.value.includes(role.id)).length
);

const federationPositionsByDepartment = computed(() => {
  if (!federationDepartmentAlias.value) return [] as RoleOption[];
  return federationRoles.value
    .filter(
      (role) =>
        (role.department_alias || 'FHMO_UNASSIGNED') ===
        federationDepartmentAlias.value
    )
    .sort((left, right) => {
      const leftOrder = left.display_order ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.display_order ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.name.localeCompare(right.name, 'ru');
    });
});

const hasMultipleFederationRoles = computed(
  () => federationSelectedCount.value > 1
);

function isFederationRoleAlias(alias: string): boolean {
  if (alias.startsWith('FHMO_')) return true;
  return federationRoles.value.some((role) => role.id === alias);
}

function applyFederationRoleSelection(alias: string | null): void {
  const next = roleSelection.value.filter(
    (currentAlias) => !isFederationRoleAlias(currentAlias)
  );
  if (alias) {
    next.push(alias);
  }
  roleSelection.value = next;
}

function syncFederationRoleControlsFromSelection(): void {
  const selected = roleSelection.value.filter((alias) =>
    isFederationRoleAlias(alias)
  );
  const activeAlias = selected[0] || '';

  if (!activeAlias) {
    if (federationEmployment.value) {
      const departmentExists = federationRoleDepartments.value.some(
        (department) => department.key === federationDepartmentAlias.value
      );
      if (!departmentExists) {
        federationDepartmentAlias.value = '';
      }
      federationPositionAlias.value = '';
      return;
    }
    federationDepartmentAlias.value = '';
    federationPositionAlias.value = '';
    return;
  }

  federationEmployment.value = true;
  federationPositionAlias.value = activeAlias;

  const role = federationRoles.value.find((item) => item.id === activeAlias);
  federationDepartmentAlias.value = role?.department_alias || '';
}

function onFederationEmploymentChange(checked: boolean): void {
  federationEmployment.value = checked;
  if (!checked) {
    federationDepartmentAlias.value = '';
    federationPositionAlias.value = '';
    applyFederationRoleSelection(null);
    return;
  }

  if (!federationDepartmentAlias.value && federationRoleDepartments.value.length) {
    federationDepartmentAlias.value = federationRoleDepartments.value[0]!.key;
  }
}

function onFederationDepartmentChange(value: string): void {
  federationDepartmentAlias.value = value;
  const hasCurrentPosition = federationPositionsByDepartment.value.some(
    (role) => role.id === federationPositionAlias.value
  );
  if (!hasCurrentPosition) {
    federationPositionAlias.value = '';
    applyFederationRoleSelection(null);
  }
}

function onFederationPositionChange(value: string): void {
  federationPositionAlias.value = value;
  applyFederationRoleSelection(value || null);
}

function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function getWorkspaceOrThrow(): AdminUserProfileWorkspace {
  if (!workspace.value) {
    throw new Error('Профиль пользователя не загружен');
  }
  return workspace.value;
}

function hydrateDraftsFromWorkspace(data: AdminUserProfileWorkspace): void {
  personalDraft.last_name = data.user.last_name || '';
  personalDraft.first_name = data.user.first_name || '';
  personalDraft.patronymic = data.user.patronymic || '';
  personalDraft.birth_date = data.user.birth_date || '';
  personalDraft.sex_id = data.user.sex_id || '';
  personalDraft.phone = data.user.phone || '';
  personalDraft.email = data.user.email || '';

  passportDraft.document_type = data.profile.passport?.document_type || 'CIVIL';
  passportDraft.country = data.profile.passport?.country || 'RU';
  passportDraft.series = data.profile.passport?.series || '';
  passportDraft.number = data.profile.passport?.number || '';
  passportDraft.issue_date = data.profile.passport?.issue_date || '';
  passportDraft.valid_until = data.profile.passport?.valid_until || '';
  passportDraft.issuing_authority =
    data.profile.passport?.issuing_authority || '';
  passportDraft.issuing_authority_code =
    data.profile.passport?.issuing_authority_code || '';
  passportDraft.place_of_birth = data.profile.passport?.place_of_birth || '';

  innDraft.inn_number = data.profile.inn?.number || '';
  snilsDraft.snils_number = data.profile.snils?.number || '';

  bankDraft.number = data.profile.bank_account?.number || '';
  bankDraft.bic = data.profile.bank_account?.bic || '';

  addressesDraft.registration =
    data.profile.addresses.REGISTRATION?.result || '';
  addressesDraft.residence = data.profile.addresses.RESIDENCE?.result || '';

  roleSelection.value = [...(data.user.roles || [])];
  clubSelection.value = data.profile.sport_school_links.clubs.map(
    (item) => item.id
  );
  teamSelection.value = data.profile.sport_school_links.teams.map(
    (item) => item.id
  );

  taxationPreview.value = null;

  captureSnapshot('personal', personalPayload());
  captureSnapshot('passport', passportPayload());
  captureSnapshot('inn', innPayload());
  captureSnapshot('snils', snilsPayload());
  captureSnapshot('bank_account', bankPayload());
  captureSnapshot('addresses', addressesPayload());
  captureSnapshot('taxation', taxationPayload());
  captureSnapshot('roles', rolesPayload());
  captureSnapshot('sport_schools', sportSchoolsPayload());
}

function personalPayload() {
  return {
    first_name: personalDraft.first_name.trim(),
    last_name: personalDraft.last_name.trim(),
    patronymic: personalDraft.patronymic.trim() || null,
    birth_date: personalDraft.birth_date,
    sex_id: personalDraft.sex_id || null,
    phone: sanitizePhone(personalDraft.phone),
    email: personalDraft.email.trim(),
  };
}

function innPayload() {
  return {
    inn_number: innDraft.inn_number.replace(/\D/g, ''),
  };
}

function snilsPayload() {
  return {
    snils_number: formatSnils(snilsDraft.snils_number.replace(/\D/g, '')),
  };
}

function passportPayload() {
  return {
    document_type: passportDraft.document_type,
    country: passportDraft.country,
    series: passportDraft.series.replace(/\D/g, '').slice(0, 4),
    number: passportDraft.number.replace(/\D/g, '').slice(0, 6),
    issue_date: passportDraft.issue_date,
    valid_until: passportDraft.valid_until || null,
    issuing_authority: passportDraft.issuing_authority.trim(),
    issuing_authority_code: formatPassportCode(
      passportDraft.issuing_authority_code
    ),
    place_of_birth: passportDraft.place_of_birth.trim(),
  };
}

function bankPayload() {
  return {
    number: bankDraft.number.replace(/\D/g, ''),
    bic: bankDraft.bic.replace(/\D/g, ''),
  };
}

function addressesPayload() {
  return {
    registration: normalizeAddress(addressesDraft.registration),
    residence: normalizeAddress(addressesDraft.residence),
  };
}

function taxationPayload() {
  return {
    preview: taxationPreview.value,
  };
}

function rolesPayload() {
  return {
    roles: [...roleSelection.value].sort(),
  };
}

function sportSchoolsPayload() {
  return {
    club_ids: [...clubSelection.value].sort(),
    team_ids: [...teamSelection.value].sort(),
  };
}

function captureSnapshot(section: ProfileSectionKey, payload: unknown): void {
  sectionSnapshot[section] = toJson(payload);
  markDirty(section, false);
}

function syncDirty(section: ProfileSectionKey, payload: unknown): void {
  if (!sections[section].editing) return;
  markDirty(section, toJson(payload) !== sectionSnapshot[section]);
}

function fieldError(section: ProfileSectionKey, field: string): string {
  const state = sections[section];
  return (
    state.fieldErrors.find((entry) => entry.field === field)?.message || ''
  );
}

function setSectionFieldError(
  section: ProfileSectionKey,
  field: string,
  message: string
): void {
  const next: FieldError = {
    field,
    code: message ? 'validation_error' : 'ok',
    message,
  };

  const current = sections[section].fieldErrors;
  const existing = current.findIndex((item) => item.field === field);
  if (existing >= 0) {
    if (message) {
      current[existing] = next;
    } else {
      current.splice(existing, 1);
    }
    return;
  }

  if (message) {
    current.push(next);
  }
}

function clearSectionFieldErrors(section: ProfileSectionKey): void {
  sections[section].fieldErrors = [];
}

function hasFutureDate(value: string): boolean {
  if (!value) return true;
  const selected = new Date(value);
  if (Number.isNaN(selected.getTime())) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return selected.getTime() > today.getTime();
}

function sanitizePhone(value: string): string {
  return normalizeRussianPhone(value).slice(0, 11);
}

function validateEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value || '');
}

function formatPassportCode(value: string): string {
  let digits = value.replace(/\D/g, '').slice(0, 6);
  if (digits.length > 3) {
    digits = `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return digits;
}

function formatInn(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 12);
  if (!digits) return '';
  return digits.match(/\d{1,3}/g)?.join(' ') || '';
}

function calculatePassportValidUntil(
  issueDate: string,
  birthDate: string
): string {
  const birth = new Date(birthDate);
  const issue = new Date(issueDate);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(issue.getTime())) {
    return '';
  }

  const age = (issue.getTime() - birth.getTime()) / (365.25 * 24 * 3600 * 1000);
  let until: Date;

  if (age < 20) {
    until = new Date(birth);
    until.setFullYear(until.getFullYear() + 20);
  } else if (age < 45) {
    until = new Date(birth);
    until.setFullYear(until.getFullYear() + 45);
  } else {
    until = new Date(birth);
    until.setFullYear(until.getFullYear() + 100);
    return until.toISOString().slice(0, 10);
  }

  until.setDate(until.getDate() + 90);
  return until.toISOString().slice(0, 10);
}

function normalizeAddress(value: string): string {
  return (value || '').trim();
}

function parsePassportNumberForCheck(series: string, number: string): string {
  const normalizedSeries = series.replace(/\D/g, '');
  const normalizedNumber = number.replace(/\D/g, '');
  return `${normalizedSeries} ${normalizedNumber}`;
}

async function validatePassportNumberWithFms(
  series: string,
  number: string
): Promise<boolean> {
  passportValidityMessage.value = '';
  passportValidityStatus.value = 'checking';

  try {
    const query = parsePassportNumberForCheck(series, number);
    if (!query) {
      passportValidityStatus.value = 'error';
      passportValidityMessage.value = 'Введите серию и номер для проверки';
      return false;
    }

    const result = await cleanPassport(query);
    if (result?.qc === 0) {
      passportValidityStatus.value = 'valid';
      return true;
    }

    if (result?.qc === 10) {
      passportValidityStatus.value = 'invalid';
      passportValidityMessage.value = 'Паспорт недействителен';
      return false;
    }

    passportValidityStatus.value = 'error';
    passportValidityMessage.value = 'Не удалось проверить паспорт';
    return false;
  } catch {
    passportValidityStatus.value = 'error';
    passportValidityMessage.value = 'Ошибка проверки паспорта';
    return false;
  }
}

function checkPassportValidityLocally(
  issueDate: string,
  validUntil: string,
  birthDate: string
): string {
  if (!validUntil) {
    return 'Не удалось вычислить срок действия';
  }

  const validUntilDate = new Date(validUntil);
  if (Number.isNaN(validUntilDate.getTime())) {
    return 'Неверный формат срока действия';
  }

  if (!birthDate || hasFutureDate(birthDate)) {
    return 'Проверьте дату рождения пользователя';
  }

  if (hasFutureDate(issueDate)) {
    return 'Дата выдачи не может быть в будущем';
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (validUntilDate < now) {
    return 'Паспорт просрочен';
  }

  return '';
}

function syncPassportValidUntil(): void {
  passportDraft.valid_until = '';
  if (
    passportDraft.country !== 'RU' ||
    passportDraft.document_type !== 'CIVIL'
  ) {
    return;
  }
  if (!passportDraft.issue_date || !personalDraft.birth_date) {
    return;
  }
  passportDraft.valid_until = calculatePassportValidUntil(
    passportDraft.issue_date,
    personalDraft.birth_date
  );
}

async function validateCurrentSection(): Promise<boolean> {
  const section = activeEditingSection.value;
  if (!section) return false;

  clearSectionFieldErrors(section);
  passportValidityMessage.value = '';
  if (passportValidityStatus.value === 'idle') {
    passportValidityStatus.value = 'idle';
  }

  if (section === 'personal') {
    const firstName = personalDraft.first_name.trim();
    const lastName = personalDraft.last_name.trim();
    const patronymic = personalDraft.patronymic.trim();
    const birthDate = personalDraft.birth_date;
    const email = personalDraft.email.trim();
    const phone = sanitizePhone(personalDraft.phone);

    setSectionFieldError(
      'personal',
      'last_name',
      lastName ? '' : 'Введите фамилию'
    );
    setSectionFieldError(
      'personal',
      'first_name',
      firstName ? '' : 'Введите имя'
    );
    setSectionFieldError(
      'personal',
      'sex_id',
      personalDraft.sex_id ? '' : 'Выберите пол'
    );
    setSectionFieldError(
      'personal',
      'birth_date',
      !birthDate
        ? 'Введите дату рождения'
        : hasFutureDate(birthDate)
          ? 'Дата рождения не может быть в будущем'
          : ''
    );
    setSectionFieldError(
      'personal',
      'phone',
      phone && phone.length !== 11 ? 'Введите номер в формате +7...' : ''
    );
    setSectionFieldError(
      'personal',
      'email',
      !email
        ? 'Введите email'
        : validateEmail(email)
          ? ''
          : 'Неверный формат email'
    );
    setSectionFieldError('personal', 'patronymic', '');

    if (
      !firstName ||
      !lastName ||
      !personalDraft.sex_id ||
      !birthDate ||
      !email
    ) {
      return false;
    }

    if (hasFutureDate(birthDate)) {
      return false;
    }

    if (email && !validateEmail(email)) {
      return false;
    }

    if (phone && phone.length !== 11) {
      return false;
    }

    return true;
  }

  if (section === 'passport') {
    const isRussianCivil =
      passportDraft.document_type === 'CIVIL' && passportDraft.country === 'RU';
    const series = passportDraft.series.replace(/\D/g, '');
    const number = passportDraft.number.replace(/\D/g, '');
    const authorityCode = passportDraft.issuing_authority_code.trim();

    setSectionFieldError(
      'passport',
      'document_type',
      passportDraft.document_type ? '' : 'Выберите тип документа'
    );
    setSectionFieldError(
      'passport',
      'country',
      passportDraft.country ? '' : 'Выберите страну'
    );

    if (isRussianCivil) {
      setSectionFieldError(
        'passport',
        'series',
        series.length >= 4 ? '' : 'Введите серию (4 цифры)'
      );
      setSectionFieldError(
        'passport',
        'number',
        number.length >= 6 ? '' : 'Введите номер (6 цифр)'
      );
      setSectionFieldError(
        'passport',
        'issue_date',
        !passportDraft.issue_date
          ? 'Введите дату выдачи'
          : hasFutureDate(passportDraft.issue_date)
            ? 'Дата выдачи не может быть в будущем'
            : ''
      );
      setSectionFieldError(
        'passport',
        'place_of_birth',
        passportDraft.place_of_birth.trim() ? '' : 'Введите место рождения'
      );
      setSectionFieldError(
        'passport',
        'issuing_authority_code',
        authorityCode ? '' : 'Укажите код подразделения'
      );
      setSectionFieldError(
        'passport',
        'issuing_authority',
        passportDraft.issuing_authority.trim() ? '' : 'Выберите подразделение'
      );
      const validUntilError = checkPassportValidityLocally(
        passportDraft.issue_date,
        passportDraft.valid_until,
        personalDraft.birth_date
      );
      setSectionFieldError('passport', 'valid_until', validUntilError);
      if (!series || !number) {
        return false;
      }
      const isValidByFms = await validatePassportNumberWithFms(series, number);
      if (!isValidByFms) {
        setSectionFieldError(
          'passport',
          'series',
          passportValidityMessage.value
            ? passportValidityMessage.value
            : 'Проверьте серию и номер'
        );
        return false;
      }
      if (validUntilError) return false;
      if (!passportDraft.place_of_birth.trim()) return false;
    } else {
      setSectionFieldError('passport', 'series', '');
      setSectionFieldError('passport', 'number', '');
      setSectionFieldError('passport', 'issue_date', '');
      setSectionFieldError('passport', 'issuing_authority_code', '');
      setSectionFieldError('passport', 'issuing_authority', '');
      setSectionFieldError('passport', 'place_of_birth', '');
    }

    return true;
  }

  if (section === 'inn') {
    const value = innDraft.inn_number.replace(/\D/g, '');
    setSectionFieldError(
      'inn',
      'number',
      !value ? 'Укажите ИНН' : !isValidInn(value) ? 'Неверный ИНН' : ''
    );
    return !fieldError('inn', 'number');
  }

  if (section === 'snils') {
    const value = snilsDraft.snils_number.replace(/\D/g, '');
    setSectionFieldError(
      'snils',
      'number',
      !value ? 'Укажите СНИЛС' : !isValidSnils(value) ? 'Неверный СНИЛС' : ''
    );
    return !fieldError('snils', 'number');
  }

  if (section === 'bank_account') {
    const accountNumber = bankDraft.number.replace(/\D/g, '');
    const bic = bankDraft.bic.replace(/\D/g, '');
    setSectionFieldError(
      'bank_account',
      'bic',
      bic.length === 0
        ? 'Введите БИК'
        : bic.length !== 9
          ? 'БИК должен содержать 9 цифр'
          : ''
    );
    setSectionFieldError(
      'bank_account',
      'number',
      accountNumber.length === 0
        ? 'Введите номер счёта'
        : accountNumber.length !== 20
          ? 'Номер счёта должен содержать 20 цифр'
          : ''
    );
    if (
      bic &&
      accountNumber &&
      isValidAccountNumber(accountNumber, bic) === false
    ) {
      setSectionFieldError(
        'bank_account',
        'number',
        'Неверные реквизиты счёта'
      );
    }

    return (
      !fieldError('bank_account', 'bic') &&
      !fieldError('bank_account', 'number')
    );
  }

  if (section === 'addresses') {
    const registration = normalizeAddress(addressesDraft.registration);
    const residence = normalizeAddress(addressesDraft.residence);
    setSectionFieldError(
      'addresses',
      'registration',
      registration ? '' : 'Введите адрес регистрации'
    );
    setSectionFieldError(
      'addresses',
      'residence',
      residence ? '' : 'Введите адрес проживания'
    );
    return (
      !fieldError('addresses', 'registration') &&
      !fieldError('addresses', 'residence')
    );
  }

  if (section === 'taxation') {
    if (!taxationPreview.value) {
      showToast('Сначала выполните проверку налогового статуса', 'warning');
      return false;
    }
  }

  if (section === 'roles') {
    const federationCount = roleSelection.value.filter((alias) =>
      isFederationRoleAlias(alias)
    ).length;
    const employmentDepartmentMissing =
      federationEmployment.value && !federationDepartmentAlias.value;
    const employmentRoleMissing =
      federationEmployment.value && !federationPositionAlias.value;
    const invalidDepartmentRole =
      federationEmployment.value &&
      Boolean(federationPositionAlias.value) &&
      !federationPositionsByDepartment.value.some(
        (role) => role.id === federationPositionAlias.value
      );
    setSectionFieldError(
      'roles',
      'roles',
      federationCount > 1
        ? 'Внутри Федерации можно назначить только одну должность'
        : employmentDepartmentMissing
          ? 'Выберите отдел сотрудника Федерации'
        : employmentRoleMissing
          ? 'Выберите должность сотрудника Федерации'
          : invalidDepartmentRole
            ? 'Должность не относится к выбранному отделу'
        : ''
    );
    return !fieldError('roles', 'roles');
  }

  if (section === 'sport_schools') {
    return true;
  }

  return true;
}

async function loadSexes(): Promise<void> {
  if (dictionaries.sexesLoaded) return;
  const data = await apiFetch<SexesResponse>('/sexes');
  sexes.value = (data.sexes || []).map((item) => ({
    id: item.id,
    name: item.name,
  }));
  dictionaries.sexesLoaded = true;
}

async function loadRolesCatalog(): Promise<void> {
  if (dictionaries.rolesLoaded || dictionaries.loadingRoles) return;
  dictionaries.loadingRoles = true;
  try {
    const data = await apiFetch<RolesResponse>('/roles');
    rolesCatalog.value = (data.roles || []).map((item) => ({
      id: String(item.alias),
      alias: String(item.alias),
      name: item.name,
      group_alias: item.group_alias ?? null,
      group_name: item.group_name ?? null,
      department_alias: item.department_alias ?? null,
      department_name: item.department_name ?? null,
      display_order: item.display_order ?? null,
    }));
    dictionaries.rolesLoaded = true;
  } finally {
    dictionaries.loadingRoles = false;
  }
}

function buildLinksSearchPath(
  entity: 'clubs' | 'teams',
  query: string
): string {
  const q = (query || '').trim();
  const params = new URLSearchParams({
    page: '1',
    limit: String(LINKS_SEARCH_LIMIT),
  });
  if (q) params.set('search', q);
  return `/${entity}?${params.toString()}`;
}

async function loadClubsCatalog(query = linksSearch.clubQuery): Promise<void> {
  const requestSeq = ++clubSearchRequestSeq;
  linksSearch.clubsLoading = true;
  try {
    const data = await apiFetch<ClubsResponse>(buildLinksSearchPath('clubs', query));
    if (requestSeq !== clubSearchRequestSeq) return;

    clubsCatalog.value = (data.clubs || []).map((item) => ({
      id: item.id,
      name: item.name,
    }));
  } finally {
    if (requestSeq === clubSearchRequestSeq) {
      linksSearch.clubsLoading = false;
    }
  }
}

async function loadTeamsCatalog(query = linksSearch.teamQuery): Promise<void> {
  const requestSeq = ++teamSearchRequestSeq;
  linksSearch.teamsLoading = true;
  try {
    const data = await apiFetch<TeamsResponse>(buildLinksSearchPath('teams', query));
    if (requestSeq !== teamSearchRequestSeq) return;

    teamsCatalog.value = (data.teams || []).map((item) => ({
      id: item.id,
      name: item.birth_year ? `${item.name} (${item.birth_year})` : item.name,
    }));
  } finally {
    if (requestSeq === teamSearchRequestSeq) {
      linksSearch.teamsLoading = false;
    }
  }
}

async function loadLinksCatalog(): Promise<void> {
  await Promise.all([loadClubsCatalog(), loadTeamsCatalog()]);
}

async function beginEdit(section: ProfileSectionKey): Promise<void> {
  if (activeEditingSection.value && activeEditingSection.value !== section) {
    const currentSection = activeEditingSection.value;
    if (sections[currentSection].dirty) {
      showToast('Сначала сохраните или отмените текущие изменения', 'warning');
      return;
    }

    cancelEdit(currentSection);
    activeEditingSection.value = null;
  }

  if (section === 'roles' && !workspace.value?.permissions.can_edit_roles) {
    showToast('Недостаточно прав для редактирования ролей', 'warning');
    return;
  }

  if (
    section === 'sport_schools' &&
    !workspace.value?.permissions.can_manage_links
  ) {
    showToast(
      'Недостаточно прав для управления связями клубов и команд',
      'warning'
    );
    return;
  }

  if (section === 'taxation') {
    taxationPreview.value = null;
  }

  try {
    if (section === 'personal') {
      await loadSexes();
      captureSnapshot(section, personalPayload());
    }

    if (section === 'roles') {
      await loadRolesCatalog();
      syncFederationRoleControlsFromSelection();
      captureSnapshot(section, rolesPayload());
    }

    if (section === 'sport_schools') {
      await loadLinksCatalog();
      captureSnapshot(section, sportSchoolsPayload());
    }

    if (section === 'passport') captureSnapshot(section, passportPayload());
    if (section === 'inn') captureSnapshot(section, innPayload());
    if (section === 'snils') captureSnapshot(section, snilsPayload());
    if (section === 'bank_account') captureSnapshot(section, bankPayload());
    if (section === 'addresses') captureSnapshot(section, addressesPayload());
    if (section === 'passport') {
      syncPassportValidUntil();
      passportValidityStatus.value = 'idle';
      passportValidityMessage.value = '';
      passportSuggestions.value = [];
    }

    startEdit(section);
    activeEditingSection.value = section;
  } catch {
    showToast('Не удалось подготовить секцию к редактированию', 'danger');
  }
}

function getSectionForTile(tile: WorkspaceTile): ProfileSectionKey {
  if (tile === 'profile') return 'personal';
  if (tile === 'documents') return 'passport';
  if (tile === 'access') return 'roles';
  if (tile === 'links') return 'sport_schools';
  return 'taxation';
}

function getCanManageForSection(section: ProfileSectionKey): boolean {
  if (section === 'roles')
    return Boolean(workspace.value?.permissions.can_edit_roles);
  if (section === 'sport_schools')
    return Boolean(workspace.value?.permissions.can_manage_links);
  return true;
}

function hideWorkspaceModal(): void {
  workspaceModal?.hide();
}

function clearLinksSearchTimers(): void {
  if (clubSearchTimer.value) {
    clearTimeout(clubSearchTimer.value);
    clubSearchTimer.value = null;
  }
  if (teamSearchTimer.value) {
    clearTimeout(teamSearchTimer.value);
    teamSearchTimer.value = null;
  }
}

function clubOptionName(id: string): string {
  return clubOptionsById.value.get(id) || `Клуб ${id}`;
}

function teamOptionName(id: string): string {
  return teamOptionsById.value.get(id) || `Команда ${id}`;
}

function clearClubSearch(): void {
  linksSearch.clubQuery = '';
}

function clearTeamSearch(): void {
  linksSearch.teamQuery = '';
}

function removeClubLink(id: string): void {
  clubSelection.value = clubSelection.value.filter((item) => item !== id);
}

function removeTeamLink(id: string): void {
  teamSelection.value = teamSelection.value.filter((item) => item !== id);
}

function ensureWorkspaceModal(): boolean {
  if (workspaceModal) return true;
  if (!workspaceModalRef.value) return false;

  workspaceModal = new Modal(workspaceModalRef.value, {
    backdrop: 'static',
    keyboard: false,
  });
  workspaceModalRef.value.addEventListener(
    'hidden.bs.modal',
    onWorkspaceModalHidden
  );
  return true;
}

function onWorkspaceModalHidden(): void {
  if (activeEditingSection.value) {
    const section = activeEditingSection.value;
    cancelEdit(section);
    activeEditingSection.value = null;
  }
  activeWorkspaceTile.value = null;
  clearLinksSearchTimers();
  clubSearchRequestSeq += 1;
  teamSearchRequestSeq += 1;
  linksSearch.clubQuery = '';
  linksSearch.teamQuery = '';
  linksSearch.clubsLoading = false;
  linksSearch.teamsLoading = false;
  if (passportCodeLookupTimer.value) {
    clearTimeout(passportCodeLookupTimer.value);
    passportCodeLookupTimer.value = null;
  }
  passportSuggestions.value = [];
  federationEmployment.value = false;
  federationDepartmentAlias.value = '';
  federationPositionAlias.value = '';
}

function onPersonalPhoneInput(event: Event): void {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  personalDraft.phone = sanitizePhone(target.value);
}

function onPersonalEmailInput(event: Event): void {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  personalDraft.email = target.value.trim();
}

function onPassportSeriesInput(event: Event): void {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  passportDraft.series = target.value.replace(/\D/g, '').slice(0, 4);
}

function onPassportNumberInput(event: Event): void {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  passportDraft.number = target.value.replace(/\D/g, '').slice(0, 6);
}

function onPassportCodeInput(event: Event): void {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  passportDraft.issuing_authority_code = formatPassportCode(target.value);
  passportDraft.issuing_authority = '';
}

function onPassportSuggestionPick(
  suggestion: {
    value: string;
    data?: {
      code?: string;
      name?: string;
      region?: string;
    };
  } = { value: '', data: {} }
): void {
  passportDraft.issuing_authority =
    suggestion.data?.name || suggestion.value || '';
  passportDraft.issuing_authority_code = formatPassportCode(
    suggestion.data?.code || suggestion.value || ''
  );
  passportSuggestions.value = [];
}

function onInnInput(event: Event): void {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  innDraft.inn_number = target.value.replace(/\D/g, '').slice(0, 12);
}

function onSnilsInput(event: Event): void {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  snilsDraft.snils_number = target.value.replace(/\D/g, '').slice(0, 11);
}

function onBankNumberInput(event: Event): void {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  bankDraft.number = target.value.replace(/\D/g, '').slice(0, 20);
}

function onBankBicInput(event: Event): void {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  bankDraft.bic = target.value.replace(/\D/g, '').slice(0, 9);
}

watch(
  () => [
    passportDraft.issuing_authority_code,
    passportDraft.document_type,
    passportDraft.country,
  ],
  async ([code]) => {
    if (passportCodeLookupTimer.value) {
      clearTimeout(passportCodeLookupTimer.value);
      passportCodeLookupTimer.value = null;
    }

    const normalizedCode = (code || '').replace(/\D/g, '').slice(0, 6);

    if (!normalizedCode || normalizedCode.length < 3) {
      passportSuggestions.value = [];
      return;
    }

    if (
      passportDraft.document_type !== 'CIVIL' ||
      passportDraft.country !== 'RU'
    ) {
      passportSuggestions.value = [];
      return;
    }

    passportCodeLookupTimer.value = setTimeout(async () => {
      passportSuggestions.value = await suggestFmsUnit(normalizedCode);
    }, 250);
  }
);

watch(
  () => [passportDraft.issue_date, personalDraft.birth_date],
  syncPassportValidUntil
);

watch(
  () => linksSearch.clubQuery,
  (query) => {
    if (activeWorkspaceTile.value !== 'links') return;
    if (clubSearchTimer.value) clearTimeout(clubSearchTimer.value);
    clubSearchTimer.value = setTimeout(() => {
      void loadClubsCatalog(query);
    }, 300);
  }
);

watch(
  () => linksSearch.teamQuery,
  (query) => {
    if (activeWorkspaceTile.value !== 'links') return;
    if (teamSearchTimer.value) clearTimeout(teamSearchTimer.value);
    teamSearchTimer.value = setTimeout(() => {
      void loadTeamsCatalog(query);
    }, 300);
  }
);

function cancelEditingInModal(): void {
  if (!activeEditingSection.value) {
    hideWorkspaceModal();
    return;
  }

  cancelActiveEdit();
  hideWorkspaceModal();
}

async function openWorkspaceTile(tile: WorkspaceTile): Promise<void> {
  if (activeWorkspaceTile.value && activeEditingSection.value) {
    if (sections[activeEditingSection.value].dirty) {
      showToast('Сначала сохраните или отмените текущие изменения', 'warning');
      return;
    }
    cancelEditingInModal();
  }

  if (!workspace.value) return;

  activeWorkspaceTile.value = tile;
  const section = getSectionForTile(tile);

  if (section === 'passport' && tile === 'documents') {
    activeDocumentsSection.value = 'passport';
  }

  if (
    !getCanManageForSection(section) &&
    section !== 'passport' &&
    section !== 'taxation'
  ) {
    showToast('Недостаточно прав для редактирования этой секции', 'warning');
  } else {
    await beginEdit(section);
  }

  if (!ensureWorkspaceModal()) return;

  workspaceModal?.show();

  if (activeWorkspaceTile.value === 'documents') {
    activeDocumentsSection.value = 'passport';
  }
}

async function switchDocumentsSection(
  section: DocumentsSection
): Promise<void> {
  if (activeEditingSection.value === section) {
    return;
  }

  const currentSection = activeEditingSection.value;
  if (currentSection && sections[currentSection].dirty) {
    showToast('Сначала сохраните или отмените текущие изменения', 'warning');
    return;
  }

  if (currentSection) {
    cancelEdit(currentSection);
    activeEditingSection.value = null;
  }

  activeDocumentsSection.value = section;
  await beginEdit(section);
}

function resetDraftBySection(section: ProfileSectionKey): void {
  const data = getWorkspaceOrThrow();

  if (section === 'personal') {
    personalDraft.last_name = data.user.last_name || '';
    personalDraft.first_name = data.user.first_name || '';
    personalDraft.patronymic = data.user.patronymic || '';
    personalDraft.birth_date = data.user.birth_date || '';
    personalDraft.sex_id = data.user.sex_id || '';
    personalDraft.phone = data.user.phone || '';
    personalDraft.email = data.user.email || '';
  }

  if (section === 'passport') {
    passportDraft.document_type =
      data.profile.passport?.document_type || 'CIVIL';
    passportDraft.country = data.profile.passport?.country || 'RU';
    passportDraft.series = data.profile.passport?.series || '';
    passportDraft.number = data.profile.passport?.number || '';
    passportDraft.issue_date = data.profile.passport?.issue_date || '';
    passportDraft.valid_until = data.profile.passport?.valid_until || '';
    passportDraft.issuing_authority =
      data.profile.passport?.issuing_authority || '';
    passportDraft.issuing_authority_code =
      data.profile.passport?.issuing_authority_code || '';
    passportDraft.place_of_birth = data.profile.passport?.place_of_birth || '';
  }

  if (section === 'inn') {
    innDraft.inn_number = data.profile.inn?.number || '';
  }

  if (section === 'snils') {
    snilsDraft.snils_number = data.profile.snils?.number || '';
  }

  if (section === 'bank_account') {
    bankDraft.number = data.profile.bank_account?.number || '';
    bankDraft.bic = data.profile.bank_account?.bic || '';
  }

  if (section === 'addresses') {
    addressesDraft.registration =
      data.profile.addresses.REGISTRATION?.result || '';
    addressesDraft.residence = data.profile.addresses.RESIDENCE?.result || '';
  }

  if (section === 'roles') {
    roleSelection.value = [...(data.user.roles || [])];
    syncFederationRoleControlsFromSelection();
  }

  if (section === 'sport_schools') {
    clubSelection.value = data.profile.sport_school_links.clubs.map(
      (item) => item.id
    );
    teamSelection.value = data.profile.sport_school_links.teams.map(
      (item) => item.id
    );
  }

  if (section === 'taxation') {
    taxationPreview.value = null;
  }
}

function cancelActiveEdit(): void {
  const section = activeEditingSection.value;
  if (!section) return;
  resetDraftBySection(section);
  cancelEdit(section);
  activeEditingSection.value = null;
}

async function runTaxationPreview(): Promise<void> {
  try {
    const response = await checkTaxation(userId.value, 'all');
    taxationPreview.value = response.preview;
    captureSnapshot('taxation', taxationPayload());
    showToast('Налоговый статус проверен', 'success');
  } catch {
    showToast('Не удалось проверить налоговый статус', 'danger');
  }
}

async function saveActiveEdit(): Promise<void> {
  const section = activeEditingSection.value;
  if (!section) return;
  if (!(await validateCurrentSection())) return;

  try {
    if (section === 'personal') {
      await updatePersonal(userId.value, personalPayload());
    } else if (section === 'passport') {
      await upsertPassport(userId.value, passportPayload());
    } else if (section === 'inn') {
      await upsertInn(userId.value, innPayload().inn_number);
    } else if (section === 'snils') {
      await upsertSnils(userId.value, snilsPayload().snils_number);
    } else if (section === 'bank_account') {
      await upsertBankAccount(userId.value, bankPayload());
    } else if (section === 'addresses') {
      await Promise.all([
        upsertAddress(
          userId.value,
          'REGISTRATION',
          addressesDraft.registration
        ),
        upsertAddress(userId.value, 'RESIDENCE', addressesDraft.residence),
      ]);
    } else if (section === 'taxation') {
      await upsertTaxation(userId.value);
      taxationPreview.value = null;
    } else if (section === 'roles') {
      await updateRoles(userId.value, [...roleSelection.value]);
    } else if (section === 'sport_schools') {
      await updateSportSchools(userId.value, {
        club_ids: [...clubSelection.value],
        team_ids: [...teamSelection.value],
      });
    }

    await loadWorkspace(userId.value);
    showToast('Секция успешно сохранена', 'success');
    activeEditingSection.value = null;
    hideWorkspaceModal();
  } catch {
    showToast('Не удалось сохранить изменения', 'danger');
  }
}

onMounted(async () => {
  if (userId.value) {
    await loadWorkspace(userId.value);
  }
});

watch(
  () => route.params['id'],
  async (nextId) => {
    const nextUserId = String(nextId || '');
    if (!nextUserId) return;
    abortWorkspaceLoad();
    hideWorkspaceModal();
    activeWorkspaceTile.value = null;
    activeEditingSection.value = null;
    await loadWorkspace(nextUserId);
  }
);

watch(workspace, (data) => {
  if (!data) return;
  hydrateDraftsFromWorkspace(data);
});

watch(personalDraft, () => syncDirty('personal', personalPayload()), {
  deep: true,
});
watch(passportDraft, () => syncDirty('passport', passportPayload()), {
  deep: true,
});
watch(innDraft, () => syncDirty('inn', innPayload()), { deep: true });
watch(snilsDraft, () => syncDirty('snils', snilsPayload()), { deep: true });
watch(bankDraft, () => syncDirty('bank_account', bankPayload()), {
  deep: true,
});
watch(addressesDraft, () => syncDirty('addresses', addressesPayload()), {
  deep: true,
});
watch(
  roleSelection,
  () => {
    syncFederationRoleControlsFromSelection();
    syncDirty('roles', rolesPayload());
  },
  { deep: true }
);
watch(
  rolesCatalog,
  () => {
    if (!rolesCatalog.value.length) return;
    syncFederationRoleControlsFromSelection();
  },
  { deep: true }
);
watch(clubSelection, () => syncDirty('sport_schools', sportSchoolsPayload()), {
  deep: true,
});
watch(teamSelection, () => syncDirty('sport_schools', sportSchoolsPayload()), {
  deep: true,
});
watch(taxationPreview, () => syncDirty('taxation', taxationPayload()), {
  deep: true,
});

onBeforeUnmount(() => {
  if (workspaceModalRef.value) {
    workspaceModalRef.value.removeEventListener(
      'hidden.bs.modal',
      onWorkspaceModalHidden
    );
  }
  clearLinksSearchTimers();
  if (passportCodeLookupTimer.value) {
    clearTimeout(passportCodeLookupTimer.value);
    passportCodeLookupTimer.value = null;
  }
  workspaceModal?.hide();
  workspaceModal?.dispose();
  workspaceModal = null;
});
</script>

<template>
  <div class="container mt-4 admin-user-workspace">
    <Breadcrumbs :items="breadcrumbs" />

    <BrandSpinner v-if="loading" class="mt-4" label="Загрузка профиля" />

    <div v-else-if="error" class="alert alert-danger mt-3" role="alert">
      {{ error }}
    </div>

    <template v-else-if="workspace">
      <WorkspaceSummary :workspace="workspace" />

      <section class="workspace-tiles">
        <div class="workspace-tiles__head mb-3">
          <h2 class="h5 mb-0">Разделы профиля</h2>
        </div>
        <div class="row g-3">
          <div
            v-for="tile in tiles"
            :key="tile.id"
            class="col-12 col-md-6 col-xxl-4"
          >
            <button
              type="button"
              class="card h-100 border-0 shadow-sm workspace-tile w-100 text-start"
              @click="openWorkspaceTile(tile.id)"
            >
              <div class="card-body workspace-tile__body">
                <div class="workspace-tile__headrow">
                  <span class="workspace-tile__icon" aria-hidden="true">
                    <i :class="tile.iconClass"></i>
                  </span>
                  <span
                    class="badge workspace-tile__badge"
                    :class="
                      tile.complete ? 'text-bg-success' : 'text-bg-warning'
                    "
                  >
                    {{ tile.complete ? 'Заполнено' : 'Не заполнено' }}
                  </span>
                </div>
                <h3 class="h5 mb-0 workspace-tile__title">{{ tile.title }}</h3>
              </div>
            </button>
          </div>
        </div>
      </section>
    </template>

    <div
      v-if="workspace"
      ref="workspaceModalRef"
      class="modal fade workspace-modal"
      tabindex="-1"
      role="dialog"
      aria-hidden="true"
      aria-labelledby="workspaceSectionModalTitle"
    >
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h2 id="workspaceSectionModalTitle" class="modal-title h5 mb-0">
              {{ activeModalTitle }}
            </h2>
            <button
              type="button"
              class="btn-close"
              aria-label="Закрыть"
              @click="cancelEditingInModal"
            />
          </div>
          <div class="modal-body">
            <div
              v-if="activeSectionState?.error"
              class="alert alert-danger mb-3"
            >
              {{ activeSectionState.error }}
            </div>

            <template v-if="activeWorkspaceTile === 'profile'">
              <div class="row g-3">
                <div class="col-12 col-lg-4">
                  <label class="form-label" for="personal-last-name-modal"
                    >Фамилия</label
                  >
                  <input
                    id="personal-last-name-modal"
                    v-model="personalDraft.last_name"
                    class="form-control"
                    :class="{
                      'is-invalid': fieldError('personal', 'last_name'),
                    }"
                    :disabled="!sections.personal.editing"
                  />
                  <div
                    v-if="fieldError('personal', 'last_name')"
                    class="invalid-feedback d-block"
                  >
                    {{ fieldError('personal', 'last_name') }}
                  </div>
                </div>
                <div class="col-12 col-lg-4">
                  <label class="form-label" for="personal-first-name-modal"
                    >Имя</label
                  >
                  <input
                    id="personal-first-name-modal"
                    v-model="personalDraft.first_name"
                    class="form-control"
                    :class="{
                      'is-invalid': fieldError('personal', 'first_name'),
                    }"
                    :disabled="!sections.personal.editing"
                  />
                  <div
                    v-if="fieldError('personal', 'first_name')"
                    class="invalid-feedback d-block"
                  >
                    {{ fieldError('personal', 'first_name') }}
                  </div>
                </div>
                <div class="col-12 col-lg-4">
                  <label class="form-label" for="personal-patronymic-modal"
                    >Отчество</label
                  >
                  <input
                    id="personal-patronymic-modal"
                    v-model="personalDraft.patronymic"
                    class="form-control"
                    :class="{
                      'is-invalid': fieldError('personal', 'patronymic'),
                    }"
                    :disabled="!sections.personal.editing"
                  />
                  <div
                    v-if="fieldError('personal', 'patronymic')"
                    class="invalid-feedback d-block"
                  >
                    {{ fieldError('personal', 'patronymic') }}
                  </div>
                </div>
                <div class="col-12 col-lg-3">
                  <label class="form-label" for="personal-birth-date-modal"
                    >Дата рождения</label
                  >
                  <input
                    id="personal-birth-date-modal"
                    v-model="personalDraft.birth_date"
                    type="date"
                    class="form-control"
                    :class="{
                      'is-invalid': fieldError('personal', 'birth_date'),
                    }"
                    :disabled="!sections.personal.editing"
                    :max="currentDate"
                  />
                  <div
                    v-if="fieldError('personal', 'birth_date')"
                    class="invalid-feedback d-block"
                  >
                    {{ fieldError('personal', 'birth_date') }}
                  </div>
                </div>
                <div class="col-12 col-lg-3">
                  <label class="form-label" for="personal-sex-modal">Пол</label>
                  <select
                    id="personal-sex-modal"
                    v-model="personalDraft.sex_id"
                    class="form-select"
                    :class="{ 'is-invalid': fieldError('personal', 'sex_id') }"
                    :disabled="!sections.personal.editing"
                  >
                    <option value="">Выберите пол</option>
                    <option
                      v-for="item in sexes"
                      :key="item.id"
                      :value="item.id"
                    >
                      {{ item.name }}
                    </option>
                  </select>
                  <div
                    v-if="fieldError('personal', 'sex_id')"
                    class="invalid-feedback d-block"
                  >
                    {{ fieldError('personal', 'sex_id') }}
                  </div>
                </div>
                <div class="col-12 col-lg-3">
                  <label class="form-label" for="personal-phone-modal"
                    >Телефон</label
                  >
                  <input
                    id="personal-phone-modal"
                    v-model="personalDraft.phone"
                    class="form-control"
                    :class="{ 'is-invalid': fieldError('personal', 'phone') }"
                    inputmode="numeric"
                    maxlength="11"
                    :disabled="!sections.personal.editing"
                    autocomplete="tel"
                    @input="onPersonalPhoneInput"
                  />
                  <div
                    v-if="fieldError('personal', 'phone')"
                    class="invalid-feedback d-block"
                  >
                    {{ fieldError('personal', 'phone') }}
                  </div>
                </div>
                <div class="col-12 col-lg-3">
                  <label class="form-label" for="personal-email-modal"
                    >Email</label
                  >
                  <input
                    id="personal-email-modal"
                    v-model="personalDraft.email"
                    type="email"
                    class="form-control"
                    :class="{ 'is-invalid': fieldError('personal', 'email') }"
                    autocomplete="email"
                    :disabled="!sections.personal.editing"
                    @input="onPersonalEmailInput"
                  />
                  <div
                    v-if="fieldError('personal', 'email')"
                    class="invalid-feedback d-block"
                  >
                    {{ fieldError('personal', 'email') }}
                  </div>
                </div>
              </div>
            </template>

            <template v-if="activeWorkspaceTile === 'documents'">
              <div class="d-flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  class="btn btn-sm"
                  :class="
                    activeDocumentsSection === 'passport'
                      ? 'btn-brand'
                      : 'btn-outline-secondary'
                  "
                  @click="switchDocumentsSection('passport')"
                >
                  Паспорт
                </button>
                <button
                  type="button"
                  class="btn btn-sm"
                  :class="
                    activeDocumentsSection === 'inn'
                      ? 'btn-brand'
                      : 'btn-outline-secondary'
                  "
                  @click="switchDocumentsSection('inn')"
                >
                  ИНН
                </button>
                <button
                  type="button"
                  class="btn btn-sm"
                  :class="
                    activeDocumentsSection === 'snils'
                      ? 'btn-brand'
                      : 'btn-outline-secondary'
                  "
                  @click="switchDocumentsSection('snils')"
                >
                  СНИЛС
                </button>
                <button
                  type="button"
                  class="btn btn-sm"
                  :class="
                    activeDocumentsSection === 'bank_account'
                      ? 'btn-brand'
                      : 'btn-outline-secondary'
                  "
                  @click="switchDocumentsSection('bank_account')"
                >
                  Банк
                </button>
                <button
                  type="button"
                  class="btn btn-sm"
                  :class="
                    activeDocumentsSection === 'addresses'
                      ? 'btn-brand'
                      : 'btn-outline-secondary'
                  "
                  @click="switchDocumentsSection('addresses')"
                >
                  Адреса
                </button>
              </div>

              <template v-if="activeDocumentsSection === 'passport'">
                <div class="row g-3">
                  <div class="col-12 col-lg-3">
                    <label class="form-label" for="passport-type"
                      >Тип документа</label
                    >
                    <select
                      id="passport-type"
                      v-model="passportDraft.document_type"
                      class="form-select"
                      :class="{
                        'is-invalid': fieldError('passport', 'document_type'),
                      }"
                      :disabled="!sections.passport.editing"
                    >
                      <option value="CIVIL">Паспорт гражданина</option>
                      <option value="FOREIGN">Заграничный паспорт</option>
                      <option value="RESIDENCE_PERMIT">
                        Вид на жительство
                      </option>
                    </select>
                    <div
                      v-if="fieldError('passport', 'document_type')"
                      class="invalid-feedback d-block"
                    >
                      {{ fieldError('passport', 'document_type') }}
                    </div>
                  </div>
                  <div class="col-12 col-lg-3">
                    <label class="form-label" for="passport-country"
                      >Страна</label
                    >
                    <select
                      id="passport-country"
                      v-model="passportDraft.country"
                      class="form-select"
                      :class="{
                        'is-invalid': fieldError('passport', 'country'),
                      }"
                      :disabled="!sections.passport.editing"
                    >
                      <option value="RU">Россия</option>
                    </select>
                    <div
                      v-if="fieldError('passport', 'country')"
                      class="invalid-feedback d-block"
                    >
                      {{ fieldError('passport', 'country') }}
                    </div>
                  </div>
                  <div class="col-12 col-lg-3">
                    <label class="form-label" for="passport-series"
                      >Серия</label
                    >
                    <input
                      id="passport-series"
                      v-model="passportDraft.series"
                      class="form-control"
                      :class="{
                        'is-invalid': fieldError('passport', 'series'),
                      }"
                      inputmode="numeric"
                      maxlength="4"
                      :disabled="!sections.passport.editing"
                      @input="onPassportSeriesInput"
                    />
                    <div
                      v-if="fieldError('passport', 'series')"
                      class="invalid-feedback d-block"
                    >
                      {{ fieldError('passport', 'series') }}
                    </div>
                  </div>
                  <div class="col-12 col-lg-3">
                    <label class="form-label" for="passport-number"
                      >Номер</label
                    >
                    <input
                      id="passport-number"
                      v-model="passportDraft.number"
                      class="form-control"
                      :class="{
                        'is-invalid': fieldError('passport', 'number'),
                      }"
                      inputmode="numeric"
                      maxlength="6"
                      :disabled="!sections.passport.editing"
                      @input="onPassportNumberInput"
                    />
                    <div
                      v-if="fieldError('passport', 'number')"
                      class="invalid-feedback d-block"
                    >
                      {{ fieldError('passport', 'number') }}
                    </div>
                  </div>
                  <div class="col-12 col-lg-4">
                    <label class="form-label" for="passport-issue-date"
                      >Дата выдачи</label
                    >
                    <input
                      id="passport-issue-date"
                      v-model="passportDraft.issue_date"
                      type="date"
                      class="form-control"
                      :class="{
                        'is-invalid': fieldError('passport', 'issue_date'),
                      }"
                      :disabled="!sections.passport.editing"
                    />
                    <div
                      v-if="fieldError('passport', 'issue_date')"
                      class="invalid-feedback d-block"
                    >
                      {{ fieldError('passport', 'issue_date') }}
                    </div>
                  </div>
                  <div class="col-12 col-lg-4">
                    <label class="form-label" for="passport-valid-until"
                      >Действителен до</label
                    >
                    <input
                      id="passport-valid-until"
                      v-model="passportDraft.valid_until"
                      type="date"
                      class="form-control"
                      :disabled="
                        sections.passport.editing &&
                        passportDraft.country === 'RU' &&
                        passportDraft.document_type === 'CIVIL'
                      "
                      :class="{
                        'is-invalid': fieldError('passport', 'valid_until'),
                      }"
                    />
                    <div
                      v-if="fieldError('passport', 'valid_until')"
                      class="invalid-feedback d-block"
                    >
                      {{ fieldError('passport', 'valid_until') }}
                    </div>
                  </div>
                  <div class="col-12 col-lg-4 position-relative">
                    <label class="form-label" for="passport-code"
                      >Код подразделения</label
                    >
                    <input
                      id="passport-code"
                      v-model="passportDraft.issuing_authority_code"
                      class="form-control"
                      :class="{
                        'is-invalid': fieldError(
                          'passport',
                          'issuing_authority_code'
                        ),
                      }"
                      :disabled="!sections.passport.editing"
                      inputmode="numeric"
                      maxlength="7"
                      @input="onPassportCodeInput"
                    />
                    <ul
                      v-if="
                        sections.passport.editing &&
                        passportDraft.country === 'RU' &&
                        passportDraft.document_type === 'CIVIL' &&
                        passportSuggestions.length
                      "
                      class="list-group position-absolute w-100"
                      style="z-index: 1050; top: 100%; left: 0"
                    >
                      <li
                        v-for="suggestion in passportSuggestions"
                        :key="suggestion.value"
                        class="list-group-item p-0"
                      >
                        <button
                          type="button"
                          class="list-group-item list-group-item-action w-100 text-start border-0 bg-transparent"
                          @mousedown.prevent="
                            onPassportSuggestionPick(suggestion)
                          "
                        >
                          {{ suggestion.value }}
                        </button>
                      </li>
                    </ul>
                    <div
                      v-if="fieldError('passport', 'issuing_authority_code')"
                      class="invalid-feedback d-block"
                    >
                      {{ fieldError('passport', 'issuing_authority_code') }}
                    </div>
                  </div>
                  <div class="col-12 col-lg-6 position-relative">
                    <label class="form-label" for="passport-authority"
                      >Кем выдан</label
                    >
                    <input
                      id="passport-authority"
                      v-model="passportDraft.issuing_authority"
                      class="form-control"
                      readonly
                      :class="{
                        'is-invalid': fieldError(
                          'passport',
                          'issuing_authority'
                        ),
                      }"
                      :disabled="!sections.passport.editing"
                    />
                    <div
                      v-if="fieldError('passport', 'issuing_authority')"
                      class="invalid-feedback d-block"
                    >
                      {{ fieldError('passport', 'issuing_authority') }}
                    </div>
                  </div>
                  <div class="col-12 col-lg-6">
                    <label class="form-label" for="passport-birth-place"
                      >Место рождения</label
                    >
                    <input
                      id="passport-birth-place"
                      v-model="passportDraft.place_of_birth"
                      class="form-control"
                      :class="{
                        'is-invalid': fieldError('passport', 'place_of_birth'),
                      }"
                      :disabled="!sections.passport.editing"
                    />
                    <div
                      v-if="fieldError('passport', 'place_of_birth')"
                      class="invalid-feedback d-block"
                    >
                      {{ fieldError('passport', 'place_of_birth') }}
                    </div>
                  </div>
                  <div
                    v-if="
                      passportValidityMessage ||
                      passportValidityStatus === 'checking'
                    "
                    class="col-12"
                  >
                    <div
                      class="small"
                      :class="{
                        'text-success': passportValidityStatus === 'valid',
                        'text-warning':
                          passportValidityStatus === 'checking' ||
                          passportValidityStatus === 'idle',
                        'text-danger':
                          passportValidityStatus === 'invalid' ||
                          passportValidityStatus === 'error',
                      }"
                    >
                      {{
                        passportValidityStatus === 'checking'
                          ? 'Проверка паспорта...'
                          : passportValidityMessage || ''
                      }}
                    </div>
                  </div>
                </div>
              </template>

              <template v-if="activeDocumentsSection === 'inn'">
                <div class="row g-3">
                  <div class="col-12 col-lg-6">
                    <label class="form-label" for="inn-number-modal">ИНН</label>
                    <input
                      id="inn-number-modal"
                      :value="formatInn(innDraft.inn_number)"
                      class="form-control"
                      :class="{ 'is-invalid': fieldError('inn', 'number') }"
                      inputmode="numeric"
                      maxlength="15"
                      :disabled="!sections.inn.editing"
                      @input="onInnInput"
                    />
                    <div
                      v-if="fieldError('inn', 'number')"
                      class="invalid-feedback d-block"
                    >
                      {{ fieldError('inn', 'number') }}
                    </div>
                  </div>
                </div>
              </template>

              <template v-if="activeDocumentsSection === 'snils'">
                <div class="row g-3">
                  <div class="col-12 col-lg-6">
                    <label class="form-label" for="snils-number-modal"
                      >СНИЛС</label
                    >
                    <input
                      id="snils-number-modal"
                      :value="formatSnils(snilsDraft.snils_number)"
                      class="form-control"
                      :class="{ 'is-invalid': fieldError('snils', 'number') }"
                      inputmode="numeric"
                      maxlength="14"
                      :disabled="!sections.snils.editing"
                      @input="onSnilsInput"
                    />
                    <div
                      v-if="fieldError('snils', 'number')"
                      class="invalid-feedback d-block"
                    >
                      {{ fieldError('snils', 'number') }}
                    </div>
                  </div>
                </div>
              </template>

              <template v-if="activeDocumentsSection === 'bank_account'">
                <div class="row g-3">
                  <div class="col-12 col-lg-6">
                    <label class="form-label" for="bank-number-modal"
                      >Счёт</label
                    >
                    <input
                      id="bank-number-modal"
                      v-model="bankDraft.number"
                      class="form-control"
                      :class="{
                        'is-invalid': fieldError('bank_account', 'number'),
                      }"
                      inputmode="numeric"
                      maxlength="20"
                      :disabled="!sections.bank_account.editing"
                      @input="onBankNumberInput"
                    />
                    <div
                      v-if="fieldError('bank_account', 'number')"
                      class="invalid-feedback d-block"
                    >
                      {{ fieldError('bank_account', 'number') }}
                    </div>
                  </div>
                  <div class="col-12 col-lg-6">
                    <label class="form-label" for="bank-bic-modal">БИК</label>
                    <input
                      id="bank-bic-modal"
                      v-model="bankDraft.bic"
                      class="form-control"
                      :class="{
                        'is-invalid': fieldError('bank_account', 'bic'),
                      }"
                      inputmode="numeric"
                      maxlength="9"
                      :disabled="!sections.bank_account.editing"
                      @input="onBankBicInput"
                    />
                    <div
                      v-if="fieldError('bank_account', 'bic')"
                      class="invalid-feedback d-block"
                    >
                      {{ fieldError('bank_account', 'bic') }}
                    </div>
                  </div>
                </div>
                <div
                  v-if="workspace.profile.bank_account"
                  class="small text-muted mt-2"
                >
                  {{ workspace.profile.bank_account.bank_name }}
                </div>
              </template>

              <template v-if="activeDocumentsSection === 'addresses'">
                <div class="row g-3">
                  <div class="col-12">
                    <label class="form-label" for="registration-address-modal"
                      >Адрес регистрации</label
                    >
                    <textarea
                      id="registration-address-modal"
                      v-model="addressesDraft.registration"
                      rows="2"
                      class="form-control"
                      :class="{
                        'is-invalid': fieldError('addresses', 'registration'),
                      }"
                      :disabled="!sections.addresses.editing"
                    ></textarea>
                    <div
                      v-if="fieldError('addresses', 'registration')"
                      class="invalid-feedback d-block"
                    >
                      {{ fieldError('addresses', 'registration') }}
                    </div>
                  </div>
                  <div class="col-12">
                    <label class="form-label" for="residence-address-modal"
                      >Адрес проживания</label
                    >
                    <textarea
                      id="residence-address-modal"
                      v-model="addressesDraft.residence"
                      rows="2"
                      class="form-control"
                      :class="{
                        'is-invalid': fieldError('addresses', 'residence'),
                      }"
                      :disabled="!sections.addresses.editing"
                    ></textarea>
                    <div
                      v-if="fieldError('addresses', 'residence')"
                      class="invalid-feedback d-block"
                    >
                      {{ fieldError('addresses', 'residence') }}
                    </div>
                  </div>
                </div>
              </template>
            </template>

            <template v-if="activeWorkspaceTile === 'access'">
              <div
                v-if="!canEditRolesPermission"
                class="alert alert-warning mb-3"
              >
                Недостаточно прав для редактирования ролей.
              </div>
              <div v-if="!rolesCatalog.length" class="text-muted">
                <p class="mb-2">Список ролей загружается для редактирования.</p>
                <p v-if="workspace.user.role_names.length" class="small mb-0">
                  Текущие роли: {{ workspace.user.role_names.join(', ') }}
                </p>
                <p v-else class="small mb-0">Роли не назначены.</p>
              </div>
              <template v-else>
                <section
                  class="workspace-role-section workspace-role-section--federation border rounded p-3 mb-3"
                >
                  <div class="workspace-role-section__header mb-3">
                    <div>
                      <h3 class="h6 mb-1">Сотрудники Федерации</h3>
                      <p class="small text-muted mb-0">
                        Формат назначения: сотрудник Федерации → отдел → должность
                      </p>
                    </div>
                    <div class="workspace-role-counter">
                      Выбрано {{ federationSelectedCount }} из
                      {{ federationRoles.length }}
                    </div>
                  </div>

                  <div class="row g-3 workspace-role-controls">
                    <div class="col-12 col-lg-4">
                      <label
                        class="workspace-role-option workspace-role-toggle border rounded p-3 d-flex align-items-center gap-2 mb-0"
                        :class="{
                          'workspace-role-option--checked': federationEmployment,
                          'workspace-role-option--disabled':
                            !sections.roles.editing || !canEditRolesPermission,
                        }"
                      >
                        <input
                          class="form-check-input workspace-role-checkbox m-0"
                          type="checkbox"
                          :checked="federationEmployment"
                          :disabled="
                            !sections.roles.editing ||
                            !canEditRolesPermission
                          "
                          @change="
                            onFederationEmploymentChange(
                              ($event.target as HTMLInputElement).checked
                            )
                          "
                        />
                        <span class="workspace-role-label">Сотрудник Федерации</span>
                      </label>
                    </div>

                    <div class="col-12 col-lg-4">
                      <label class="form-label" for="federation-department-select">
                        Отдел
                      </label>
                      <select
                        id="federation-department-select"
                        class="form-select"
                        :class="{
                          'is-invalid':
                            federationEmployment &&
                            !federationDepartmentAlias &&
                            fieldError('roles', 'roles'),
                        }"
                        :disabled="
                          !federationEmployment ||
                          !sections.roles.editing ||
                          !canEditRolesPermission
                        "
                        :value="federationDepartmentAlias"
                        @change="
                          onFederationDepartmentChange(
                            ($event.target as HTMLSelectElement).value
                          )
                        "
                      >
                        <option value="">Выберите отдел</option>
                        <option
                          v-for="department in federationRoleDepartments"
                          :key="department.key"
                          :value="department.key"
                        >
                          {{ department.name }}
                        </option>
                      </select>
                    </div>

                    <div class="col-12 col-lg-4">
                      <label class="form-label" for="federation-position-select">
                        Должность
                      </label>
                      <select
                        id="federation-position-select"
                        class="form-select"
                        :class="{
                          'is-invalid': fieldError('roles', 'roles'),
                        }"
                        :disabled="
                          !federationEmployment ||
                          !federationDepartmentAlias ||
                          !sections.roles.editing ||
                          !canEditRolesPermission
                        "
                        :value="federationPositionAlias"
                        @change="
                          onFederationPositionChange(
                            ($event.target as HTMLSelectElement).value
                          )
                        "
                      >
                        <option value="">Выберите должность</option>
                        <option
                          v-for="role in federationPositionsByDepartment"
                          :key="role.id"
                          :value="role.id"
                        >
                          {{ role.name }}
                        </option>
                      </select>
                      <div
                        v-if="fieldError('roles', 'roles')"
                        class="invalid-feedback d-block"
                      >
                        {{ fieldError('roles', 'roles') }}
                      </div>
                    </div>
                  </div>

                  <div
                    v-if="hasMultipleFederationRoles"
                    class="alert alert-warning mt-3 mb-0"
                  >
                    У пользователя уже несколько должностей Федерации.
                    Сохраните профиль с одной выбранной должностью.
                  </div>
                </section>

                <section
                  class="workspace-role-section workspace-role-section--other border rounded p-3"
                >
                  <div class="workspace-role-section__header mb-3">
                    <div>
                      <h3 class="h6 mb-1">Остальные роли</h3>
                      <p class="small text-muted mb-0">
                        Системные и внешние роли вне структуры Федерации
                      </p>
                    </div>
                    <div class="workspace-role-counter">
                      Выбрано {{ otherSelectedCount }} из
                      {{ otherRoles.length }}
                    </div>
                  </div>

                  <div v-if="!otherRoles.length" class="small text-muted">
                    Дополнительные роли не найдены.
                  </div>

                  <div class="row g-2" v-else>
                    <div
                      v-for="role in otherRoles"
                      :key="role.id"
                      class="col-12 col-md-6 col-xl-4"
                    >
                      <label
                        class="workspace-role-option border rounded p-2 h-100 d-flex align-items-start gap-2"
                        :class="{
                          'workspace-role-option--checked':
                            roleSelection.includes(role.id),
                          'workspace-role-option--disabled':
                            !sections.roles.editing ||
                            !canEditRolesPermission,
                        }"
                      >
                        <input
                          v-model="roleSelection"
                          :disabled="
                            !sections.roles.editing ||
                            !canEditRolesPermission
                          "
                          class="form-check-input workspace-role-checkbox mt-1 flex-shrink-0"
                          type="checkbox"
                          :value="role.id"
                        />
                        <span class="workspace-role-label">{{ role.name }}</span>
                      </label>
                    </div>
                  </div>
                </section>
              </template>
            </template>

            <template v-if="activeWorkspaceTile === 'links'">
              <div
                v-if="!workspace.permissions.can_manage_links"
                class="alert alert-warning mb-3"
              >
                Недостаточно прав для управления связями клубов и команд.
              </div>
              <div class="row g-3">
                <div class="col-12 col-xl-6">
                  <section class="workspace-links-card border rounded-3 p-3 h-100">
                    <div class="workspace-links-card__head">
                      <label class="form-label mb-0" for="club-selection"
                        >Клубы</label
                      >
                      <span class="small text-muted"
                        >Выбрано: {{ clubSelection.length }}</span
                      >
                    </div>

                    <div class="input-group mb-2">
                      <span class="input-group-text" aria-hidden="true">
                        <i class="bi bi-search"></i>
                      </span>
                      <input
                        id="club-search"
                        v-model="linksSearch.clubQuery"
                        type="search"
                        class="form-control"
                        placeholder="Поиск клуба"
                        :disabled="
                          !sections.sport_schools.editing ||
                          !workspace.permissions.can_manage_links
                        "
                      />
                      <button
                        v-if="linksSearch.clubQuery"
                        type="button"
                        class="btn btn-outline-secondary"
                        :disabled="
                          !sections.sport_schools.editing ||
                          !workspace.permissions.can_manage_links
                        "
                        @click="clearClubSearch"
                      >
                        Очистить
                      </button>
                    </div>

                    <select
                      id="club-selection"
                      v-model="clubSelection"
                      class="form-select workspace-links-select"
                      multiple
                      size="10"
                      :disabled="
                        !sections.sport_schools.editing ||
                        !workspace.permissions.can_manage_links
                      "
                    >
                      <option
                        v-for="club in clubOptions"
                        :key="club.id"
                        :value="club.id"
                      >
                        {{ club.name }}
                      </option>
                    </select>

                    <div class="form-text mt-2">
                      <span v-if="linksSearch.clubsLoading">Поиск клубов...</span>
                      <span v-else-if="clubOptions.length"
                        >Показано: {{ clubOptions.length }}</span
                      >
                      <span v-else>Клубы не найдены</span>
                    </div>

                    <div
                      v-if="clubSelection.length"
                      class="workspace-links-selected mt-2"
                    >
                      <div class="workspace-links-selected__label">
                        Привязанные клубы
                      </div>
                      <div class="workspace-links-chip-list">
                        <span
                          v-for="clubId in clubSelection"
                          :key="`selected-club-${clubId}`"
                          class="workspace-links-chip"
                        >
                          {{ clubOptionName(clubId) }}
                          <button
                            type="button"
                            class="workspace-links-chip__remove"
                            :disabled="
                              !sections.sport_schools.editing ||
                              !workspace.permissions.can_manage_links
                            "
                            @click="removeClubLink(clubId)"
                          >
                            <i class="bi bi-x-lg" aria-hidden="true"></i>
                            <span class="visually-hidden">Отвязать клуб</span>
                          </button>
                        </span>
                      </div>
                    </div>
                  </section>
                </div>
                <div class="col-12 col-xl-6">
                  <section class="workspace-links-card border rounded-3 p-3 h-100">
                    <div class="workspace-links-card__head">
                      <label class="form-label mb-0" for="team-selection"
                        >Команды</label
                      >
                      <span class="small text-muted"
                        >Выбрано: {{ teamSelection.length }}</span
                      >
                    </div>

                    <div class="input-group mb-2">
                      <span class="input-group-text" aria-hidden="true">
                        <i class="bi bi-search"></i>
                      </span>
                      <input
                        id="team-search"
                        v-model="linksSearch.teamQuery"
                        type="search"
                        class="form-control"
                        placeholder="Поиск команды"
                        :disabled="
                          !sections.sport_schools.editing ||
                          !workspace.permissions.can_manage_links
                        "
                      />
                      <button
                        v-if="linksSearch.teamQuery"
                        type="button"
                        class="btn btn-outline-secondary"
                        :disabled="
                          !sections.sport_schools.editing ||
                          !workspace.permissions.can_manage_links
                        "
                        @click="clearTeamSearch"
                      >
                        Очистить
                      </button>
                    </div>

                    <select
                      id="team-selection"
                      v-model="teamSelection"
                      class="form-select workspace-links-select"
                      multiple
                      size="10"
                      :disabled="
                        !sections.sport_schools.editing ||
                        !workspace.permissions.can_manage_links
                      "
                    >
                      <option
                        v-for="team in teamOptions"
                        :key="team.id"
                        :value="team.id"
                      >
                        {{ team.name }}
                      </option>
                    </select>

                    <div class="form-text mt-2">
                      <span v-if="linksSearch.teamsLoading"
                        >Поиск команд...</span
                      >
                      <span v-else-if="teamOptions.length"
                        >Показано: {{ teamOptions.length }}</span
                      >
                      <span v-else>Команды не найдены</span>
                    </div>

                    <div
                      v-if="teamSelection.length"
                      class="workspace-links-selected mt-2"
                    >
                      <div class="workspace-links-selected__label">
                        Привязанные команды
                      </div>
                      <div class="workspace-links-chip-list">
                        <span
                          v-for="teamId in teamSelection"
                          :key="`selected-team-${teamId}`"
                          class="workspace-links-chip"
                        >
                          {{ teamOptionName(teamId) }}
                          <button
                            type="button"
                            class="workspace-links-chip__remove"
                            :disabled="
                              !sections.sport_schools.editing ||
                              !workspace.permissions.can_manage_links
                            "
                            @click="removeTeamLink(teamId)"
                          >
                            <i class="bi bi-x-lg" aria-hidden="true"></i>
                            <span class="visually-hidden">Отвязать команду</span>
                          </button>
                        </span>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
              <div
                v-if="!clubOptions.length && !teamOptions.length"
                class="text-muted mt-2"
              >
                Справочники клубов и команд загружаются при редактировании.
              </div>
            </template>

            <template v-if="activeWorkspaceTile === 'taxes'">
              <section class="workspace-tax">
                <div v-if="workspaceTaxation" class="workspace-tax-grid">
                  <article class="workspace-tax-card">
                    <div class="workspace-tax-card__label">Текущий тип</div>
                    <div class="workspace-tax-card__value">
                      {{ workspaceTaxation.type?.name || '—' }}
                    </div>
                  </article>
                  <article class="workspace-tax-card">
                    <div class="workspace-tax-card__label">Дата проверки</div>
                    <div class="workspace-tax-card__value">
                      {{ workspaceTaxation.check_date || '—' }}
                    </div>
                  </article>
                  <article class="workspace-tax-card">
                    <div class="workspace-tax-card__label">Дата регистрации</div>
                    <div class="workspace-tax-card__value">
                      {{ workspaceTaxation.registration_date || '—' }}
                    </div>
                  </article>
                  <article class="workspace-tax-card">
                    <div class="workspace-tax-card__label">ОГРН</div>
                    <div class="workspace-tax-card__value">
                      {{ workspaceTaxation.ogrn || '—' }}
                    </div>
                  </article>
                  <article class="workspace-tax-card">
                    <div class="workspace-tax-card__label">ОКВЭД</div>
                    <div class="workspace-tax-card__value">
                      {{ workspaceTaxation.okved || '—' }}
                    </div>
                  </article>
                  <article class="workspace-tax-card">
                    <div class="workspace-tax-card__label">Статусы источников</div>
                    <div class="workspace-tax-card__chips">
                      <span class="badge text-bg-light"
                        >DaData: {{ workspaceTaxation.statuses?.dadata ?? '—' }}</span
                      >
                      <span class="badge text-bg-light"
                        >ФНС: {{ workspaceTaxation.statuses?.fns ?? '—' }}</span
                      >
                    </div>
                  </article>
                </div>
                <div v-else class="alert alert-warning mb-0">
                  Налоговый статус ещё не определён.
                </div>

                <div class="workspace-tax-actions mt-3">
                  <button
                    type="button"
                    class="btn btn-outline-primary btn-sm"
                    :disabled="sections.taxation.saving"
                    @click="runTaxationPreview"
                  >
                    Проверить налоговый статус
                  </button>
                  <span
                    v-if="sections.taxation.dirty"
                    class="badge text-bg-info align-self-center"
                    >Есть предварительный результат</span
                  >
                </div>

                <div v-if="taxationPreview" class="workspace-tax-preview mt-3">
                  <div class="workspace-tax-preview__title">
                    Предпросмотр после проверки
                  </div>
                  <div class="workspace-tax-preview__value">
                    {{ taxationPreview.type?.name || '—' }}
                  </div>
                  <div class="workspace-tax-preview__chips">
                    <span class="badge text-bg-light"
                      >DaData: {{ taxationPreview.statuses?.dadata ?? '—' }}</span
                    >
                    <span class="badge text-bg-light"
                      >ФНС: {{ taxationPreview.statuses?.fns ?? '—' }}</span
                    >
                  </div>
                </div>
              </section>
            </template>
          </div>

          <div class="modal-footer">
            <button
              v-if="activeSectionState"
              type="button"
              class="btn btn-outline-secondary"
              :disabled="activeSectionState.saving"
              @click="cancelActiveEdit"
            >
              Отмена
            </button>
            <button
              v-if="activeSectionState"
              type="button"
              class="btn btn-brand"
              :disabled="!canSaveActiveSection"
              @click="saveActiveEdit"
            >
              <span
                v-if="activeSectionState.saving"
                class="spinner-border spinner-border-sm me-1"
                aria-hidden="true"
              ></span>
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-user-workspace {
  padding-bottom: 1.5rem;
}

.workspace-tiles__head {
  display: flex;
  align-items: center;
}

.workspace-tile {
  border: 1px solid rgba(var(--bs-dark-rgb), 0.08);
  border-radius: 1rem;
  background: var(--bs-body-bg);
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease,
    border-color 0.12s ease;
}

.workspace-tile:hover,
.workspace-tile:focus-visible {
  transform: translateY(-2px);
  box-shadow: var(--bs-box-shadow-lg);
  border-color: rgba(var(--bs-primary-rgb), 0.26);
}

.workspace-tiles .workspace-tile {
  min-height: 7.4rem;
}

.workspace-tile__body {
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: space-between;
  gap: 0.65rem;
}

.workspace-tile__headrow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.workspace-tile__icon {
  width: 2.3rem;
  height: 2.3rem;
  border-radius: 0.7rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--bs-primary-rgb), 0.12);
  color: rgba(var(--bs-primary-rgb), 0.96);
  font-size: 1.1rem;
}

.workspace-tile__badge {
  flex-shrink: 0;
}

.workspace-tile__title {
  line-height: 1.25;
}

.workspace-modal :deep(.modal-dialog) {
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
}

.workspace-modal :deep(.modal-content) {
  border: 0;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 1.25rem 2.5rem rgba(15, 23, 42, 0.18);
}

.workspace-modal :deep(.modal-header),
.workspace-modal :deep(.modal-footer) {
  padding: 1rem 1.5rem;
}

.workspace-modal :deep(.modal-body) {
  padding: 1.25rem 1.5rem;
}

.workspace-role-option {
  cursor: pointer;
  line-height: 1.25;
  min-height: 3.95rem;
  transition:
    border-color 0.12s ease,
    background-color 0.12s ease,
    box-shadow 0.12s ease;
}

.workspace-role-section {
  background: linear-gradient(
    180deg,
    rgba(var(--bs-light-rgb), 0.34) 0%,
    rgba(var(--bs-light-rgb), 0.18) 100%
  );
  border-color: rgba(var(--bs-dark-rgb), 0.09) !important;
}

.workspace-role-section--federation {
  background: linear-gradient(
    180deg,
    rgba(var(--bs-primary-rgb), 0.06) 0%,
    rgba(var(--bs-light-rgb), 0.15) 100%
  );
}

.workspace-role-section__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.workspace-role-counter {
  font-size: 0.95rem;
  color: var(--bs-secondary-color);
  white-space: nowrap;
}

.workspace-role-toggle {
  min-height: 3.95rem;
}

.workspace-role-checkbox {
  margin-left: 0;
}

.workspace-role-label {
  flex: 1;
}

.workspace-role-option--checked {
  border-color: rgba(var(--bs-primary-rgb), 0.55) !important;
  background: rgba(var(--bs-primary-rgb), 0.08);
  box-shadow: inset 0 0 0 1px rgba(var(--bs-primary-rgb), 0.12);
}

.workspace-role-option--disabled {
  cursor: not-allowed;
  opacity: 0.8;
}

.workspace-links-card {
  border-color: rgba(var(--bs-dark-rgb), 0.1) !important;
  background: rgba(var(--bs-light-rgb), 0.2);
}

.workspace-links-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.workspace-links-select {
  min-height: 15.4rem;
}

.workspace-links-selected__label {
  font-size: 0.85rem;
  color: var(--bs-secondary-color);
  margin-bottom: 0.35rem;
}

.workspace-links-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.workspace-links-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: rgba(var(--bs-primary-rgb), 0.08);
  color: var(--bs-body-color);
  border: 1px solid rgba(var(--bs-primary-rgb), 0.28);
  border-radius: 999px;
  padding: 0.16rem 0.45rem 0.16rem 0.6rem;
  font-size: 0.82rem;
  max-width: 100%;
}

.workspace-links-chip__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.3rem;
  height: 1.3rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: inherit;
  opacity: 0.82;
}

.workspace-links-chip__remove:disabled {
  opacity: 0.4;
}

.workspace-links-chip__remove:not(:disabled):hover,
.workspace-links-chip__remove:not(:disabled):focus-visible {
  background: rgba(var(--bs-primary-rgb), 0.18);
  opacity: 1;
}

.workspace-tax {
  display: flex;
  flex-direction: column;
}

.workspace-tax-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.workspace-tax-card {
  border: 1px solid rgba(var(--bs-dark-rgb), 0.08);
  border-radius: 0.75rem;
  background: #fff;
  padding: 0.85rem 1rem;
  min-height: 5.2rem;
}

.workspace-tax-card__label {
  font-size: 0.9rem;
  color: var(--bs-secondary-color);
  margin-bottom: 0.25rem;
}

.workspace-tax-card__value {
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.workspace-tax-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.workspace-tax-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.workspace-tax-preview {
  border: 1px solid rgba(var(--bs-primary-rgb), 0.22);
  border-radius: 0.75rem;
  background: rgba(var(--bs-primary-rgb), 0.06);
  padding: 0.85rem 1rem;
}

.workspace-tax-preview__title {
  font-size: 0.85rem;
  color: var(--bs-secondary-color);
  margin-bottom: 0.2rem;
}

.workspace-tax-preview__value {
  font-size: 1.05rem;
  font-weight: 700;
}

.workspace-tax-preview__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.5rem;
}

@media (max-width: 991.98px) {
  .workspace-role-section__header {
    flex-direction: column;
  }

  .workspace-role-counter {
    white-space: normal;
  }

  .workspace-modal :deep(.modal-header),
  .workspace-modal :deep(.modal-body),
  .workspace-modal :deep(.modal-footer) {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .workspace-tax-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .workspace-links-card__head {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 767.98px) {
  .workspace-tax-grid {
    grid-template-columns: 1fr;
  }
}
</style>
