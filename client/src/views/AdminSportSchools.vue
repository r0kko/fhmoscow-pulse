<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, watch } from 'vue';
import { RouterLink } from 'vue-router';
import Toast from 'bootstrap/js/dist/toast';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';
import PageNav from '../components/PageNav.vue';
import { loadPageSize, savePageSize } from '../utils/pageSize.js';

// Tabs: overview (club/team table) and staff (user-centric)
const activeTab = ref('overview'); // 'overview' | 'staff'

// Overview tab state
const search = ref(''); // search by club/team name
const loading = ref(false);
const assignments = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(loadPageSize('adminSportSchoolsPageSize', 10));
const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value))
);
const overviewFilters = reactive({ year: '', hasStaff: '', staffSearch: '' });

// Right pane: club staff and team management
const clubStaff = ref([]);
const clubLoading = ref(false);

// Toast and modals
const toastRef = ref(null);
let toast;
const toastMessage = ref('');

// Attach staff to club modal
const clubStaffModalRef = ref(null);
let clubStaffModal;
const attachClubStaff = reactive({
  loading: false,
  q: '',
  options: [],
  selected: '',
});

// Team staff management modal
const teamModalRef = ref(null);
let teamModal;
const teamManage = reactive({
  team: null,
  loading: false,
  staff: [],
  attach: { loading: false, q: '', options: [], selected: '' },
});

// Confirm detach modal
const detachModalRef = ref(null);
let detachModal;
const confirmDetach = reactive({ scope: '', id: '', name: '', loading: false });

onMounted(() => {
  if (!toast && toastRef.value) toast = new Toast(toastRef.value);
  fetchAssignments();
  if (clubStaffModalRef.value)
    clubStaffModal = new Modal(clubStaffModalRef.value);
  if (teamModalRef.value) teamModal = new Modal(teamModalRef.value);
  if (detachModalRef.value) detachModal = new Modal(detachModalRef.value);
});

onUnmounted(() => {
  try {
    clubStaffModal?.dispose?.();
    teamModal?.dispose?.();
    detachModal?.dispose?.();
  } catch (_) {}
});

let searchTimeout;
watch(search, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const term = search.value.trim();
    currentPage.value = 1;
    if (term.length === 0 || term.length >= 2) fetchAssignments();
  }, 300);
});
watch(
  () => ({ ...overviewFilters }),
  () => {
    currentPage.value = 1;
    fetchAssignments();
  },
  { deep: true }
);
watch(pageSize, (val) => {
  savePageSize('adminSportSchoolsPageSize', val);
  currentPage.value = 1;
  fetchAssignments();
});
watch(currentPage, () => {
  fetchAssignments();
});

watch(activeTab, (tab) => {
  if (tab === 'staff' && staffList.value.length === 0 && !staffLoading.value) {
    fetchStaff();
  }
});

async function fetchAssignments() {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      page: String(currentPage.value),
      limit: String(pageSize.value),
    });
    const term = search.value.trim();
    if (term) params.set('search', term);
    if (overviewFilters.year)
      params.set('birth_year', String(overviewFilters.year));
    if (overviewFilters.hasStaff !== '')
      params.set('has_staff', String(overviewFilters.hasStaff));
    if (overviewFilters.staffSearch)
      params.set('staff', overviewFilters.staffSearch.trim());
    const data = await apiFetch(`/sport-schools/assignments?${params}`);
    assignments.value = data.items || [];
    total.value = Number(data.total || 0);
    const pages = Math.max(1, Math.ceil(total.value / pageSize.value));
    if (currentPage.value > pages) currentPage.value = pages;
  } finally {
    loading.value = false;
  }
}

// Club/Team manage flows (open modals)
const selectedClub = ref(null);

async function refreshClubStaff() {
  if (!selectedClub.value) return;
  clubLoading.value = true;
  try {
    const data = await apiFetch(`/clubs/${selectedClub.value.id}/staff`);
    clubStaff.value = data.users || [];
  } finally {
    clubLoading.value = false;
  }
}

