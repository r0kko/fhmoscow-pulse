<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import { apiFetch } from '../api';
import { auth } from '../auth';
import { useToast } from '../utils/toast';
import {
  isSportSchoolEditablePosition,
  isSportSchoolManagerPosition,
} from '../utils/sportSchoolPositions';

const { showToast } = useToast();

const clubsState = reactive({
  loading: false,
  items: [],
});
const selectedClubId = ref('');

const structure = reactive({
  loading: false,
  club: null,
  positions: [],
  staff: [],
  teams: [],
});

const selectedClub = computed(() =>
  clubsState.items.find((club) => club.id === selectedClubId.value)
);
const hasManagerClubs = computed(() => clubsState.items.length > 0);
const isAdmin = computed(() => auth.roles.includes('ADMIN'));

function resetStructure() {
  structure.club = null;
  structure.positions = [];
  structure.staff = [];
  structure.teams = [];
}

function normalizeSearch(val) {
  return String(val || '')
    .trim()
    .toLowerCase();
}

function buildUserLabel(user) {
  if (!user) return '';
  const name = [user.last_name, user.first_name, user.patronymic]
    .filter(Boolean)
    .join(' ');
  return user.phone ? `${name} · ${user.phone}` : name;
}

function userSearchTarget(user) {
  if (!user) return '';
  const name = [user.last_name, user.first_name, user.patronymic]
    .filter(Boolean)
    .join(' ');
  return `${name} ${user.phone || ''}`.trim().toLowerCase();
}

