<script setup lang="ts">
import {
  ref,
  onMounted,
  watch,
  computed,
  nextTick,
  onBeforeUnmount,
} from 'vue';
import { useRouter } from 'vue-router';
import Tooltip from 'bootstrap/js/dist/tooltip';

import PageNav from '@/components/PageNav.vue';
import TabSelector from '@/components/TabSelector.vue';
import TaxationInfo from '@/components/TaxationInfo.vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import UsersFilterModal from '@/components/UsersFilterModal.vue';
import Breadcrumbs from '@/components/Breadcrumbs.vue';
import { loadPageSize, savePageSize } from '@/utils/pageSize';
import { apiFetch } from '@/api';
import { useToast } from '@/utils/toast';
import type {
  AdminUserSummary,
  AdminUsersResponse,
  AdminProfileCompletion,
  AdminProfileCompletionResponse,
  UserRoleOption,
  RolesResponse,
} from '@/types/admin';

type AdminTabKey = 'users' | 'profiles';
type SortField = 'last_name' | 'phone' | 'email' | 'birth_date' | 'status';
type SortOrder = 'asc' | 'desc';
type BulkAction = 'block' | 'unblock';

interface TaxationInfoInstance {
  openModal: () => void;
}

interface ConfirmModalInstance {
  open: () => void;
}

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const router = useRouter();
const { showToast } = useToast();

const breadcrumbs = computed(() => [
  { label: 'Администрирование', to: '/admin' },
  { label: 'Пользователи' },
]);

const users = ref<AdminUserSummary[]>([]);
const total = ref(0);
const error = ref('');
const isLoading = ref(false);

const activeTab = ref<AdminTabKey>('users');

const completion = ref<AdminProfileCompletion[]>([]);
const completionTotal = ref(0);
const completionLoading = ref(false);
const completionError = ref('');

const search = ref('');
const searchDebounced = ref('');
const statusFilter = ref('');
const roleFilter = ref('');
const currentPage = ref(1);
const pageSize = ref<number>(
  loadPageSize('adminUsersPageSize', DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS)
);
const sortField = ref<SortField>('last_name');
const sortOrder = ref<SortOrder>('asc');

const completionSearch = ref('');
const completionSearchDebounced = ref('');
const completionStatusFilter = ref('');
const completionHasSnilsFilter = ref('');
const completionPage = ref(1);
const completionPageSize = ref<number>(
  loadPageSize(
    'adminProfileCompletionPageSize',
    DEFAULT_PAGE_SIZE,
    PAGE_SIZE_OPTIONS
  )
);

const roles = ref<UserRoleOption[]>([]);
const selected = ref<Set<string>>(new Set());

const taxModal = ref<TaxationInfoInstance | null>(null);
const taxUserId = ref('');

const confirmRef = ref<ConfirmModalInstance | null>(null);
const confirmTitle = ref('Подтверждение');
const confirmMessage = ref('');
let confirmAction: (() => Promise<void>) | null = null;

const filtersOpen = ref(false);
const isHydratingQuery = ref(true);
const viewportWidth = ref(1024);
const selectAllRef = ref<HTMLInputElement | null>(null);
const usersSearchInputRef = ref<HTMLInputElement | null>(null);
const completionSearchInputRef = ref<HTMLInputElement | null>(null);
const pendingQuerySync = ref(false);

type TooltipInstance = InstanceType<typeof Tooltip>;
const tooltipInstances: TooltipInstance[] = [];

const tooltipAttrs = Object.freeze({
  'data-bs-toggle': 'tooltip',
  'data-bs-placement': 'bottom',
} as const);

const activeFiltersCount = computed(() => {
  let count = 0;
  if (search.value.trim()) count += 1;
  if (statusFilter.value) count += 1;
  if (roleFilter.value) count += 1;
  return count;
});

const completionFiltersCount = computed(() => {
  let count = 0;
  if (completionSearch.value.trim()) count += 1;
  if (completionStatusFilter.value) count += 1;
  if (completionHasSnilsFilter.value) count += 1;
  return count;
});

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / Math.max(pageSize.value, 1)))
);
const completionTotalPages = computed(() =>
  Math.max(
    1,
    Math.ceil(completionTotal.value / Math.max(completionPageSize.value, 1))
  )
);

const isUsersDesktop = computed(() => viewportWidth.value >= 992);
const isProfileDesktop = computed(() => viewportWidth.value >= 576);

const anySelected = computed(() => selected.value.size > 0);
const allSelectedOnPage = computed<boolean>({
  get() {
    return users.value.length > 0 && selected.value.size === users.value.length;
  },
  set(val: boolean) {
    selected.value = new Set(val ? users.value.map((u) => u.id) : []);
  },
});

const usersQueryState = computed(() => ({
  search: searchDebounced.value,
  status: statusFilter.value,
  role: roleFilter.value,
  page: currentPage.value,
  limit: pageSize.value,
  sort: sortField.value,
  order: sortOrder.value,
}));

const completionQueryState = computed(() => ({
  search: completionSearchDebounced.value,
  completionStatus: completionStatusFilter.value,
  hasSnils: completionHasSnilsFilter.value,
  page: completionPage.value,
  limit: completionPageSize.value,
}));