// Attach staff to club
async function openAttachClubStaff() {
  attachClubStaff.loading = true;
  attachClubStaff.selected = '';
  try {
    const q = attachClubStaff.q
      ? `&search=${encodeURIComponent(attachClubStaff.q)}`
      : '';
    const data = await apiFetch(`/users?role=SPORT_SCHOOL_STAFF&limit=50${q}`);
    attachClubStaff.options = (data.users || []).map((u) => ({
      id: u.id,
      label: `${u.last_name} ${u.first_name} ${u.patronymic || ''}`.trim(),
    }));
  } finally {
    attachClubStaff.loading = false;
  }
  clubStaffModal?.show?.();
}
async function confirmAttachClubStaff() {
  if (!attachClubStaff.selected || !selectedClub.value) return;
  attachClubStaff.loading = true;
  try {
    await apiFetch(`/clubs/${selectedClub.value.id}/staff`, {
      method: 'POST',
      body: JSON.stringify({ user_id: attachClubStaff.selected }),
    });
    clubStaffModal?.hide?.();
    await refreshClubStaff();
    showToast('Сотрудник прикреплён к клубу');
  } finally {
    attachClubStaff.loading = false;
  }
}

// Team staff management
async function openTeamManage(team) {
  teamManage.team = team;
  teamManage.loading = true;
  teamManage.staff = [];
  teamManage.attach = { loading: false, q: '', options: [], selected: '' };
  try {
    const data = await apiFetch(`/teams/${team.id}/staff`);
    teamManage.staff = data.users || [];
  } finally {
    teamManage.loading = false;
  }
  teamModal?.show?.();
}

async function searchTeamAttachOptions() {
  teamManage.attach.loading = true;
  try {
    const q = teamManage.attach.q
      ? `&search=${encodeURIComponent(teamManage.attach.q)}`
      : '';
    const data = await apiFetch(`/users?role=SPORT_SCHOOL_STAFF&limit=50${q}`);
    teamManage.attach.options = (data.users || []).map((u) => ({
      id: u.id,
      label: `${u.last_name} ${u.first_name} ${u.patronymic || ''}`.trim(),
    }));
  } finally {
    teamManage.attach.loading = false;
  }
}

async function confirmAttachTeamStaff() {
  if (!teamManage.team || !teamManage.attach.selected) return;
  teamManage.attach.loading = true;
  try {
    await apiFetch(`/teams/${teamManage.team.id}/staff`, {
      method: 'POST',
      body: JSON.stringify({ user_id: teamManage.attach.selected }),
    });
    const data = await apiFetch(`/teams/${teamManage.team.id}/staff`);
    teamManage.staff = data.users || [];
    showToast('Сотрудник прикреплён к команде');
    // Refresh overview table to reflect changes
    await fetchAssignments();
  } finally {
    teamManage.attach.loading = false;
  }
}

function askDetach(scope, id, name) {
  confirmDetach.scope = scope; // 'club' | 'team'
  confirmDetach.id = id;
  confirmDetach.name = name;
  detachModal?.show?.();
}

async function confirmDetachLink() {
  confirmDetach.loading = true;
  try {
    if (activeTab.value === 'staff') {
      if (confirmDetach.scope === 'club' && selectedUser.value) {
        await apiFetch(
          `/users/${selectedUser.value.id}/clubs/${confirmDetach.id}`,
          { method: 'DELETE' }
        );
        await refreshLinks();
        showToast('Клуб откреплён');
      } else if (confirmDetach.scope === 'team' && selectedUser.value) {
        await apiFetch(
          `/users/${selectedUser.value.id}/teams/${confirmDetach.id}`,
          { method: 'DELETE' }
        );
        await refreshLinks();
        showToast('Команда откреплена');
      }
    } else {
      if (confirmDetach.scope === 'club' && selectedClub.value) {
        await apiFetch(
          `/clubs/${selectedClub.value.id}/staff/${confirmDetach.id}`,
          { method: 'DELETE' }
        );
        await refreshClubStaff();
        showToast('Сотрудник откреплён от клуба');
      } else if (confirmDetach.scope === 'team' && teamManage.team) {
        await apiFetch(
          `/teams/${teamManage.team.id}/staff/${confirmDetach.id}`,
          { method: 'DELETE' }
        );
        const data = await apiFetch(`/teams/${teamManage.team.id}/staff`);
        teamManage.staff = data.users || [];
        await fetchAssignments();
        showToast('Сотрудник откреплён от команды');
      }
    }
    detachModal?.hide?.();
  } finally {
    confirmDetach.loading = false;
  }
}

