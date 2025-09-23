<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import { RouterLink } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';

import PageNav from '../components/PageNav.vue';
import { apiFetch } from '../api';
import { useToast } from '../utils/toast';
import { loadPageSize, savePageSize } from '../utils/pageSize.js';

const { showToast } = useToast();

const clubList = reactive({
  items: [],
  total: 0,
  loading: false,
  page: 1,
  pageSize: loadPageSize('adminSportSchoolsClubPageSize', 10),
  search: '',
});

const totalClubPages = computed(() =>
  Math.max(1, Math.ceil((clubList.total || 1) / clubList.pageSize))
);

const structure = reactive({
  loading: false,
  club: null,
  positions: [],
  staff: [],
  teams: [],
});

const selectedClubId = ref('');
const selectedClub = computed(() => structure.club);

function resetStructure() {
  structure.club = null;
  structure.positions = [];
  structure.staff = [];
  structure.teams = [];
}

async function fetchClubs() {
  clubList.loading = true;
  try {
    const params = new URLSearchParams({
      page: String(clubList.page),
      limit: String(clubList.pageSize),
    });
    const term = clubList.search.trim();
    if (term) params.set('search', term);
    const data = await apiFetch(`/clubs?${params.toString()}`);
    clubList.items = data.clubs || [];
    clubList.total = Number(data.total || 0);
    if (clubList.items.length === 0) {
      selectedClubId.value = '';
      resetStructure();
      return;
    }
    if (
      !selectedClubId.value ||
      !clubList.items.some((club) => club.id === selectedClubId.value)
    ) {
      selectedClubId.value = clubList.items[0].id;
    } else {
      const current = clubList.items.find(
        (club) => club.id === selectedClubId.value
      );
      if (current) {
        structure.club = { ...(structure.club || {}), ...current };
      }
    }
  } finally {
    clubList.loading = false;
  }
}

async function loadStructure(clubId) {
  if (!clubId) {
    resetStructure();
    return;
  }
  structure.loading = true;
  try {
    const data = await apiFetch(`/clubs/${clubId}/sport-school-structure`);
    structure.club = data.club || null;
    structure.positions = data.positions || [];
    structure.staff = data.staff || [];
    structure.teams = data.teams || [];
  } catch (err) {
    showToast('Не удалось загрузить структуру клуба', 'danger');
  } finally {
    structure.loading = false;
  }
}

const staffRows = computed(() =>
  structure.staff.map((entry) => ({
    ...entry.user,
    positionId: entry.position?.id || '',
    position: entry.position || null,
  }))
);

const staffLookup = computed(() => {
  const map = new Map();
  structure.staff.forEach((entry) => {
    if (entry?.user?.id) map.set(entry.user.id, entry);
  });
  return map;
});

const positionOptions = computed(() => [
  { value: '', label: '— Не назначена —' },
  ...structure.positions.map((pos) => ({ value: pos.id, label: pos.name })),
]);

const positionSaving = reactive({});

