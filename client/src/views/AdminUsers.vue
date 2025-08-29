<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import PageNav from '../components/PageNav.vue';
import { loadPageSize, savePageSize } from '../utils/pageSize.js';
import { apiFetch } from '../api.js';
import Toast from 'bootstrap/js/dist/toast';
import TaxationInfo from '../components/TaxationInfo.vue';
import ConfirmModal from '../components/ConfirmModal.vue';
import UsersFilterModal from '../components/UsersFilterModal.vue';
import Tooltip from 'bootstrap/js/dist/tooltip';
import TabSelector from '../components/TabSelector.vue';

const users = ref([]);
const total = ref(0);
const error = ref('');
const router = useRouter();

const activeTab = ref('users');
const completion = ref([]);
const completionLoading = ref(false);
const completionError = ref('');

const isLoading = ref(false);
const search = ref('');
const statusFilter = ref('');
const roleFilter = ref('');
const currentPage = ref(1);
const pageSize = ref(loadPageSize('adminUsersPageSize', 8));
const roles = ref([]);
const sortField = ref('last_name');
const sortOrder = ref('asc');
const selected = ref(new Set());

const toastRef = ref(null);
const toastMessage = ref('');
let toast;

const taxModal = ref(null);
const taxUserId = ref('');

// Confirm modal state
const confirmRef = ref(null);
const confirmTitle = ref('Подтверждение');
const confirmMessage = ref('');
let confirmAction = null;

// Filters modal state
const filtersOpen = ref(false);

// Count only actual filters (exclude search, which is a separate control)
const activeFiltersCount = computed(() => {
  let c = 0;
  if (statusFilter.value) c++;
  if (roleFilter.value) c++;
  return c;
});

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value))
);

const anySelected = computed(() => selected.value.size > 0);
const allSelectedOnPage = computed({
  get() {
    return users.value.length > 0 && selected.value.size === users.value.length;
  },
  set(val) {
    selected.value = new Set(val ? users.value.map((u) => u.id) : []);
  },
});

// Pagination visible pages handled by Pagination.vue

async function loadRoles() {
  try {
    const data = await apiFetch('/roles');
    roles.value = data.roles;
  } catch (_e) {
    roles.value = [];
  }
}

let searchTimeout;
watch(search, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentPage.value = 1;
    loadUsers();
    syncQuery();
  }, 300);
});

watch([sortField, sortOrder, statusFilter, roleFilter, pageSize], () => {
  currentPage.value = 1;
  loadUsers();
  syncQuery();
});

watch(pageSize, (val) => {
  savePageSize('adminUsersPageSize', val);
});

watch(currentPage, () => {
  loadUsers();
  syncQuery();
});

watch(activeTab, (tab) => {
  if (
    tab === 'profiles' &&
    completion.value.length === 0 &&
    !completionLoading.value
  ) {
    loadCompletion();
  }
  syncQuery();
});

async function loadUsers() {
  try {
    const params = new URLSearchParams({
      search: search.value,
      status: statusFilter.value,
      role: roleFilter.value,
      page: currentPage.value,
      limit: pageSize.value,
      sort: sortField.value,
      order: sortOrder.value,
    });
    isLoading.value = true;
    const data = await apiFetch(`/users?${params}`);
    users.value = data.users;
    total.value = data.total;
  } catch (e) {
    error.value = e.message;
  } finally {
    isLoading.value = false;
  }
  await nextTick();
  applyTooltips();
}

async function loadCompletion() {
  try {
    completionLoading.value = true;
    const data = await apiFetch('/users/profile-completion');
    completion.value = data.profiles;
  } catch (e) {
    completionError.value = e.message;
  } finally {
    completionLoading.value = false;
  }
}