function showToast(msg) {
  if (!toast && toastRef.value) toast = new Toast(toastRef.value);
  toastMessage.value = msg;
  toast.show();
}

// Staff tab (user-centric): list staff and manage their clubs/teams
const staffSearch = ref('');
const staffLoading = ref(false);
const staffList = ref([]);
const staffTotal = ref(0);
const staffPage = ref(1);
const staffPageSize = ref(loadPageSize('adminSportSchoolsStaffPageSize', 10));
const staffTotalPages = computed(() =>
  Math.max(1, Math.ceil(staffTotal.value / staffPageSize.value))
);
const selectedUser = ref(null);
const links = reactive({ clubs: [], teams: [], loading: false });

watch(staffSearch, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const term = staffSearch.value.trim();
    staffPage.value = 1;
    if (term.length === 0 || term.length >= 2) fetchStaff();
  }, 300);
});
watch(staffPageSize, (val) => {
  savePageSize('adminSportSchoolsStaffPageSize', val);
  staffPage.value = 1;
  fetchStaff();
});
watch(staffPage, () => fetchStaff());

async function fetchStaff() {
  staffLoading.value = true;
  try {
    const data = await apiFetch(
      `/users?role=SPORT_SCHOOL_STAFF&page=${staffPage.value}&limit=${staffPageSize.value}&search=${encodeURIComponent(
        staffSearch.value || ''
      )}`
    );
    staffList.value = data.users || [];
    staffTotal.value = Number(data.total || 0);
    const pages = Math.max(
      1,
      Math.ceil(staffTotal.value / staffPageSize.value)
    );
    if (staffPage.value > pages) staffPage.value = pages;
  } finally {
    staffLoading.value = false;
  }
}

async function selectUser(u) {
  selectedUser.value = u;
  await refreshLinks();
}
async function refreshLinks() {
  if (!selectedUser.value) return;
  links.loading = true;
  try {
    const data = await apiFetch(
      `/users/${selectedUser.value.id}/sport-schools`
    );
    links.clubs = data.clubs || [];
    links.teams = data.teams || [];
  } finally {
    links.loading = false;
  }
}

// Reuse attach/detach modals from earlier but targeting selectedUser
async function openAttachClub() {
  attachClubStaff.loading = true;
  attachClubStaff.selected = '';
  try {
    const q = attachClubStaff.q
      ? `&search=${encodeURIComponent(attachClubStaff.q)}`
      : '';
    const data = await apiFetch(`/clubs?limit=50${q}`);
    attachClubStaff.options = (data.clubs || []).map((c) => ({
      id: c.id,
      label: c.name,
    }));
  } finally {
    attachClubStaff.loading = false;
  }
  clubStaffModal?.show?.();
}
async function confirmAttachClub() {
  if (!attachClubStaff.selected || !selectedUser.value) return;
  attachClubStaff.loading = true;
  try {
    await apiFetch(`/users/${selectedUser.value.id}/clubs`, {
      method: 'POST',
      body: JSON.stringify({ club_id: attachClubStaff.selected }),
    });
    clubStaffModal?.hide?.();
    await refreshLinks();
    showToast('Клуб успешно прикреплён');
  } finally {
    attachClubStaff.loading = false;
  }
}