const routeQueryState = computed(() => ({
  tab: activeTab.value,
  users: usersQueryState.value,
  profiles: completionQueryState.value,
}));

function normalizePage(value: unknown, fallback = 1): number {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizePageSize(
  value: unknown,
  fallback = DEFAULT_PAGE_SIZE
): number {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed)) return parsed;
  return fallback;
}

function normalizeSortField(value: unknown): SortField {
  const v = String(value || '').trim();
  if (['last_name', 'phone', 'email', 'birth_date', 'status'].includes(v)) {
    return v as SortField;
  }
  return 'last_name';
}

function normalizeSortOrder(value: unknown): SortOrder {
  return String(value || '')
    .trim()
    .toLowerCase() === 'desc'
    ? 'desc'
    : 'asc';
}

function normalizeCompletionStatus(value: unknown): string {
  const v = String(value || '')
    .trim()
    .toLowerCase();
  return v === 'complete' || v === 'incomplete' ? v : '';
}

function normalizeHasSnils(value: unknown): string {
  const v = String(value || '')
    .trim()
    .toLowerCase();
  return v === 'true' || v === 'false' ? v : '';
}

function updateViewportWidth(): void {
  if (typeof window === 'undefined') return;
  viewportWidth.value = window.innerWidth;
}

function disposeTooltips(): void {
  tooltipInstances.splice(0).forEach((instance) => {
    try {
      instance.dispose();
    } catch {
      /* noop */
    }
  });
}

function applyTooltips(): void {
  nextTick(() => {
    if (typeof document === 'undefined') return;
    disposeTooltips();
    document
      .querySelectorAll<HTMLElement>('[data-bs-toggle="tooltip"]')
      .forEach((el) => {
        tooltipInstances.push(new Tooltip(el));
      });
  });
}

function syncSelectAllCheckbox(): void {
  if (!selectAllRef.value) return;
  selectAllRef.value.indeterminate =
    anySelected.value && !allSelectedOnPage.value;
}

function updateActiveTab(value: string | number): void {
  activeTab.value = value as AdminTabKey;
}

function captureSearchFocus() {
  if (typeof document === 'undefined') return null;
  const active = document.activeElement;
  if (active === usersSearchInputRef.value) {
    const input = usersSearchInputRef.value;
    return {
      target: 'users' as const,
      start: input?.selectionStart ?? null,
      end: input?.selectionEnd ?? null,
    };
  }
  if (active === completionSearchInputRef.value) {
    const input = completionSearchInputRef.value;
    return {
      target: 'profiles' as const,
      start: input?.selectionStart ?? null,
      end: input?.selectionEnd ?? null,
    };
  }
  return null;
}

function restoreSearchFocus(
  state: {
    target: 'users' | 'profiles';
    start: number | null;
    end: number | null;
  } | null
): void {
  if (!state) return;
  const focus = () => {
    const el =
      state.target === 'users'
        ? usersSearchInputRef.value
        : completionSearchInputRef.value;
    if (!el) return;
    el.focus({ preventScroll: true });
    if (state.start === null || state.end === null) return;
    try {
      el.setSelectionRange(state.start, state.end);
    } catch {
      /* ignore unsupported inputs */
    }
  };

  nextTick(() => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          focus();
        });
      });
      return;
    }
    setTimeout(focus, 0);
  });
}

async function loadRoles(): Promise<void> {
  try {
    const data = await apiFetch<RolesResponse>('/roles');
    roles.value = data.roles ?? [];
  } catch {
    roles.value = [];
  }
}

async function loadUsers(): Promise<void> {
  error.value = '';
  isLoading.value = true;
  try {
    const state = usersQueryState.value;
    const params = new URLSearchParams({
      search: state.search,
      status: state.status,
      role: state.role,
      page: String(state.page),
      limit: String(state.limit),
      sort: state.sort,
      order: state.order,
    });
    const data = await apiFetch<AdminUsersResponse>(`/users?${params}`);
    users.value = data.users ?? [];
    total.value = Number.isFinite(data.total) ? data.total : 0;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    users.value = [];
    total.value = 0;
  } finally {
    isLoading.value = false;
    applyTooltips();
    syncSelectAllCheckbox();
  }
}

async function loadCompletion(): Promise<void> {
  completionError.value = '';
  completionLoading.value = true;
  try {
    const state = completionQueryState.value;
    const params = new URLSearchParams({
      page: String(state.page),
      limit: String(state.limit),
      search: state.search,
      completionStatus: state.completionStatus,
      hasSnils: state.hasSnils,
    });
    const data = await apiFetch<AdminProfileCompletionResponse>(
      `/users/profile-completion?${params}`
    );
    completion.value = data.profiles ?? [];
    completionTotal.value = Number.isFinite(data.meta?.total)
      ? Number(data.meta?.total)
      : completion.value.length;
    if (Number.isFinite(data.meta?.page) && Number(data.meta?.page) > 0) {
      completionPage.value = Number(data.meta?.page);
    }
  } catch (e) {
    completionError.value = e instanceof Error ? e.message : String(e);
    completion.value = [];
    completionTotal.value = 0;
  } finally {
    completionLoading.value = false;
  }
}