async function loadManagerClubs() {
  clubsState.loading = true;
  try {
    const data = await apiFetch('/users/me/sport-schools');
    const clubs = Array.isArray(data?.clubs) ? data.clubs : [];
    clubsState.items = clubs.filter((club) =>
      isSportSchoolManagerPosition(club?.sport_school_position_alias)
    );
    if (!clubsState.items.length) {
      selectedClubId.value = '';
      resetStructure();
      return;
    }
    if (
      !selectedClubId.value ||
      !clubsState.items.some((club) => club.id === selectedClubId.value)
    ) {
      selectedClubId.value = clubsState.items[0].id;
    }
  } catch (err) {
    clubsState.items = [];
    selectedClubId.value = '';
    resetStructure();
  } finally {
    clubsState.loading = false;
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
const editablePositionOptions = computed(() =>
  structure.positions
    .filter((pos) => isSportSchoolEditablePosition(pos.alias))
    .map((pos) => ({ value: pos.id, label: pos.name }))
);
const addStaffPositionOptions = computed(() =>
  isAdmin.value ? positionOptions.value : editablePositionOptions.value
);

function positionOptionsForRow(row) {
  if (isAdmin.value) return positionOptions.value;
  const alias = row?.position?.alias || null;
  if (!alias) {
    return [
      { value: '', label: '— Выберите должность —', disabled: true },
      ...editablePositionOptions.value,
    ];
  }
  if (alias && !isSportSchoolEditablePosition(alias)) {
    return row.position
      ? [{ value: row.position.id, label: row.position.name }]
      : positionOptions.value;
  }
  return editablePositionOptions.value;
}

function canEditRow(row) {
  if (isAdmin.value) return true;
  const alias = row?.position?.alias || null;
  return !alias || isSportSchoolEditablePosition(alias);
}

function canDetachRow(row) {
  if (isAdmin.value) return true;
  const alias = row?.position?.alias || null;
  return isSportSchoolEditablePosition(alias);
}

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
  if (!selectedClubId.value) return;
  addStaff.loading = true;
  try {
    const params = new URLSearchParams({ limit: '50' });
    if (addStaff.q.trim()) params.set('search', addStaff.q.trim());
    const data = await apiFetch(
      `/clubs/${selectedClubId.value}/staff-candidates?${params.toString()}`
    );
    addStaff.options = (data.users || []).map((u) => ({
      id: u.id,
      label: buildUserLabel(u),
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
    selected: '',
    saving: false,
  },
});

const teamAttachOptions = computed(() => {
  if (!structure.staff.length) return [];
  const used = new Set(teamManage.staff.map((u) => u.id));
  const query = normalizeSearch(teamManage.attach.q);
  return structure.staff
    .filter((entry) => entry?.user?.id && !used.has(entry.user.id))
    .filter(
      (entry) =>
        isAdmin.value || isSportSchoolEditablePosition(entry?.position?.alias)
    )
    .map((entry) => ({
      id: entry.user.id,
      label: buildUserLabel(entry.user),
      search: userSearchTarget(entry.user),
    }))
    .filter((option) => !query || option.search.includes(query));
});

async function openManageTeam(team) {
  if (!team?.id) return;
  teamManage.team = team;
  teamManage.loading = true;
  teamManage.attach.q = '';
  teamManage.attach.selected = '';
  try {
    const data = await apiFetch(`/teams/${team.id}/staff`);
    const existing = data.users || [];
    const map = staffLookup.value;
    teamManage.staff = existing.map((user) => {
      const membership = map.get(user.id);
      return {
        ...user,
        club_position_name: membership?.position?.name || null,
        club_position_alias: membership?.position?.alias || null,
      };
    });
  } finally {
    teamManage.loading = false;
  }
  teamModal?.show?.();
}

function canDetachTeamMember(member) {
  if (isAdmin.value) return true;
  return isSportSchoolEditablePosition(member?.club_position_alias);
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
  loadManagerClubs();
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
});

watch(selectedClubId, (id) => {
  if (id) loadStructure(id);
  else resetStructure();
});
</script>

<template>
  <div class="py-3 school-staff-access-page">
    <div class="container">
      <Breadcrumbs
        :items="[
          { label: 'Главная', to: '/' },
          { label: 'Управление спортивной школой', to: '/school' },
          { label: 'Сотрудники и доступы' },
        ]"
      />
      <div
        class="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3 mb-3"
      >
        <div>
          <h1 class="mb-1">Сотрудники и доступы</h1>
          <p class="text-muted mb-0">
            Управляйте сотрудниками клуба и доступом к командам.
          </p>
          <p v-if="!isAdmin" class="text-muted small mb-0">
            Доступны роли: бухгалтер, тренер, медиа-менеджер.
          </p>
        </div>
        <div v-if="clubsState.items.length > 1" class="min-width-240">
          <label class="form-label small text-muted mb-1">Клуб</label>
          <select v-model="selectedClubId" class="form-select">
            <option
              v-for="club in clubsState.items"
              :key="club.id"
              :value="club.id"
            >
              {{ club.name }}
            </option>
          </select>
        </div>
      </div>

      <div v-if="clubsState.loading" class="text-center py-3">
        <div class="spinner-border spinner-brand" role="status"></div>
      </div>
      <div v-else-if="!hasManagerClubs" class="alert alert-warning">
        Доступ к управлению сотрудниками доступен только администраторам и
        директорам спортивной школы.
      </div>
      <div v-else-if="structure.loading" class="card tile shadow-sm h-100">
        <div class="card-body d-flex align-items-center justify-content-center">
          <div class="text-muted">Загрузка структуры клуба...</div>
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
                <p class="text-muted mb-0">
                  {{ selectedClub?.name || structure.club?.name }}
                </p>
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
                        :disabled="positionSaving[row.id] || !canEditRow(row)"
                        @change="
                          changeStaffPosition(row.id, $event.target.value)
                        "
                      >
                        <option
                          v-for="opt in positionOptionsForRow(row)"
                          :key="opt.value"
                          :value="opt.value"
                          :disabled="opt.disabled"
                        >
                          {{ opt.label }}
                        </option>
                      </select>
                      <div
                        v-if="!canEditRow(row) && !isAdmin"
                        class="text-muted small mt-1"
                      >
                        Доступ ограничен для этой должности
                      </div>
                    </td>
                    <td class="text-end">
                      <button
                        class="btn btn-sm btn-outline-danger"
                        :disabled="!canDetachRow(row)"
                        :title="
                          !canDetachRow(row) && !isAdmin
                            ? 'Недоступно для этой должности'
                            : ''
                        "
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
                Добавляйте сотрудников к командам и управляйте доступами
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
                      <div v-if="!team.staff.length" class="text-muted small">
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
                placeholder="Поиск по ФИО или телефону"
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
              <option v-if="!isAdmin" value="" disabled>
                — Выберите должность —
              </option>
              <option
                v-for="opt in addStaffPositionOptions"
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
              :disabled="
                addStaff.saving ||
                !addStaff.selectedUserId ||
                (!isAdmin && !addStaff.selectedPositionId)
              "
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
                  placeholder="Поиск по ФИО или телефону"
                />
              </div>
              <div class="d-flex gap-2 align-items-center mb-3">
                <select
                  v-model="teamManage.attach.selected"
                  class="form-select"
                >
                  <option value="">— Выберите сотрудника —</option>
                  <option
                    v-for="opt in teamAttachOptions"
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
              <div
                v-if="!teamAttachOptions.length"
                class="text-muted small mb-3"
              >
                Нет сотрудников, доступных для добавления.
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
                          :disabled="!canDetachTeamMember(user)"
                          :title="
                            !canDetachTeamMember(user) && !isAdmin
                              ? 'Недоступно для этой должности'
                              : ''
                          "
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
.min-width-240 {
  min-width: 240px;
}
</style>