async function openAttachTeamToUser() {
  teamManage.team = null;
  teamManage.attach.loading = true;
  teamManage.attach.selected = '';
  try {
    const data = await apiFetch(
      `/teams?limit=50${teamManage.attach.q ? `&search=${encodeURIComponent(teamManage.attach.q)}` : ''}`
    );
    teamManage.attach.options = (data.teams || []).map((t) => ({
      id: t.id,
      label: `${t.name}${t.birth_year ? ` (${t.birth_year})` : ''}`,
    }));
  } finally {
    teamManage.attach.loading = false;
  }
  teamModal?.show?.();
}
async function confirmAttachTeamToUser() {
  if (!teamManage.attach.selected || !selectedUser.value) return;
  teamManage.attach.loading = true;
  try {
    await apiFetch(`/users/${selectedUser.value.id}/teams`, {
      method: 'POST',
      body: JSON.stringify({ team_id: teamManage.attach.selected }),
    });
    teamModal?.hide?.();
    await refreshLinks();
    showToast('Команда успешно прикреплена');
  } finally {
    teamManage.attach.loading = false;
  }
}

const canManage = computed(() => !!selectedClub.value || !!selectedUser.value);
</script>

<template>
  <div class="py-3 admin-sport-schools-page">
    <div class="container">
      <nav aria-label="breadcrumb" class="mb-3">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">
            Управление спортивными школами
          </li>
        </ol>
      </nav>
      <h1 class="mb-3 text-start">Управление спортивными школами</h1>

      <div class="card tile mb-3">
        <div class="card-body">
          <ul
            v-edge-fade
            class="nav nav-pills nav-fill mb-0 tab-selector"
            role="tablist"
          >
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: activeTab === 'overview' }"
                role="tab"
                :aria-selected="activeTab === 'overview'"
                @click="activeTab = 'overview'"
              >
                Назначения
              </button>
            </li>
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: activeTab === 'staff' }"
                role="tab"
                :aria-selected="activeTab === 'staff'"
                @click="activeTab = 'staff'"
              >
                Сотрудники
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div v-show="activeTab === 'overview'" class="row g-3">
        <div class="col-12">
          <div class="card section-card tile fade-in shadow-sm h-100">
            <div class="card-body">
              <h2 class="card-title h5 mb-3">Клубы, команды и сотрудники</h2>
              <div class="row g-2 align-items-end mb-3">
                <div class="col-12 col-md">
                  <div class="input-group">
                    <span id="overview-search-label" class="input-group-text">
                      <i class="bi bi-search" aria-hidden="true"></i>
                    </span>
                    <input
                      v-model="search"
                      type="text"
                      class="form-control"
                      placeholder="Поиск по клубу/команде"
                      aria-label="Поиск"
                      aria-describedby="overview-search-label"
                    />
                  </div>
                </div>
                <div class="col-6 col-md-auto">
                  <label class="form-label mb-0 small">Год</label>
                  <input
                    v-model="overviewFilters.year"
                    type="number"
                    inputmode="numeric"
                    class="form-control"
                    placeholder="Напр. 2010"
                  />
                </div>
                <div class="col-6 col-md-auto">
                  <label class="form-label mb-0 small">Назначения</label>
                  <select
                    v-model="overviewFilters.hasStaff"
                    class="form-select"
                  >
                    <option value="">Все</option>
                    <option value="true">Есть</option>
                    <option value="false">Нет</option>
                  </select>
                </div>
                <div class="col-12 col-md">
                  <label class="form-label mb-0 small"
                    >Поиск по сотруднику</label
                  >
                  <input
                    v-model="overviewFilters.staffSearch"
                    type="text"
                    class="form-control"
                    placeholder="Фамилия, имя или отчество"
                  />
                </div>
              </div>
              <div v-edge-fade class="table-responsive">
                <table
                  class="table admin-table table-striped align-middle mb-0"
                >
                  <thead>
                    <tr>
                      <th>Клуб</th>
                      <th>Команда</th>
                      <th>Сотрудники</th>
                      <th class="text-end">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="loading">
                      <td colspan="4">Загрузка...</td>
                    </tr>
                    <tr v-else-if="assignments.length === 0">
                      <td colspan="4">Ничего не найдено</td>
                    </tr>
                    <tr v-for="row in assignments" :key="row.team.id">
                      <td>{{ row.club?.name || '—' }}</td>
                      <td>
                        {{ row.team.name
                        }}<span v-if="row.team.birth_year">
                          ({{ row.team.birth_year }})</span
                        >
                      </td>
                      <td>
                        <span
                          v-if="row.users.length"
                          class="d-inline-flex flex-wrap gap-1"
                        >
                          <span
                            v-for="u in row.users"
                            :key="u.id"
                            class="badge text-bg-light border"
                          >
                            {{ u.last_name }} {{ u.first_name }}
                            {{ u.patronymic }}
                          </span>
                        </span>
                        <span v-else class="text-muted">—</span>
                      </td>
                      <td class="text-end">
                        <button
                          class="btn btn-sm btn-outline-brand"
                          @click="
                            selectedClub = row.club;
                            openTeamManage(row.team);
                          "
                        >
                          Управление
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <PageNav
                v-model:page="currentPage"
                v-model:page-size="pageSize"
                :total-pages="totalPages"
                :sizes="[10, 20, 50]"
              />
            </div>
          </div>
        </div>

        <!-- Modals are wired below -->
      </div>

      <div v-show="activeTab === 'staff'" class="row g-3">
        <div class="col-12 col-lg-5">
          <div class="card section-card tile fade-in shadow-sm h-100">
            <div class="card-body">
              <h2 class="card-title h5 mb-3">Сотрудники спортивных школ</h2>
              <div class="input-group mb-3">
                <span id="staff-search2" class="input-group-text"
                  ><i class="bi bi-search" aria-hidden="true"></i
                ></span>
                <input
                  v-model="staffSearch"
                  type="text"
                  class="form-control"
                  placeholder="Поиск по ФИО, e-mail, телефону"
                  aria-label="Поиск"
                  aria-describedby="staff-search2"
                />
              </div>
              <div v-edge-fade class="table-responsive">
                <table
                  class="table admin-table table-striped align-middle mb-0"
                >
                  <thead>
                    <tr>
                      <th>ФИО</th>
                      <th class="text-end">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="staffLoading">
                      <td colspan="2">Загрузка...</td>
                    </tr>
                    <tr v-else-if="staffList.length === 0">
                      <td colspan="2">Ничего не найдено</td>
                    </tr>
                    <tr v-for="u in staffList" :key="u.id">
                      <td>
                        {{ u.last_name }} {{ u.first_name }} {{ u.patronymic }}
                        <div v-if="u.phone" class="small text-muted">
                          +7 {{ u.phone.slice(1) }}
                        </div>
                      </td>
                      <td class="text-end">
                        <button
                          class="btn btn-sm btn-outline-brand"
                          @click="selectUser(u)"
                        >
                          Открыть
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <PageNav
                v-model:page="staffPage"
                v-model:page-size="staffPageSize"
                :total-pages="staffTotalPages"
                :sizes="[10, 20, 50]"
              />
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-7">
          <div class="card section-card tile fade-in shadow-sm h-100">
            <div class="card-body">
              <h2 class="card-title h5 mb-3">Назначения сотрудника</h2>
              <div v-if="!selectedUser" class="text-muted">
                Выберите сотрудника слева
              </div>
              <div v-else class="row g-3">
                <div class="col-12 col-xl-6">
                  <div class="card section-card tile fade-in shadow-sm h-100">
                    <div class="card-body">
                      <div
                        class="d-flex justify-content-between align-items-center mb-2"
                      >
                        <h3 class="h6 mb-0">Клубы</h3>
                        <button
                          class="btn btn-sm btn-brand"
                          :disabled="!selectedUser"
                          @click="openAttachClub"
                        >
                          Прикрепить клуб
                        </button>
                      </div>
                      <div class="table-responsive">
                        <table
                          class="table admin-table table-striped align-middle mb-0"
                        >
                          <thead>
                            <tr>
                              <th>Название</th>
                              <th class="text-end">Действия</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-if="links.loading">
                              <td colspan="2">Загрузка...</td>
                            </tr>
                            <tr v-else-if="!links.clubs.length">
                              <td colspan="2">Клубы не привязаны</td>
                            </tr>
                            <tr v-for="c in links.clubs" :key="c.id">
                              <td>{{ c.name }}</td>
                              <td class="text-end">
                                <button
                                  class="btn btn-sm btn-outline-danger"
                                  @click="askDetach('club', c.id, c.name)"
                                >
                                  Открепить
                                </button>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="col-12 col-xl-6">
                  <div class="card section-card tile fade-in shadow-sm h-100">
                    <div class="card-body">
                      <div
                        class="d-flex justify-content-between align-items-center mb-2"
                      >
                        <h3 class="h6 mb-0">Команды</h3>
                        <button
                          class="btn btn-sm btn-brand"
                          :disabled="!selectedUser"
                          @click="openAttachTeamToUser"
                        >
                          Прикрепить команду
                        </button>
                      </div>
                      <div class="table-responsive">
                        <table
                          class="table admin-table table-striped align-middle mb-0"
                        >
                          <thead>
                            <tr>
                              <th>Название</th>
                              <th class="text-end">Действия</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-if="links.loading">
                              <td colspan="2">Загрузка...</td>
                            </tr>
                            <tr v-else-if="!links.teams.length">
                              <td colspan="2">Команды не привязаны</td>
                            </tr>
                            <tr v-for="t in links.teams" :key="t.id">
                              <td>
                                {{ t.name
                                }}<span v-if="t.birth_year">
                                  ({{ t.birth_year }})</span
                                >
                              </td>
                              <td class="text-end">
                                <button
                                  class="btn btn-sm btn-outline-danger"
                                  @click="askDetach('team', t.id, t.name)"
                                >
                                  Открепить
                                </button>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Attach Club/Staff Modal (context-aware) -->
    <div
      ref="clubStaffModalRef"
      class="modal fade"
      tabindex="-1"
      aria-modal="true"
      role="dialog"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              {{
                activeTab === 'staff'
                  ? 'Прикрепить клуб сотруднику'
                  : 'Прикрепить сотрудника к клубу'
              }}
            </h5>
            <button
              type="button"
              class="btn-close"
              aria-label="Закрыть"
              @click="clubStaffModal?.hide?.()"
            />
          </div>
          <div class="modal-body">
            <div class="input-group mb-2">
              <span class="input-group-text"
                ><i class="bi bi-search" aria-hidden="true"></i
              ></span>
              <input
                v-model="attachClubStaff.q"
                class="form-control"
                :placeholder="
                  activeTab === 'staff' ? 'Поиск клуба' : 'Поиск по ФИО/e-mail'
                "
                @keyup.enter="
                  activeTab === 'staff' ? openAttachClub : openAttachClubStaff
                "
              />
              <button
                class="btn btn-outline-brand"
                :disabled="attachClubStaff.loading"
                @click="
                  activeTab === 'staff'
                    ? openAttachClub()
                    : openAttachClubStaff()
                "
              >
                Найти
              </button>
            </div>
            <select
              v-model="attachClubStaff.selected"
              class="form-select"
              aria-label="Выбор сотрудника"
            >
              <option value="">— Выберите сотрудника —</option>
              <option
                v-for="opt in attachClubStaff.options"
                :key="opt.id"
                :value="opt.id"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="modal-footer">
            <button
              class="btn btn-outline-secondary"
              :disabled="attachClubStaff.loading"
              @click="clubStaffModal?.hide?.()"
            >
              Отмена
            </button>
            <button
              class="btn btn-brand"
              :disabled="attachClubStaff.loading || !attachClubStaff.selected"
              @click="
                activeTab === 'staff'
                  ? confirmAttachClub()
                  : confirmAttachClubStaff()
              "
            >
              <span
                v-if="attachClubStaff.loading"
                class="spinner-border spinner-border-sm me-1"
                role="status"
                aria-hidden="true"
              ></span>
              Прикрепить
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Team Staff Manage Modal -->
    <div
      ref="teamModalRef"
      class="modal fade"
      tabindex="-1"
      aria-modal="true"
      role="dialog"
    >
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              {{
                teamManage.team
                  ? `Сотрудники команды ${teamManage.team?.name}`
                  : 'Прикрепить команду сотруднику'
              }}
            </h5>
            <button
              type="button"
              class="btn-close"
              aria-label="Закрыть"
              @click="teamModal?.hide?.()"
            />
          </div>
          <div class="modal-body">
            <div v-if="teamManage.loading">Загрузка...</div>
            <div v-else>
              <div
                class="d-flex justify-content-between align-items-center mb-2"
              >
                <div class="input-group" style="max-width: 420px">
                  <span class="input-group-text"
                    ><i class="bi bi-search"></i
                  ></span>
                  <input
                    v-model="teamManage.attach.q"
                    class="form-control"
                    :placeholder="
                      teamManage.team ? 'Поиск сотрудника' : 'Поиск команды'
                    "
                    @keyup.enter="
                      teamManage.team
                        ? searchTeamAttachOptions()
                        : openAttachTeamToUser()
                    "
                  />
                  <button
                    class="btn btn-outline-brand"
                    :disabled="teamManage.attach.loading"
                    @click="
                      teamManage.team
                        ? searchTeamAttachOptions()
                        : openAttachTeamToUser()
                    "
                  >
                    Найти
                  </button>
                </div>
                <div class="d-flex gap-2">
                  <select
                    v-model="teamManage.attach.selected"
                    class="form-select form-select-sm"
                    style="min-width: 260px"
                  >
                    <option value="">
                      —
                      {{
                        teamManage.team
                          ? 'Выберите сотрудника'
                          : 'Выберите команду'
                      }}
                      —
                    </option>
                    <option
                      v-for="opt in teamManage.attach.options"
                      :key="opt.id"
                      :value="opt.id"
                    >
                      {{ opt.label }}
                    </option>
                  </select>
                  <button
                    class="btn btn-sm btn-brand"
                    :disabled="
                      teamManage.attach.loading || !teamManage.attach.selected
                    "
                    @click="
                      teamManage.team
                        ? confirmAttachTeamStaff()
                        : confirmAttachTeamToUser()
                    "
                  >
                    <span
                      v-if="teamManage.attach.loading"
                      class="spinner-border spinner-border-sm me-1"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Прикрепить
                  </button>
                </div>
              </div>
              <div v-if="teamManage.team" class="table-responsive">
                <table
                  class="table admin-table table-striped align-middle mb-0"
                >
                  <thead>
                    <tr>
                      <th>ФИО</th>
                      <th class="text-end">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="!teamManage.staff.length">
                      <td colspan="2">Сотрудники не назначены</td>
                    </tr>
                    <tr v-for="u in teamManage.staff" :key="u.id">
                      <td>
                        {{ u.last_name }} {{ u.first_name }} {{ u.patronymic }}
                      </td>
                      <td class="text-end">
                        <button
                          class="btn btn-sm btn-outline-danger"
                          @click="
                            askDetach(
                              'team',
                              u.id,
                              `${u.last_name} ${u.first_name}`
                            )
                          "
                        >
                          Открепить
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Detach confirm modal -->
    <div
      ref="detachModalRef"
      class="modal fade"
      tabindex="-1"
      aria-modal="true"
      role="dialog"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Подтверждение</h5>
            <button
              type="button"
              class="btn-close"
              aria-label="Закрыть"
              @click="detachModal?.hide?.()"
            />
          </div>
          <div class="modal-body">
            <p class="mb-0">
              {{
                activeTab === 'staff'
                  ? confirmDetach.scope === 'club'
                    ? 'Открепить клуб'
                    : 'Открепить команду'
                  : 'Открепить сотрудника'
              }}
              «{{ confirmDetach.name }}»?
            </p>
          </div>
          <div class="modal-footer">
            <button
              class="btn btn-outline-secondary"
              :disabled="confirmDetach.loading"
              @click="detachModal?.hide?.()"
            >
              Отмена
            </button>
            <button
              class="btn btn-danger"
              :disabled="confirmDetach.loading"
              @click="confirmDetachLink"
            >
              <span
                v-if="confirmDetach.loading"
                class="spinner-border spinner-border-sm me-1"
                role="status"
                aria-hidden="true"
              ></span>
              Открепить
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Toasts -->
    <div class="toast-container position-fixed bottom-0 end-0 p-3">
      <div
        ref="toastRef"
        class="toast text-bg-secondary"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div class="toast-body">{{ toastMessage }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-sport-schools-page .card-title {
  color: var(--bs-secondary-color);
}
</style>