let searchTimeout: ReturnType<typeof setTimeout> | undefined;
watch(search, () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentPage.value = 1;
    searchDebounced.value = search.value.trim();
  }, 300);
});

let completionSearchTimeout: ReturnType<typeof setTimeout> | undefined;
watch(completionSearch, () => {
  if (completionSearchTimeout) clearTimeout(completionSearchTimeout);
  completionSearchTimeout = setTimeout(() => {
    completionPage.value = 1;
    completionSearchDebounced.value = completionSearch.value.trim();
  }, 300);
});

watch([sortField, sortOrder, statusFilter, roleFilter, pageSize], () => {
  currentPage.value = 1;
});

watch(
  [completionStatusFilter, completionHasSnilsFilter, completionPageSize],
  () => {
    completionPage.value = 1;
  }
);

watch(
  [pageSize, completionPageSize],
  ([usersSize, completionSize]) => {
    savePageSize('adminUsersPageSize', usersSize);
    savePageSize('adminProfileCompletionPageSize', completionSize);
  },
  { immediate: true }
);

watch(users, () => {
  selected.value = new Set();
  syncSelectAllCheckbox();
});

watch(
  () => [anySelected.value, allSelectedOnPage.value],
  () => {
    syncSelectAllCheckbox();
  },
  { immediate: true }
);

watch(usersQueryState, () => {
  if (isHydratingQuery.value || activeTab.value !== 'users') return;
  void loadUsers();
});

watch(completionQueryState, () => {
  if (isHydratingQuery.value || activeTab.value !== 'profiles') return;
  void loadCompletion();
});

watch(routeQueryState, () => {
  if (isHydratingQuery.value) return;
  syncQuery();
});

watch(activeTab, (tab) => {
  if (isHydratingQuery.value) return;
  if (tab === 'profiles') {
    void loadCompletion();
  } else {
    void loadUsers();
  }
});

onMounted(async () => {
  try {
    const query = router.currentRoute.value.query;
    const tab = query['tab'];
    if (typeof tab === 'string' && (tab === 'users' || tab === 'profiles')) {
      activeTab.value = tab;
    }

    if (typeof query['search'] === 'string') {
      search.value = query['search'].trim();
      searchDebounced.value = search.value;
    }
    if (typeof query['status'] === 'string')
      statusFilter.value = query['status'];
    if (typeof query['role'] === 'string') roleFilter.value = query['role'];

    currentPage.value = normalizePage(query['page']);
    pageSize.value = normalizePageSize(query['limit'], pageSize.value);
    sortField.value = normalizeSortField(query['sort']);
    sortOrder.value = normalizeSortOrder(query['order']);

    if (typeof query['c_search'] === 'string') {
      completionSearch.value = query['c_search'].trim();
      completionSearchDebounced.value = completionSearch.value;
    }
    completionStatusFilter.value = normalizeCompletionStatus(query['c_status']);
    completionHasSnilsFilter.value = normalizeHasSnils(query['c_snils']);
    completionPage.value = normalizePage(query['c_page']);
    completionPageSize.value = normalizePageSize(
      query['c_limit'],
      completionPageSize.value
    );
  } catch {
    /* ignore malformed query */
  }

  updateViewportWidth();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateViewportWidth, { passive: true });
  }

  isHydratingQuery.value = false;

  await loadRoles();
  if (activeTab.value === 'profiles') {
    await loadCompletion();
  } else {
    await loadUsers();
  }
  syncQuery();
  applyTooltips();
});

onBeforeUnmount(() => {
  if (searchTimeout) clearTimeout(searchTimeout);
  if (completionSearchTimeout) clearTimeout(completionSearchTimeout);
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateViewportWidth);
  }
  disposeTooltips();
});

function syncQuery(): void {
  if (
    typeof document !== 'undefined' &&
    (document.activeElement === usersSearchInputRef.value ||
      document.activeElement === completionSearchInputRef.value)
  ) {
    pendingQuerySync.value = true;
    return;
  }

  const usersState = usersQueryState.value;
  const profilesState = completionQueryState.value;
  const focusState = captureSearchFocus();
  pendingQuerySync.value = false;
  void router
    .replace({
      query: {
        tab: activeTab.value,
        search: usersState.search || undefined,
        status: usersState.status || undefined,
        role: usersState.role || undefined,
        page: usersState.page !== 1 ? String(usersState.page) : undefined,
        limit:
          usersState.limit !== DEFAULT_PAGE_SIZE
            ? String(usersState.limit)
            : undefined,
        sort: usersState.sort !== 'last_name' ? usersState.sort : undefined,
        order: usersState.order !== 'asc' ? usersState.order : undefined,
        c_search: profilesState.search || undefined,
        c_status: profilesState.completionStatus || undefined,
        c_snils: profilesState.hasSnils || undefined,
        c_page:
          profilesState.page !== 1 ? String(profilesState.page) : undefined,
        c_limit:
          profilesState.limit !== DEFAULT_PAGE_SIZE
            ? String(profilesState.limit)
            : undefined,
      },
    })
    .then(() => {
      restoreSearchFocus(focusState);
    })
    .catch(() => {
      restoreSearchFocus(focusState);
    });
}