onMounted(() => {
  // Initialize from URL query for shareable state
  try {
    const q = router.currentRoute.value.query;
    if (q.tab && (q.tab === 'users' || q.tab === 'profiles'))
      activeTab.value = q.tab;
    if (q.search) search.value = String(q.search);
    if (q.status) statusFilter.value = String(q.status);
    if (q.role) roleFilter.value = String(q.role);
    if (q.page) currentPage.value = Number(q.page) || 1;
    if (q.limit) pageSize.value = Number(q.limit) || pageSize.value;
    if (q.sort) sortField.value = String(q.sort);
    if (q.order) sortOrder.value = String(q.order) === 'desc' ? 'desc' : 'asc';
  } catch (_) {}

  loadUsers();
  loadRoles();
  if (activeTab.value === 'profiles') loadCompletion();
  applyTooltips();
});

// Keep URL query in sync without spamming history
function syncQuery() {
  router.replace({
    query: {
      tab: activeTab.value,
      search: search.value || undefined,
      status: statusFilter.value || undefined,
      role: roleFilter.value || undefined,
      page: currentPage.value !== 1 ? String(currentPage.value) : undefined,
      limit: pageSize.value !== 8 ? String(pageSize.value) : undefined,
      sort: sortField.value !== 'last_name' ? sortField.value : undefined,
      order: sortOrder.value !== 'asc' ? sortOrder.value : undefined,
    },
  });
}

function applyTooltips() {
  nextTick(() => {
    document
      .querySelectorAll('[data-bs-toggle="tooltip"]')
      .forEach((el) => new Tooltip(el));
  });
}

function openFilters() {
  filtersOpen.value = true;
}
function onFiltersApply({ status: st, role: rl }) {
  filtersOpen.value = false;
  statusFilter.value = st;
  roleFilter.value = rl;
  currentPage.value = 1;
  loadUsers();
  syncQuery();
}
function onFiltersReset() {
  filtersOpen.value = false;
  resetFilters();
}

function openCreate() {
  router.push('/admin/users/new');
}

function openEdit(user) {
  router.push(`/admin/users/${user.id}`);
}

function openTaxStatus(id) {
  taxUserId.value = id;
  nextTick(() => {
    taxModal.value.openModal();
  });
}

async function onTaxSaved() {
  await loadCompletion();
}

async function blockUser(id) {
  confirmTitle.value = 'Блокировка пользователя';
  confirmMessage.value = 'Вы уверены, что хотите заблокировать пользователя?';
  confirmAction = async () => {
    try {
      await apiFetch(`/users/${id}/block`, { method: 'POST' });
      showToast('Пользователь заблокирован');
      await loadUsers();
    } catch (e) {
      showToast(e.message || 'Ошибка при блокировке');
    }
  };
  confirmRef.value?.open();
}

async function unblockUser(id) {
  confirmTitle.value = 'Разблокировка пользователя';
  confirmMessage.value = 'Подтвердите разблокировку пользователя.';
  confirmAction = async () => {
    try {
      await apiFetch(`/users/${id}/unblock`, { method: 'POST' });
      showToast('Пользователь разблокирован');
      await loadUsers();
    } catch (e) {
      showToast(e.message || 'Ошибка при разблокировке');
    }
  };
  confirmRef.value?.open();
}

async function approveUser(id) {
  confirmTitle.value = 'Подтверждение аккаунта';
  confirmMessage.value = 'Подтвердить пользователя и активировать аккаунт?';
  confirmAction = async () => {
    try {
      await apiFetch(`/users/${id}/approve`, { method: 'POST' });
      showToast('Пользователь подтвержден');
      await loadUsers();
    } catch (e) {
      showToast(e.message || 'Ошибка при подтверждении');
    }
  };
  confirmRef.value?.open();
}

function statusClass(status) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-success';
    case 'INACTIVE':
      return 'bg-danger';
    case 'AWAITING_CONFIRMATION':
      return 'bg-warning text-dark';
    default:
      return 'bg-secondary';
  }
}

function toggleSort(field) {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortOrder.value = 'asc';
  }
}

function formatPhone(digits) {
  if (!digits) return '';
  let out = '+7';
  if (digits.length > 1) out += ' (' + digits.slice(1, 4);
  if (digits.length >= 4) out += ') ';
  if (digits.length >= 4) out += digits.slice(4, 7);
  if (digits.length >= 7) out += '-' + digits.slice(7, 9);
  if (digits.length >= 9) out += '-' + digits.slice(9, 11);
  return out;
}