async function changeStaffPosition(userId, positionId) {
  if (!selectedClubId.value) return;
  positionSaving[userId] = true;
  try {
    await apiFetch(`/clubs/${selectedClubId.value}/staff/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        position_id: positionId || null,
      }),
    });
    await loadStructure(selectedClubId.value);
    showToast('Должность обновлена', 'success');
  } catch (err) {
    showToast('Не удалось обновить должность', 'danger');
  } finally {
    positionSaving[userId] = false;
  }
}

const addStaffModalRef = ref(null);
let addStaffModal;
const addStaff = reactive({
  q: '',
  options: [],
  loading: false,
  selectedUserId: '',
  selectedPositionId: '',
  saving: false,
});

async function searchStaffOptions() {
  addStaff.loading = true;
  try {
    const params = new URLSearchParams({
      role: 'SPORT_SCHOOL_STAFF',
      limit: '50',
    });
    if (addStaff.q.trim()) params.set('search', addStaff.q.trim());
    const data = await apiFetch(`/users?${params.toString()}`);
    addStaff.options = (data.users || []).map((u) => ({
      id: u.id,
      label: `${u.last_name} ${u.first_name} ${u.patronymic || ''}`.trim(),
    }));
  } finally {
    addStaff.loading = false;
  }
}

function openAddStaffModal() {
  if (!selectedClubId.value) return;
  addStaff.q = '';
  addStaff.selectedUserId = '';
  addStaff.selectedPositionId = '';
  addStaff.options = [];
  searchStaffOptions();
  addStaffModal?.show?.();
}

async function confirmAddStaff() {
  if (!selectedClubId.value || !addStaff.selectedUserId) return;
  addStaff.saving = true;
  try {
    await apiFetch(`/clubs/${selectedClubId.value}/staff`, {
      method: 'POST',
      body: JSON.stringify({
        user_id: addStaff.selectedUserId,
        position_id: addStaff.selectedPositionId || null,
      }),
    });
    addStaffModal?.hide?.();
    await loadStructure(selectedClubId.value);
    showToast('Сотрудник прикреплён к клубу', 'success');
  } catch (err) {
    showToast('Не удалось прикрепить сотрудника', 'danger');
  } finally {
    addStaff.saving = false;
  }
}

const teamModalRef = ref(null);
let teamModal;
const teamManage = reactive({
  team: null,
  loading: false,
  staff: [],
  attach: {
    q: '',
    options: [],
    loading: false,
    selected: '',
    saving: false,
  },
});

async function openManageTeam(team) {
  if (!team?.id) return;
  teamManage.team = team;
  teamManage.loading = true;
  teamManage.attach = {
    q: '',
    options: [],
    loading: false,
    selected: '',
    saving: false,
  };
  try {
    const data = await apiFetch(`/teams/${team.id}/staff`);
    const existing = data.users || [];
    const map = staffLookup.value;
    teamManage.staff = existing.map((user) => {
      const membership = map.get(user.id);
      return {
        ...user,
        club_position_name: membership?.position?.name || null,
      };
    });
  } finally {
    teamManage.loading = false;
  }
  teamModal?.show?.();
}

async function searchTeamAttachOptions() {
  teamManage.attach.loading = true;
  try {
    const params = new URLSearchParams({
      role: 'SPORT_SCHOOL_STAFF',
      limit: '50',
    });
    if (teamManage.attach.q.trim())
      params.set('search', teamManage.attach.q.trim());
    const data = await apiFetch(`/users?${params.toString()}`);
    teamManage.attach.options = (data.users || []).map((u) => ({
      id: u.id,
      label: `${u.last_name} ${u.first_name} ${u.patronymic || ''}`.trim(),
    }));
  } finally {
    teamManage.attach.loading = false;
  }
}

async function confirmAttachTeamStaff() {
  if (!teamManage.team?.id || !teamManage.attach.selected) return;
  teamManage.attach.saving = true;
  try {
    await apiFetch(`/teams/${teamManage.team.id}/staff`, {
      method: 'POST',
      body: JSON.stringify({ user_id: teamManage.attach.selected }),
    });
    await openManageTeam(teamManage.team);
    await loadStructure(selectedClubId.value);
    showToast('Сотрудник прикреплён к команде', 'success');
  } catch (err) {
    showToast('Не удалось прикрепить сотрудника к команде', 'danger');
  } finally {
    teamManage.attach.saving = false;
  }
}

const confirmDetachModalRef = ref(null);
let confirmDetachModal;
const confirmDetach = reactive({
  scope: '',
  id: '',
  name: '',
  loading: false,
});

function askDetach(scope, id, name) {
  confirmDetach.scope = scope;
  confirmDetach.id = id;
  confirmDetach.name = name;
  confirmDetachModal?.show?.();
}

async function confirmDetachAction() {
  if (!confirmDetach.id) return;
  confirmDetach.loading = true;
  try {
    if (confirmDetach.scope === 'club') {
      await apiFetch(
        `/clubs/${selectedClubId.value}/staff/${confirmDetach.id}`,
        {
          method: 'DELETE',
        }
      );
      await loadStructure(selectedClubId.value);
      showToast('Сотрудник откреплён от клуба', 'success');
    } else if (confirmDetach.scope === 'team' && teamManage.team?.id) {
      await apiFetch(`/teams/${teamManage.team.id}/staff/${confirmDetach.id}`, {
        method: 'DELETE',
      });
      await openManageTeam(teamManage.team);
      await loadStructure(selectedClubId.value);
      showToast('Сотрудник откреплён от команды', 'success');
    }
    confirmDetachModal?.hide?.();
  } catch (err) {
    showToast('Не удалось выполнить операцию', 'danger');
  } finally {
    confirmDetach.loading = false;
  }
}

onMounted(() => {
  fetchClubs();
  if (addStaffModalRef.value)
    addStaffModal = new Modal(addStaffModalRef.value, { backdrop: 'static' });
  if (teamModalRef.value)
    teamModal = new Modal(teamModalRef.value, { backdrop: 'static' });
  if (confirmDetachModalRef.value)
    confirmDetachModal = new Modal(confirmDetachModalRef.value);
});

onUnmounted(() => {
  addStaffModal?.dispose?.();
  teamModal?.dispose?.();
  confirmDetachModal?.dispose?.();
  clearTimeout(searchTimeout);
});

let searchTimeout;
watch(
  () => clubList.search,
  () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      if (clubList.page !== 1) clubList.page = 1;
      else fetchClubs();
    }, 300);
  }
);

watch(
  () => clubList.pageSize,
  (value) => {
    savePageSize('adminSportSchoolsClubPageSize', value);
    if (clubList.page !== 1) clubList.page = 1;
    else fetchClubs();
  }
);

watch(
  () => clubList.page,
  () => {
    fetchClubs();
  }
);

watch(selectedClubId, (id) => {
  if (id) loadStructure(id);
  else resetStructure();
});
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

      <div class="row g-3">
        <div class="col-12 col-lg-4">
          <div class="card tile shadow-sm h-100">
            <div class="card-body d-flex flex-column">
              <h2 class="card-title h5 mb-3">Клубы</h2>
              <div class="input-group mb-3">
                <span id="club-search" class="input-group-text">
                  <i class="bi bi-search" aria-hidden="true"></i>
                </span>
                <input
                  v-model="clubList.search"
                  type="search"
                  class="form-control"
                  placeholder="Поиск клуба"
                  aria-describedby="club-search"
                />
              </div>
              <div v-edge-fade class="flex-grow-1 overflow-auto">
                <div v-if="clubList.loading" class="text-muted py-3">
                  Загрузка...
                </div>
                <div v-else-if="!clubList.items.length" class="text-muted py-3">
                  Клубы не найдены
                </div>
                <div v-else class="list-group">
                  <button
                    v-for="club in clubList.items"
                    :key="club.id"
                    type="button"
                    class="list-group-item list-group-item-action"
                    :class="{ active: club.id === selectedClubId }"
                    @click="selectedClubId = club.id"
                  >
                    {{ club.name }}
                  </button>
                </div>
              </div>
              <PageNav
                class="pt-3"
                :page="clubList.page"
                :total-pages="totalClubPages"
                :page-size="clubList.pageSize"
                @update:page="(val) => (clubList.page = val)"
                @update:page-size="(val) => (clubList.pageSize = val)"
              />
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-8">
          <div v-if="structure.loading" class="card tile shadow-sm h-100">
            <div
              class="card-body d-flex align-items-center justify-content-center"
            >
              <div class="text-muted">Загрузка структуры клуба...</div>
            </div>
          </div>

          <div v-else-if="!selectedClub" class="card tile shadow-sm h-100">
            <div
              class="card-body d-flex align-items-center justify-content-center"
            >
              <div class="text-center text-muted">
                Выберите клуб, чтобы увидеть структуру спортивной школы
              </div>
            </div>
          </div>

          <div v-else class="d-flex flex-column gap-3">
            <div class="card tile shadow-sm">
              <div class="card-body">
                <div
                  class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3"
                >
                  <div>
                    <h2 class="card-title h5 mb-1">Сотрудники клуба</h2>
                    <p class="text-muted mb-0">{{ selectedClub.name }}</p>
                  </div>
                  <button
                    class="btn btn-brand mt-2 mt-md-0"
                    @click="openAddStaffModal"
                  >
                    Добавить сотрудника
                  </button>
                </div>
                <div v-edge-fade class="table-responsive">
                  <table class="table admin-table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Сотрудник</th>
                        <th style="width: 220px">Должность</th>
                        <th class="text-end" style="width: 140px">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-if="!staffRows.length">
                        <td colspan="3" class="text-muted text-center py-4">
                          Сотрудники ещё не назначены
                        </td>
                      </tr>
                      <tr v-for="row in staffRows" :key="row.id">
                        <td>
                          <div class="fw-semibold">
                            {{ row.last_name }} {{ row.first_name }}
                            {{ row.patronymic }}
                          </div>
                          <div class="text-muted small">
                            {{ row.email || row.phone }}
                          </div>
                        </td>
                        <td>
                          <select
                            class="form-select form-select-sm"
                            :value="row.positionId"
                            :disabled="positionSaving[row.id]"
                            @change="
                              changeStaffPosition(row.id, $event.target.value)
                            "
                          >
                            <option
                              v-for="opt in positionOptions"
                              :key="opt.value"
                              :value="opt.value"
                            >
                              {{ opt.label }}
                            </option>
                          </select>
                        </td>
                        <td class="text-end">
                          <button
                            class="btn btn-sm btn-outline-danger"
                            @click="
                              askDetach(
                                'club',
                                row.id,
                                `${row.last_name} ${row.first_name}`
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

            <div class="card tile shadow-sm">
              <div class="card-body">
                <div
                  class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3"
                >
                  <h2 class="card-title h5 mb-0">Команды клуба</h2>
                  <div class="text-muted small">
                    Редактируйте состав сотрудников по каждой команде
                  </div>
                </div>
                <div v-edge-fade class="table-responsive">
                  <table class="table admin-table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Команда</th>
                        <th>Сотрудники</th>
                        <th class="text-end" style="width: 160px">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-if="!structure.teams.length">
                        <td colspan="3" class="text-muted text-center py-4">
                          У клуба пока нет команд
                        </td>
                      </tr>
                      <tr v-for="team in structure.teams" :key="team.id">
                        <td>
                          <div class="fw-semibold">
                            {{ team.name }}
                            <span v-if="team.birth_year" class="text-muted">
                              ({{ team.birth_year }})
                            </span>
                          </div>
                        </td>
                        <td>
                          <div
                            v-if="!team.staff.length"
                            class="text-muted small"
                          >
                            Сотрудники не назначены
                          </div>
                          <ul v-else class="list-unstyled mb-0">
                            <li
                              v-for="member in team.staff"
                              :key="member.user.id"
                              class="small"
                            >
                              {{ member.user.last_name }}
                              {{ member.user.first_name }}
                              {{ member.user.patronymic }}
                              <span v-if="member.position" class="text-muted">
                                — {{ member.position.name }}
                              </span>
                            </li>
                          </ul>
                        </td>
                        <td class="text-end">
                          <button
                            class="btn btn-sm btn-outline-brand"
                            @click="openManageTeam(team)"
                          >
                            Назначить сотрудников
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

    <!-- Add staff modal -->
    <div
      ref="addStaffModalRef"
      class="modal fade"
      tabindex="-1"
      aria-modal="true"
      role="dialog"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Прикрепить сотрудника к клубу</h5>
            <button
              type="button"
              class="btn-close"
              aria-label="Закрыть"
              @click="addStaffModal?.hide?.()"
            />
          </div>
          <div class="modal-body">
            <div class="input-group mb-2">
              <span class="input-group-text">
                <i class="bi bi-search"></i>
              </span>
              <input
                v-model="addStaff.q"
                type="search"
                class="form-control"
                placeholder="Поиск по ФИО или email"
                @keyup.enter="searchStaffOptions"
              />
              <button
                class="btn btn-outline-brand"
                :disabled="addStaff.loading"
                @click="searchStaffOptions"
              >
                Найти
              </button>
            </div>
            <select v-model="addStaff.selectedUserId" class="form-select mb-3">
              <option value="">— Выберите сотрудника —</option>
              <option
                v-for="opt in addStaff.options"
                :key="opt.id"
                :value="opt.id"
              >
                {{ opt.label }}
              </option>
            </select>
            <label class="form-label">Должность</label>
            <select v-model="addStaff.selectedPositionId" class="form-select">
              <option
                v-for="opt in positionOptions"
                :key="opt.value || 'none'"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="modal-footer">
            <button
              class="btn btn-outline-secondary"
              :disabled="addStaff.saving"
              @click="addStaffModal?.hide?.()"
            >
              Отмена
            </button>
            <button
              class="btn btn-brand"
              :disabled="addStaff.saving || !addStaff.selectedUserId"
              @click="confirmAddStaff"
            >
              <span
                v-if="addStaff.saving"
                class="spinner-border spinner-border-sm me-1"
              ></span>
              Прикрепить
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Manage team modal -->
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
                  ? `Сотрудники команды ${teamManage.team.name}`
                  : 'Назначение сотрудников'
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
            <div v-if="teamManage.loading" class="text-muted">Загрузка...</div>
            <div v-else>
              <div class="input-group mb-3" style="max-width: 420px">
                <span class="input-group-text"
                  ><i class="bi bi-search"></i
                ></span>
                <input
                  v-model="teamManage.attach.q"
                  type="search"
                  class="form-control"
                  placeholder="Поиск сотрудника"
                  @keyup.enter="searchTeamAttachOptions"
                />
                <button
                  class="btn btn-outline-brand"
                  :disabled="teamManage.attach.loading"
                  @click="searchTeamAttachOptions"
                >
                  Найти
                </button>
              </div>
              <div class="d-flex gap-2 align-items-center mb-3">
                <select
                  v-model="teamManage.attach.selected"
                  class="form-select"
                >
                  <option value="">— Выберите сотрудника —</option>
                  <option
                    v-for="opt in teamManage.attach.options"
                    :key="opt.id"
                    :value="opt.id"
                  >
                    {{ opt.label }}
                  </option>
                </select>
                <button
                  class="btn btn-brand"
                  :disabled="
                    teamManage.attach.saving || !teamManage.attach.selected
                  "
                  @click="confirmAttachTeamStaff"
                >
                  <span
                    v-if="teamManage.attach.saving"
                    class="spinner-border spinner-border-sm me-1"
                  ></span>
                  Прикрепить
                </button>
              </div>
              <div v-edge-fade class="table-responsive">
                <table class="table admin-table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Сотрудник</th>
                      <th class="text-end" style="width: 140px">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="!teamManage.staff.length">
                      <td colspan="2" class="text-muted text-center py-4">
                        Сотрудники не назначены
                      </td>
                    </tr>
                    <tr v-for="user in teamManage.staff" :key="user.id">
                      <td>
                        <div class="fw-semibold">
                          {{ user.last_name }} {{ user.first_name }}
                          {{ user.patronymic }}
                        </div>
                        <div class="text-muted small">
                          {{ user.email || user.phone }}
                        </div>
                        <div
                          v-if="user.club_position_name"
                          class="text-muted small"
                        >
                          Должность: {{ user.club_position_name }}
                        </div>
                      </td>
                      <td class="text-end">
                        <button
                          class="btn btn-sm btn-outline-danger"
                          @click="
                            askDetach(
                              'team',
                              user.id,
                              `${user.last_name} ${user.first_name}`
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

    <!-- Confirm detach modal -->
    <div
      ref="confirmDetachModalRef"
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
              @click="confirmDetachModal?.hide?.()"
            />
          </div>
          <div class="modal-body">
            <p class="mb-0">
              {{
                confirmDetach.scope === 'club'
                  ? 'Открепить сотрудника от клуба'
                  : 'Открепить сотрудника от команды'
              }}
              «{{ confirmDetach.name }}»?
            </p>
          </div>
          <div class="modal-footer">
            <button
              class="btn btn-outline-secondary"
              :disabled="confirmDetach.loading"
              @click="confirmDetachModal?.hide?.()"
            >
              Отмена
            </button>
            <button
              class="btn btn-danger"
              :disabled="confirmDetach.loading"
              @click="confirmDetachAction"
            >
              <span
                v-if="confirmDetach.loading"
                class="spinner-border spinner-border-sm me-1"
              ></span>
              Открепить
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-sport-schools-page .card-title {
  color: var(--bs-secondary-color);
}

.admin-sport-schools-page .list-group-item-action.active {
  background-color: var(--bs-primary);
  border-color: var(--bs-primary);
}
</style>