function flushPendingQuerySync(): void {
  if (!pendingQuerySync.value) return;
  syncQuery();
}

function isFocusMainSteal(event: FocusEvent): boolean {
  const related = event.relatedTarget as HTMLElement | null;
  return Boolean(related && related.id === 'main');
}

function restoreSearchCaretToEnd(el: HTMLInputElement | null): void {
  if (!el) return;
  nextTick(() => {
    el.focus({ preventScroll: true });
    try {
      const pos = el.value.length;
      el.setSelectionRange(pos, pos);
    } catch {
      /* ignore unsupported inputs */
    }
  });
}

function onUsersSearchBlur(event: FocusEvent): void {
  if (isFocusMainSteal(event)) {
    restoreSearchCaretToEnd(usersSearchInputRef.value);
    return;
  }
  flushPendingQuerySync();
}

function onCompletionSearchBlur(event: FocusEvent): void {
  if (isFocusMainSteal(event)) {
    restoreSearchCaretToEnd(completionSearchInputRef.value);
    return;
  }
  flushPendingQuerySync();
}

function openFilters(): void {
  filtersOpen.value = true;
}

function onFiltersApply({
  status: st,
  role: rl,
}: {
  status: string;
  role: string;
}): void {
  filtersOpen.value = false;
  statusFilter.value = st;
  roleFilter.value = rl;
}

function onFiltersReset(): void {
  filtersOpen.value = false;
  resetFilters();
}

function resetCompletionFilters(): void {
  completionSearch.value = '';
  completionSearchDebounced.value = '';
  completionStatusFilter.value = '';
  completionHasSnilsFilter.value = '';
  completionPage.value = 1;
}

function openCreate(): void {
  void router.push('/admin/users/new');
}

function openEdit(user: AdminUserSummary): void {
  void router.push(`/admin/users/${user.id}`);
}

function openTaxStatus(id: string): void {
  taxUserId.value = id;
  nextTick(() => {
    taxModal.value?.openModal();
  });
}

async function onTaxSaved(): Promise<void> {
  if (activeTab.value === 'profiles') {
    await loadCompletion();
  }
}

async function blockUser(id: string): Promise<void> {
  confirmTitle.value = 'Блокировка пользователя';
  confirmMessage.value = 'Вы уверены, что хотите заблокировать пользователя?';
  confirmAction = async () => {
    try {
      await apiFetch(`/users/${id}/block`, { method: 'POST' });
      showToast('Пользователь заблокирован');
      await loadUsers();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка при блокировке';
      showToast(msg);
    }
  };
  confirmRef.value?.open();
}

async function unblockUser(id: string): Promise<void> {
  confirmTitle.value = 'Разблокировка пользователя';
  confirmMessage.value = 'Подтвердите разблокировку пользователя.';
  confirmAction = async () => {
    try {
      await apiFetch(`/users/${id}/unblock`, { method: 'POST' });
      showToast('Пользователь разблокирован');
      await loadUsers();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка при разблокировке';
      showToast(msg);
    }
  };
  confirmRef.value?.open();
}

function statusClass(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-success';
    case 'INACTIVE':
      return 'bg-danger';
    default:
      return 'bg-secondary';
  }
}

function toggleSort(field: SortField): void {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortOrder.value = 'asc';
  }
}

function formatPhone(digits?: string | null): string {
  if (!digits) return '';
  let out = '+7';
  if (digits.length > 1) out += ` (${digits.slice(1, 4)}`;
  if (digits.length >= 4) out += ') ';
  if (digits.length >= 4) out += digits.slice(4, 7);
  if (digits.length >= 7) out += `-${digits.slice(7, 9)}`;
  if (digits.length >= 9) out += `-${digits.slice(9, 11)}`;
  return out;
}

function formatDate(str?: string | null): string {
  if (!str) return '';
  const [year, month, day] = str.split('-');
  if (!year || !month || !day) return str;
  return `${day}.${month}.${year}`;
}

function onConfirm(): void {
  const action = confirmAction;
  confirmAction = null;
  if (action) void action();
}

function resetFilters(): void {
  search.value = '';
  searchDebounced.value = '';
  statusFilter.value = '';
  roleFilter.value = '';
  sortField.value = 'last_name';
  sortOrder.value = 'asc';
  currentPage.value = 1;
}

function toggleSelected(id: string): void {
  const set = new Set(selected.value);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  selected.value = set;
}