function formatDate(str) {
  if (!str) return '';
  const [year, month, day] = str.split('-');
  return `${day}.${month}.${year}`;
}

function showToast(message) {
  toastMessage.value = message;
  if (!toast) {
    toast = new Toast(toastRef.value);
  }
  toast.show();
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Скопировано');
  } catch (_err) {
    showToast('Не удалось скопировать');
  }
}

function onConfirm() {
  if (typeof confirmAction === 'function') confirmAction();
}

function clearSearch() {
  if (search.value) {
    search.value = '';
    currentPage.value = 1;
    loadUsers();
    syncQuery();
  }
}

function resetFilters() {
  search.value = '';
  statusFilter.value = '';
  roleFilter.value = '';
  sortField.value = 'last_name';
  sortOrder.value = 'asc';
  currentPage.value = 1;
  loadUsers();
  syncQuery();
}

function toggleSelected(id) {
  const set = new Set(selected.value);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  selected.value = set;
}

watch(users, () => {
  // Clear selection when page results change
  selected.value = new Set();
});

async function bulk(action) {
  if (!anySelected.value) return;
  const ids = Array.from(selected.value);
  const messages = {
    block: {
      title: 'Блокировка пользователей',
      text: `Заблокировать выбранных пользователей (${ids.length})?`,
    },
    unblock: {
      title: 'Разблокировка пользователей',
      text: `Разблокировать выбранных пользователей (${ids.length})?`,
    },
    approve: {
      title: 'Подтверждение пользователей',
      text: `Подтвердить выбранных пользователей (${ids.length})?`,
    },
  };
  confirmTitle.value = messages[action].title;
  confirmMessage.value = messages[action].text;
  confirmAction = async () => {
    const endpoints = {
      block: (id) => apiFetch(`/users/${id}/block`, { method: 'POST' }),
      unblock: (id) => apiFetch(`/users/${id}/unblock`, { method: 'POST' }),
      approve: (id) => apiFetch(`/users/${id}/approve`, { method: 'POST' }),
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
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">
            Пользователи
          </li>
        </ol>
      </nav>
      <h1 class="mb-3">Пользователи</h1>
      <div class="card tile mb-3">
        <div class="card-body">
          <TabSelector
            v-model="activeTab"
            :tabs="[
              { key: 'users', label: 'Пользователи' },
              { key: 'profiles', label: 'Заполнение профиля' },
            ]"
          />
        </div>
      </div>
      <div
        v-show="activeTab === 'users'"
        class="card section-card tile fade-in shadow-sm"
      >
        <div
          class="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center"
        >
          <h2 class="h5 mb-0">Пользователи</h2>
          <div class="d-flex gap-2 align-items-center">
            <div class="btn-group" role="group" aria-label="Групповые действия">
              <button
                type="button"
                class="btn btn-outline-secondary"
                :disabled="!anySelected"
                data-bs-toggle="tooltip"
                data-bs-placement="bottom"
                title="Заблокировать выбранных"
                @click="bulk('block')"
              >
                <i class="bi bi-lock-fill"></i>
              </button>
              <button
                type="button"
                class="btn btn-outline-secondary"
                :disabled="!anySelected"
                data-bs-toggle="tooltip"
                data-bs-placement="bottom"
                title="Разблокировать выбранных"
                @click="bulk('unblock')"
              >
                <i class="bi bi-unlock-fill"></i>
              </button>
              <button
                type="button"
                class="btn btn-outline-secondary"
                :disabled="!anySelected"
                data-bs-toggle="tooltip"
                data-bs-placement="bottom"
                title="Подтвердить выбранных"
                @click="bulk('approve')"
              >
                <i class="bi bi-check-lg"></i>
              </button>
            </div>
            <button class="btn btn-brand" @click="openCreate">
              <i class="bi bi-plus-lg me-1"></i>Добавить
            </button>
          </div>
        </div>
        <div class="card-body">
          <!-- Toolbar: search + filters -->
          <div class="toolbar mb-3 d-flex align-items-center gap-2">
            <div
              class="input-group input-group-sm flex-grow-1"
              style="min-width: 16rem"
            >
              <span id="users-search-addon" class="input-group-text">
                <i class="bi bi-search" aria-hidden="true"></i>
              </span>
              <input
                v-model.trim="search"
                type="search"
                class="form-control"
                placeholder="Поиск по ФИО, телефону, email"
                aria-label="Поиск по ФИО, телефону, email"
                aria-describedby="users-search-addon"
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
                <span
                  v-if="activeFiltersCount"
                  class="badge bg-secondary ms-2"
                  >{{ activeFiltersCount }}</span
                >
              </button>
            </div>
          </div>

          <div v-if="error" class="alert alert-danger mb-3">{{ error }}</div>
          <div
            v-if="users.length || isLoading"
            class="table-responsive d-none d-lg-block"
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
                    <span class="cell-text"
                      >{{ u.last_name }} {{ u.first_name }}
                      {{ u.patronymic }}</span
                    >
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
                    <span class="badge" :class="statusClass(u.status)">{{
                      u.status_name
                    }}</span>
                  </td>
                  <td class="text-end">
                    <button
                      class="btn btn-sm btn-secondary me-2"
                      aria-label="Редактировать пользователя"
                      data-bs-toggle="tooltip"
                      title="Редактировать"
                      @click="openEdit(u)"
                    >
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button
                      v-if="u.status === 'ACTIVE'"
                      class="btn btn-sm btn-danger me-2"
                      aria-label="Заблокировать пользователя"
                      data-bs-toggle="tooltip"
                      title="Заблокировать"
                      @click="blockUser(u.id)"
                    >
                      <i class="bi bi-lock-fill"></i>
                    </button>
                    <button
                      v-if="u.status === 'INACTIVE'"
                      class="btn btn-sm btn-success me-2"
                      aria-label="Разблокировать пользователя"
                      data-bs-toggle="tooltip"
                      title="Разблокировать"
                      @click="unblockUser(u.id)"
                    >
                      <i class="bi bi-unlock-fill"></i>
                    </button>
                    <button
                      v-if="u.status === 'AWAITING_CONFIRMATION'"
                      class="btn btn-sm btn-success"
                      aria-label="Подтвердить пользователя"
                      data-bs-toggle="tooltip"
                      title="Подтвердить"
                      @click="approveUser(u.id)"
                    >
                      <i class="bi bi-check-lg"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
              <!-- Skeleton rows -->
              <tbody v-else>
                <tr v-for="i in pageSize" :key="'skel-' + i" aria-hidden="true">
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
          <!-- Mobile list rendering -->
          <div v-if="users.length && !isLoading" class="d-block d-lg-none">
            <div v-for="u in users" :key="'m-' + u.id" class="card mb-2">
              <div class="card-body p-2">
                <div
                  class="d-flex justify-content-between align-items-start mb-1"
                >
                  <h3 class="h6 mb-0 text-truncate" style="max-width: 75%">
                    {{ u.last_name }} {{ u.first_name }} {{ u.patronymic }}
                  </h3>
                  <span class="badge" :class="statusClass(u.status)">{{
                    u.status_name
                  }}</span>
                </div>
                <div class="small text-muted mb-1">
                  <span v-if="u.phone" class="me-2">{{
                    formatPhone(u.phone)
                  }}</span>
                  <span v-if="u.email" class="me-2">{{ u.email }}</span>
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
                  <button
                    v-if="u.status === 'AWAITING_CONFIRMATION'"
                    class="btn btn-sm btn-success"
                    aria-label="Подтвердить пользователя"
                    @click="approveUser(u.id)"
                  >
                    <i class="bi bi-check-lg"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-muted mb-0">
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
      />
      <div class="toast-container position-fixed bottom-0 end-0 p-3">
        <div
          ref="toastRef"
          class="toast text-bg-secondary"
          role="status"
          data-bs-delay="1500"
          data-bs-autohide="true"
        >
          <div class="toast-body">{{ toastMessage }}</div>
        </div>
      </div>
      <div
        v-show="activeTab === 'profiles'"
        class="card section-card tile fade-in shadow-sm mt-3"
      >
        <div class="card-header">
          <h2 class="h5 mb-0">Заполнение профиля</h2>
        </div>
        <div class="card-body p-3">
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
            v-if="completion.length"
            class="table-responsive d-none d-sm-block"
          >
            <table
              class="table admin-table table-hover table-striped align-middle mb-0"
            >
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th class="d-none d-sm-table-cell">Дата рождения</th>
                  <th class="text-center">Паспорт</th>
                  <th class="text-center">ИНН</th>
                  <th class="text-center">СНИЛС</th>
                  <th class="text-center">Банк</th>
                  <th class="text-center">Адрес</th>
                  <th class="d-none d-md-table-cell">Налоговый статус</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in completion" :key="p.id">
                  <td>
                    {{ p.last_name }} {{ p.first_name }} {{ p.patronymic }}
                  </td>
                  <td class="d-none d-sm-table-cell">
                    {{ formatDate(p.birth_date) }}
                  </td>
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
                  <td class="d-none d-md-table-cell">
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
          <div v-if="completion.length" class="d-block d-sm-none">
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
                  <span
                    ><i
                      :class="
                        p.passport
                          ? 'bi bi-check-lg text-success'
                          : 'bi bi-x-lg text-danger'
                      "
                    ></i>
                    Паспорт</span
                  >
                  <span
                    ><i
                      :class="
                        p.inn
                          ? 'bi bi-check-lg text-success'
                          : 'bi bi-x-lg text-danger'
                      "
                    ></i>
                    ИНН</span
                  >
                  <span
                    ><i
                      :class="
                        p.snils
                          ? 'bi bi-check-lg text-success'
                          : 'bi bi-x-lg text-danger'
                      "
                    ></i>
                    СНИЛС</span
                  >
                  <span
                    ><i
                      :class="
                        p.bank_account
                          ? 'bi bi-check-lg text-success'
                          : 'bi bi-x-lg text-danger'
                      "
                    ></i>
                    Банк</span
                  >
                  <span
                    ><i
                      :class="
                        p.addresses
                          ? 'bi bi-check-lg text-success'
                          : 'bi bi-x-lg text-danger'
                      "
                    ></i>
                    Адрес</span
                  >
                  <span>
                    <i class="bi"></i>
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
          <p v-else-if="!completionLoading" class="text-muted mb-0">
            Нет данных.
          </p>
        </div>
      </div>
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
/* Uses global .section-card and .tab-selector from brand.css */
.profile-card {
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
}

@media (max-width: 575.98px) {
  .admin-users-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
  }

  .section-card {
    margin-left: -1rem;
    margin-right: -1rem;
  }
}

/* Column widths for better scanability */
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

/* Prevent wrapping and enable ellipsis for long names */
td .cell-text {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Skeleton styles */
.skeleton-line {
  height: 0.875rem;
  background: linear-gradient(90deg, #f1f3f5 25%, #eceff3 37%, #f1f3f5 63%);
  background-size: 400% 100%;
  border-radius: 4px;
  animation: skeleton-loading 1.2s ease-in-out infinite;
}
.skeleton-badge {
  height: 1.25rem;
  width: 4.5rem;
  background: linear-gradient(90deg, #f1f3f5 25%, #eceff3 37%, #f1f3f5 63%);
  background-size: 400% 100%;
  border-radius: var(--radius-pill);
  animation: skeleton-loading 1.2s ease-in-out infinite;
}
.skeleton-icon {
  display: inline-block;
  width: 1.75rem;
  height: 1.5rem;
  background: linear-gradient(90deg, #f1f3f5 25%, #eceff3 37%, #f1f3f5 63%);
  background-size: 400% 100%;
  border-radius: var(--radius-xs);
  animation: skeleton-loading 1.2s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .skeleton-line,
  .skeleton-badge,
  .skeleton-icon {
    animation: none;
  }
}
@keyframes skeleton-loading {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0 0;
  }
}
</style>