async function bulk(action: BulkAction): Promise<void> {
  if (!anySelected.value) return;
  const ids = Array.from(selected.value);
  const messages: Record<BulkAction, { title: string; text: string }> = {
    block: {
      title: 'Блокировка пользователей',
      text: `Заблокировать выбранных пользователей (${ids.length})?`,
    },
    unblock: {
      title: 'Разблокировка пользователей',
      text: `Разблокировать выбранных пользователей (${ids.length})?`,
    },
  };
  confirmTitle.value = messages[action].title;
  confirmMessage.value = messages[action].text;
  confirmAction = async () => {
    const endpoints: Record<BulkAction, (id: string) => Promise<unknown>> = {
      block: (id: string) => apiFetch(`/users/${id}/block`, { method: 'POST' }),
      unblock: (id: string) =>
        apiFetch(`/users/${id}/unblock`, { method: 'POST' }),
    };
    const results = await Promise.allSettled(
      ids.map((id) => endpoints[action](id))
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const fail = ids.length - ok;
    showToast(
      `${messages[action].title}: выполнено ${ok}${fail ? `, ошибок ${fail}` : ''}`
    );
    await loadUsers();
    selected.value = new Set();
  };
  confirmRef.value?.open();
}
</script>

<template>
  <div class="py-3 admin-users-page">
    <div class="container">
      <Breadcrumbs :items="breadcrumbs" />
      <h1 class="mb-3">Пользователи</h1>
      <div class="card tile mb-3">
        <div class="card-body">
          <TabSelector
            :model-value="activeTab"
            :tabs="[
              { key: 'users', label: 'Пользователи' },
              { key: 'profiles', label: 'Заполнение профиля' },
            ]"
            @update:model-value="updateActiveTab"
          />
        </div>
      </div>

      <div
        v-if="activeTab === 'users'"
        class="card section-card tile fade-in shadow-sm"
      >
        <div
          class="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center"
        >
          <h2 class="h5 mb-0">Пользователи</h2>
          <div class="d-flex gap-2 align-items-center">
            <div
              class="btn-group d-none d-lg-inline-flex"
              role="group"
              aria-label="Групповые действия"
            >
              <button
                type="button"
                class="btn btn-outline-secondary"
                :disabled="!anySelected"
                v-bind="tooltipAttrs"
                title="Заблокировать выбранных"
                @click="bulk('block')"
              >
                <i class="bi bi-lock-fill"></i>
              </button>
              <button
                type="button"
                class="btn btn-outline-secondary"
                :disabled="!anySelected"
                v-bind="tooltipAttrs"
                title="Разблокировать выбранных"
                @click="bulk('unblock')"
              >
                <i class="bi bi-unlock-fill"></i>
              </button>
            </div>
            <button class="btn btn-brand" @click="openCreate">
              <i class="bi bi-plus-lg me-1"></i>Добавить
            </button>
          </div>
        </div>

        <div class="card-body">
          <div class="toolbar mb-3 d-flex align-items-center gap-2">
            <div
              class="input-group input-group-sm flex-grow-1"
              style="min-width: 16rem"
            >
              <span id="users-search-addon" class="input-group-text">
                <i class="bi bi-search" aria-hidden="true"></i>
              </span>
              <input
                ref="usersSearchInputRef"
                v-model="search"
                type="search"
                class="form-control"
                placeholder="Поиск по ФИО, телефону, email"
                aria-label="Поиск по ФИО, телефону, email"
                aria-describedby="users-search-addon"
                @blur="onUsersSearchBlur"
              />
              <button
                type="button"
                class="btn btn-outline-secondary d-inline-flex align-items-center"
                :title="
                  activeFiltersCount
                    ? `Активные фильтры: ${activeFiltersCount}`
                    : 'Фильтры'
                "
                @click="openFilters"
              >
                <i class="bi bi-funnel me-1" aria-hidden="true"></i>
                <span>Фильтры</span>
                <span v-if="activeFiltersCount" class="badge bg-secondary ms-2">
                  {{ activeFiltersCount }}
                </span>
              </button>
            </div>
          </div>

          <div v-if="error" class="alert alert-danger mb-3">{{ error }}</div>

          <div
            v-if="(users.length || isLoading) && isUsersDesktop"
            class="table-responsive"
          >
            <table
              class="table admin-table table-hover table-striped align-middle mb-0"
              aria-describedby="usersTableCaption"
            >
              <caption id="usersTableCaption" class="visually-hidden">
                Таблица пользователей с возможностью сортировки и фильтрации
              </caption>
              <thead>
                <tr>
                  <th scope="col" class="text-center" style="width: 2.5rem">
                    <input
                      ref="selectAllRef"
                      class="form-check-input brand-check"
                      type="checkbox"
                      :checked="allSelectedOnPage"
                      :aria-checked="
                        anySelected && !allSelectedOnPage
                          ? 'mixed'
                          : allSelectedOnPage
                            ? 'true'
                            : 'false'
                      "
                      aria-label="Выбрать все на странице"
                      @change="allSelectedOnPage = !allSelectedOnPage"
                    />
                  </th>
                  <th
                    scope="col"
                    class="sortable fio-col"
                    :aria-sort="
                      sortField === 'last_name'
                        ? sortOrder === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    "
                    role="button"
                    tabindex="0"
                    @click="toggleSort('last_name')"
                    @keydown.enter.prevent="toggleSort('last_name')"
                    @keydown.space.prevent="toggleSort('last_name')"
                  >
                    ФИО
                    <i
                      v-if="sortField === 'last_name'"
                      :class="[
                        sortOrder === 'asc'
                          ? 'bi bi-caret-up-fill'
                          : 'bi bi-caret-down-fill',
                        'icon-brand',
                      ]"
                    ></i>
                  </th>
                  <th
                    scope="col"
                    class="sortable phone-col d-none d-md-table-cell"
                    :aria-sort="
                      sortField === 'phone'
                        ? sortOrder === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    "
                    role="button"
                    tabindex="0"
                    @click="toggleSort('phone')"
                    @keydown.enter.prevent="toggleSort('phone')"
                    @keydown.space.prevent="toggleSort('phone')"
                  >
                    Телефон
                    <i
                      v-if="sortField === 'phone'"
                      :class="[
                        sortOrder === 'asc'
                          ? 'bi bi-caret-up-fill'
                          : 'bi bi-caret-down-fill',
                        'icon-brand',
                      ]"
                    ></i>
                  </th>
                  <th
                    scope="col"
                    class="sortable email-col d-none d-lg-table-cell"
                    :aria-sort="
                      sortField === 'email'
                        ? sortOrder === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    "
                    role="button"
                    tabindex="0"
                    @click="toggleSort('email')"
                    @keydown.enter.prevent="toggleSort('email')"
                    @keydown.space.prevent="toggleSort('email')"
                  >
                    Email
                    <i
                      v-if="sortField === 'email'"
                      :class="[
                        sortOrder === 'asc'
                          ? 'bi bi-caret-up-fill'
                          : 'bi bi-caret-down-fill',
                        'icon-brand',
                      ]"
                    ></i>
                  </th>
                  <th
                    scope="col"
                    class="sortable date-col d-none d-lg-table-cell"
                    :aria-sort="
                      sortField === 'birth_date'
                        ? sortOrder === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    "
                    role="button"
                    tabindex="0"
                    @click="toggleSort('birth_date')"
                    @keydown.enter.prevent="toggleSort('birth_date')"
                    @keydown.space.prevent="toggleSort('birth_date')"
                  >
                    Дата рождения
                    <i
                      v-if="sortField === 'birth_date'"
                      :class="[
                        sortOrder === 'asc'
                          ? 'bi bi-caret-up-fill'
                          : 'bi bi-caret-down-fill',
                        'icon-brand',
                      ]"
                    ></i>
                  </th>
                  <th
                    scope="col"
                    class="sortable status-col"
                    :aria-sort="
                      sortField === 'status'
                        ? sortOrder === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    "
                    role="button"
                    tabindex="0"
                    @click="toggleSort('status')"
                    @keydown.enter.prevent="toggleSort('status')"
                    @keydown.space.prevent="toggleSort('status')"
                  >
                    Статус
                    <i
                      v-if="sortField === 'status'"
                      :class="[
                        sortOrder === 'asc'
                          ? 'bi bi-caret-up-fill'
                          : 'bi bi-caret-down-fill',
                        'icon-brand',
                      ]"
                    ></i>
                  </th>
                  <th class="actions-col"></th>
                </tr>
              </thead>
              <tbody v-if="!isLoading">
                <tr v-for="u in users" :key="u.id" @dblclick="openEdit(u)">
                  <td class="text-center">
                    <input
                      class="form-check-input brand-check"
                      type="checkbox"
                      :checked="selected.has(u.id)"
                      :aria-label="`Выбрать ${u.last_name} ${u.first_name}`"
                      @change="toggleSelected(u.id)"
                    />
                  </td>
                  <td class="text-nowrap">
                    <span class="cell-text">
                      {{ u.last_name }} {{ u.first_name }} {{ u.patronymic }}
                    </span>
                  </td>
                  <td class="d-none d-md-table-cell text-nowrap">
                    {{ formatPhone(u.phone) }}
                  </td>
                  <td class="d-none d-lg-table-cell text-nowrap">
                    {{ u.email }}
                  </td>
                  <td class="d-none d-lg-table-cell text-nowrap">
                    {{ formatDate(u.birth_date) }}
                  </td>
                  <td>
                    <span class="badge" :class="statusClass(u.status)">
                      {{ u.status_name }}
                    </span>
                  </td>
                  <td class="text-end">
                    <button
                      class="btn btn-sm btn-secondary me-2"
                      aria-label="Редактировать пользователя"
                      v-bind="tooltipAttrs"
                      title="Редактировать"
                      @click="openEdit(u)"
                    >
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button
                      v-if="u.status === 'ACTIVE'"
                      class="btn btn-sm btn-danger me-2"
                      aria-label="Заблокировать пользователя"
                      v-bind="tooltipAttrs"
                      title="Заблокировать"
                      @click="blockUser(u.id)"
                    >
                      <i class="bi bi-lock-fill"></i>
                    </button>
                    <button
                      v-if="u.status === 'INACTIVE'"
                      class="btn btn-sm btn-success me-2"
                      aria-label="Разблокировать пользователя"
                      v-bind="tooltipAttrs"
                      title="Разблокировать"
                      @click="unblockUser(u.id)"
                    >
                      <i class="bi bi-unlock-fill"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
              <tbody v-else>
                <tr v-for="i in pageSize" :key="`skel-${i}`" aria-hidden="true">
                  <td></td>
                  <td><div class="skeleton-line w-75"></div></td>
                  <td class="d-none d-md-table-cell">
                    <div class="skeleton-line w-50"></div>
                  </td>
                  <td class="d-none d-lg-table-cell">
                    <div class="skeleton-line w-50"></div>
                  </td>
                  <td><div class="skeleton-badge w-50"></div></td>
                  <td class="text-end">
                    <div class="d-inline-flex gap-2">
                      <span class="skeleton-icon"></span>
                      <span class="skeleton-icon"></span>
                      <span class="skeleton-icon"></span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="users.length && !isLoading && !isUsersDesktop">
            <div v-for="u in users" :key="`m-${u.id}`" class="card mb-2">
              <div class="card-body p-2">
                <div
                  class="d-flex justify-content-between align-items-start mb-1"
                >
                  <h3 class="h6 mb-0 text-truncate" style="max-width: 75%">
                    {{ u.last_name }} {{ u.first_name }} {{ u.patronymic }}
                  </h3>
                  <span class="badge" :class="statusClass(u.status)">
                    {{ u.status_name }}
                  </span>
                </div>
                <div
                  class="small text-muted mb-1 user-contacts"
                  aria-label="Контактные данные"
                >
                  <span v-if="u.phone">{{ formatPhone(u.phone) }}</span>
                  <span v-if="u.email">{{ u.email }}</span>
                  <span v-if="u.birth_date">{{
                    formatDate(u.birth_date)
                  }}</span>
                </div>
                <div class="d-flex justify-content-end gap-2">
                  <button
                    class="btn btn-sm btn-secondary"
                    aria-label="Редактировать пользователя"
                    @click="openEdit(u)"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button
                    v-if="u.status === 'ACTIVE'"
                    class="btn btn-sm btn-danger"
                    aria-label="Заблокировать пользователя"
                    @click="blockUser(u.id)"
                  >
                    <i class="bi bi-lock-fill"></i>
                  </button>
                  <button
                    v-if="u.status === 'INACTIVE'"
                    class="btn btn-sm btn-success"
                    aria-label="Разблокировать пользователя"
                    @click="unblockUser(u.id)"
                  >
                    <i class="bi bi-unlock-fill"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="!users.length && !isLoading" class="text-muted mb-0">
            <p class="mb-2">
              {{
                search || statusFilter || roleFilter
                  ? 'Ничего не найдено по заданным фильтрам.'
                  : 'Нет пользователей.'
              }}
            </p>
            <button
              v-if="search || statusFilter || roleFilter"
              class="btn btn-outline-secondary btn-sm"
              type="button"
              @click="resetFilters"
            >
              Сбросить фильтры
            </button>
          </div>
        </div>
      </div>

      <PageNav
        v-if="activeTab === 'users' && totalPages > 1"
        v-model:page="currentPage"
        v-model:page-size="pageSize"
        :total-pages="totalPages"
        :sizes="[...PAGE_SIZE_OPTIONS]"
      />

      <div
        v-if="activeTab === 'profiles'"
        class="card section-card tile fade-in shadow-sm mt-3"
      >
        <div class="card-header">
          <h2 class="h5 mb-0">Заполнение профиля</h2>
        </div>
        <div class="card-body p-3">
          <div class="toolbar mb-3 d-flex flex-wrap align-items-center gap-2">
            <div
              class="input-group input-group-sm"
              style="min-width: 16rem; max-width: 24rem"
            >
              <span class="input-group-text">
                <i class="bi bi-search" aria-hidden="true"></i>
              </span>
              <input
                ref="completionSearchInputRef"
                v-model="completionSearch"
                type="search"
                class="form-control"
                placeholder="Поиск по ФИО, телефону, email"
                aria-label="Поиск по заполненности профиля"
                @blur="onCompletionSearchBlur"
              />
            </div>
            <select
              v-model="completionStatusFilter"
              class="form-select form-select-sm"
              style="max-width: 13rem"
              aria-label="Статус заполненности"
            >
              <option value="">Все профили</option>
              <option value="complete">Только заполненные</option>
              <option value="incomplete">Только незаполненные</option>
            </select>
            <select
              v-model="completionHasSnilsFilter"
              class="form-select form-select-sm"
              style="max-width: 12rem"
              aria-label="Наличие СНИЛС"
            >
              <option value="">Любой СНИЛС</option>
              <option value="true">СНИЛС есть</option>
              <option value="false">СНИЛС отсутствует</option>
            </select>
            <button
              v-if="completionFiltersCount"
              type="button"
              class="btn btn-sm btn-outline-secondary"
              @click="resetCompletionFilters"
            >
              Сбросить
            </button>
          </div>

          <div v-if="completionError" class="alert alert-danger mb-3">
            {{ completionError }}
          </div>
          <div v-if="completionLoading" class="text-center my-3">
            <div
              class="spinner-border spinner-brand"
              role="status"
              aria-label="Загрузка"
            ></div>
          </div>

          <div
            v-if="completion.length && !completionLoading && isProfileDesktop"
            class="table-responsive"
          >
            <table
              class="table admin-table table-hover table-striped align-middle mb-0"
            >
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th>Дата рождения</th>
                  <th class="text-center">Паспорт</th>
                  <th class="text-center">ИНН</th>
                  <th class="text-center">СНИЛС</th>
                  <th class="text-center">Банк</th>
                  <th class="text-center">Адрес</th>
                  <th>Налоговый статус</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in completion" :key="p.id">
                  <td>
                    {{ p.last_name }} {{ p.first_name }} {{ p.patronymic }}
                  </td>
                  <td>{{ formatDate(p.birth_date) }}</td>
                  <td class="text-center">
                    <i
                      :class="
                        p.passport
                          ? 'bi bi-check-lg text-success'
                          : 'bi bi-x-lg text-danger'
                      "
                    ></i>
                  </td>
                  <td class="text-center">
                    <i
                      :class="
                        p.inn
                          ? 'bi bi-check-lg text-success'
                          : 'bi bi-x-lg text-danger'
                      "
                    ></i>
                  </td>
                  <td class="text-center">
                    <i
                      :class="
                        p.snils
                          ? 'bi bi-check-lg text-success'
                          : 'bi bi-x-lg text-danger'
                      "
                    ></i>
                  </td>
                  <td class="text-center">
                    <i
                      :class="
                        p.bank_account
                          ? 'bi bi-check-lg text-success'
                          : 'bi bi-x-lg text-danger'
                      "
                    ></i>
                  </td>
                  <td class="text-center">
                    <i
                      :class="
                        p.addresses
                          ? 'bi bi-check-lg text-success'
                          : 'bi bi-x-lg text-danger'
                      "
                    ></i>
                  </td>
                  <td>
                    <span v-if="p.taxation_type">{{ p.taxation_type }}</span>
                    <button
                      v-else-if="p.inn"
                      class="btn btn-link p-0"
                      @click="openTaxStatus(p.id)"
                    >
                      <i class="bi bi-arrow-clockwise"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            v-if="completion.length && !completionLoading && !isProfileDesktop"
          >
            <div
              v-for="p in completion"
              :key="p.id"
              class="card profile-card mb-2"
            >
              <div class="card-body p-2">
                <h6 class="mb-1">
                  {{ p.last_name }} {{ p.first_name }} {{ p.patronymic }}
                </h6>
                <p class="mb-1 small">{{ formatDate(p.birth_date) }}</p>
                <div class="d-flex flex-wrap gap-1">
                  <span>
                    <i
                      :class="
                        p.passport
                          ? 'bi bi-check-lg text-success'
                          : 'bi bi-x-lg text-danger'
                      "
                    ></i>
                    Паспорт
                  </span>
                  <span>
                    <i
                      :class="
                        p.inn
                          ? 'bi bi-check-lg text-success'
                          : 'bi bi-x-lg text-danger'
                      "
                    ></i>
                    ИНН
                  </span>
                  <span>
                    <i
                      :class="
                        p.snils
                          ? 'bi bi-check-lg text-success'
                          : 'bi bi-x-lg text-danger'
                      "
                    ></i>
                    СНИЛС
                  </span>
                  <span>
                    <i
                      :class="
                        p.bank_account
                          ? 'bi bi-check-lg text-success'
                          : 'bi bi-x-lg text-danger'
                      "
                    ></i>
                    Банк
                  </span>
                  <span>
                    <i
                      :class="
                        p.addresses
                          ? 'bi bi-check-lg text-success'
                          : 'bi bi-x-lg text-danger'
                      "
                    ></i>
                    Адрес
                  </span>
                  <span>
                    <span v-if="p.taxation_type">{{ p.taxation_type }}</span>
                    <button
                      v-else-if="p.inn"
                      class="btn btn-link p-0 align-baseline"
                      aria-label="Обновить налоговый статус"
                      @click="openTaxStatus(p.id)"
                    >
                      <i class="bi bi-arrow-clockwise"></i>
                    </button>
                    <span v-else>—</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p
            v-if="!completion.length && !completionLoading"
            class="text-muted mb-0"
          >
            Нет данных.
          </p>
        </div>
      </div>

      <PageNav
        v-if="activeTab === 'profiles' && completionTotalPages > 1"
        v-model:page="completionPage"
        v-model:page-size="completionPageSize"
        :total-pages="completionTotalPages"
        :sizes="[...PAGE_SIZE_OPTIONS]"
      />
    </div>
  </div>

  <TaxationInfo
    ref="taxModal"
    :user-id="taxUserId"
    modal-only
    @saved="onTaxSaved"
  />

  <ConfirmModal
    ref="confirmRef"
    :title="confirmTitle"
    confirm-text="Подтвердить"
    confirm-variant="brand"
    @confirm="onConfirm"
  >
    <p class="mb-0">{{ confirmMessage }}</p>
  </ConfirmModal>

  <UsersFilterModal
    v-model="filtersOpen"
    :status="statusFilter"
    :role="roleFilter"
    :roles="roles"
    @apply="onFiltersApply"
    @reset="onFiltersReset"
  />
</template>

<style scoped>
.sortable {
  cursor: pointer;
}
.sortable:hover {
  color: var(--brand-color);
}
.sortable i {
  margin-left: 4px;
}
.profile-card {
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
}
.fio-col {
  min-width: 16rem;
}
.phone-col {
  width: 11rem;
}
.email-col {
  min-width: 16rem;
}
.date-col {
  width: 9rem;
}
.status-col {
  width: 10rem;
}
.actions-col {
  width: 10rem;
}
td .cell-text {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-contacts > span + span::before {
  content: '•';
  margin: 0 0.35rem;
}
</style>
