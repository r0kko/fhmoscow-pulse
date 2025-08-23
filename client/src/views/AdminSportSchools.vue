<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, watch } from 'vue';
import { RouterLink } from 'vue-router';
import Toast from 'bootstrap/js/dist/toast';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';
import PageNav from '../components/PageNav.vue';
import { loadPageSize, savePageSize } from '../utils/pageSize.js';

const search = ref('');
const loading = ref(false);
const staff = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(loadPageSize('adminSportSchoolsPageSize', 10));
const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value))
);
const selectedUser = ref(null);

const links = reactive({ clubs: [], teams: [], loading: false });

// attach/detach UI state
const toastRef = ref(null);
let toast;
const toastMessage = ref('');

const attachClub = reactive({ loading: false, clubs: [], q: '', selected: '' });
const attachTeam = reactive({
  loading: false,
  teams: [],
  q: '',
  selected: '',
  clubId: '',
});
const confirmDetach = reactive({ type: '', id: '', name: '', loading: false });

// Bootstrap Modal instances
const clubModalRef = ref(null);
const teamModalRef = ref(null);
const detachModalRef = ref(null);
let clubModal, teamModal, detachModal;

onMounted(() => {
  // prime toast
  if (!toast && toastRef.value) toast = new Toast(toastRef.value);
  // initial search
  fetchStaff();
  // init modals
  if (clubModalRef.value) clubModal = new Modal(clubModalRef.value);
  if (teamModalRef.value) teamModal = new Modal(teamModalRef.value);
  if (detachModalRef.value) detachModal = new Modal(detachModalRef.value);
});

onUnmounted(() => {
  try {
    clubModal?.dispose?.();
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
    if (term.length === 0 || term.length >= 2) fetchStaff();
  }, 300);
});
watch(pageSize, (val) => {
  savePageSize('adminSportSchoolsPageSize', val);
  currentPage.value = 1;
  fetchStaff();
});
watch(currentPage, () => {
  fetchStaff();
});

async function fetchStaff() {
  loading.value = true;
  try {
    const data = await apiFetch(
      `/users?role=SPORT_SCHOOL_STAFF&page=${currentPage.value}&limit=${pageSize.value}&search=${encodeURIComponent(
        search.value || ''
      )}`
    );
    staff.value = (data.users || []).map((u) => ({
      id: u.id,
      fio: `${u.last_name} ${u.first_name} ${u.patronymic || ''}`.trim(),
      email: u.email,
    }));
    total.value = Number(data.total || 0);
  } catch (e) {
    // noop; handled globally
  } finally {
    loading.value = false;
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

// Attach club
async function openAttachClub() {
  attachClub.loading = true;
  attachClub.selected = '';
  try {
    const data = await apiFetch(
      `/clubs?limit=50&search=${encodeURIComponent(attachClub.q || '')}`
    );
    attachClub.clubs = data.clubs || [];
  } finally {
    attachClub.loading = false;
  }
  clubModal?.show?.();
}
async function confirmAttachClub() {
  if (!attachClub.selected) return;
  attachClub.loading = true;
  try {
    await apiFetch(`/users/${selectedUser.value.id}/clubs`, {
      method: 'POST',
      body: JSON.stringify({ club_id: attachClub.selected }),
    });
    clubModal?.hide?.();
    await refreshLinks();
    showToast('Клуб успешно прикреплён');
  } finally {
    attachClub.loading = false;
  }
}

// Attach team
async function openAttachTeam() {
  attachTeam.loading = true;
  attachTeam.selected = '';
  try {
    const data = await apiFetch(
      `/teams?limit=50${attachTeam.q ? `&search=${encodeURIComponent(attachTeam.q)}` : ''}${
        attachTeam.clubId
          ? `&club_id=${encodeURIComponent(attachTeam.clubId)}`
          : ''
      }`
    );
    attachTeam.teams = data.teams || [];
  } finally {
    attachTeam.loading = false;
  }
  teamModal?.show?.();
}
async function confirmAttachTeam() {
  if (!attachTeam.selected) return;
  attachTeam.loading = true;
  try {
    await apiFetch(`/users/${selectedUser.value.id}/teams`, {
      method: 'POST',
      body: JSON.stringify({ team_id: attachTeam.selected }),
    });
    teamModal?.hide?.();
    await refreshLinks();
    showToast('Команда успешно прикреплена');
  } finally {
    attachTeam.loading = false;
  }
}

// Detach with confirmation
function askDetach(type, id, name) {
  confirmDetach.type = type; // 'club' | 'team'
  confirmDetach.id = id;
  confirmDetach.name = name;
  detachModal?.show?.();
}

async function confirmDetachLink() {
  confirmDetach.loading = true;
  try {
    if (confirmDetach.type === 'club') {
      await apiFetch(
        `/users/${selectedUser.value.id}/clubs/${confirmDetach.id}`,
        { method: 'DELETE' }
      );
      showToast('Клуб откреплён');
    } else {
      await apiFetch(
        `/users/${selectedUser.value.id}/teams/${confirmDetach.id}`,
        { method: 'DELETE' }
      );
      showToast('Команда откреплена');
    }
    detachModal?.hide?.();
    await refreshLinks();
  } finally {
    confirmDetach.loading = false;
  }
}

function showToast(msg) {
  if (!toast && toastRef.value) toast = new Toast(toastRef.value);
  toastMessage.value = msg;
  toast.show();
}

const canManage = computed(() => !!selectedUser.value);
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
        <div class="col-12 col-lg-5">
          <div class="card h-100">
            <div class="card-body">
              <h2 class="card-title h5 mb-3">Сотрудники спортивных школ</h2>
              <div class="input-group mb-3">
                <span id="staff-search-label" class="input-group-text">
                  <i class="bi bi-search" aria-hidden="true"></i>
                </span>
                <input
                  v-model="search"
                  type="text"
                  class="form-control"
                  placeholder="Поиск по ФИО, e-mail, телефону"
                  aria-label="Поиск"
                  aria-describedby="staff-search-label"
                />
              </div>
              <PageNav
                v-model:page="currentPage"
                v-model:page-size="pageSize"
                :total-pages="totalPages"
              />
              <div v-edge-fade class="table-responsive">
                <table
                  class="table admin-table table-striped align-middle mb-0"
                >
                  <thead>
                    <tr>
                      <th>ФИО</th>
                      <th>E-mail</th>
                      <th class="text-end">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="loading">
                      <td colspan="3">Загрузка...</td>
                    </tr>
                    <tr v-else-if="staff.length === 0">
                      <td colspan="3">Ничего не найдено</td>
                    </tr>
                    <tr v-for="u in staff" v-else :key="u.id">
                      <td>{{ u.fio }}</td>
                      <td>{{ u.email }}</td>
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
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-7">
          <div class="card h-100">
            <div class="card-body">
              <h2 class="card-title h5 mb-3">Связи пользователя</h2>
              <div v-if="!selectedUser" class="text-muted">
                Выберите сотрудника слева
              </div>

              <div v-else>
                <div
                  class="d-flex justify-content-between align-items-center mb-2"
                >
                  <div>
                    <div class="fw-semibold">{{ selectedUser.fio }}</div>
                    <div class="small text-muted">
                      ID: {{ selectedUser.id }}
                    </div>
                  </div>
                </div>

                <div class="row g-3">
                  <div class="col-12 col-xl-6">
                    <div class="card h-100">
                      <div class="card-body">
                        <div
                          class="d-flex justify-content-between align-items-center mb-2"
                        >
                          <h3 class="h6 mb-0">Клубы</h3>
                          <button
                            class="btn btn-sm btn-brand"
                            :disabled="links.loading || !selectedUser"
                            :title="
                              !selectedUser ? 'Сначала выберите сотрудника' : ''
                            "
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
                              <tr v-else-if="links.clubs.length === 0">
                                <td colspan="2">Клубы не привязаны</td>
                              </tr>
                              <tr v-for="c in links.clubs" v-else :key="c.id">
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
                    <div class="card h-100">
                      <div class="card-body">
                        <div
                          class="d-flex justify-content-between align-items-center mb-2"
                        >
                          <h3 class="h6 mb-0">Команды</h3>
                          <button
                            class="btn btn-sm btn-brand"
                            :disabled="links.loading || !selectedUser"
                            :title="
                              !selectedUser ? 'Сначала выберите сотрудника' : ''
                            "
                            @click="openAttachTeam"
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
                              <tr v-else-if="links.teams.length === 0">
                                <td colspan="2">Команды не привязаны</td>
                              </tr>
                              <tr v-for="t in links.teams" v-else :key="t.id">
                                <td>{{ t.name }}</td>
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
    </div>

    <!-- Attach Club Modal -->
    <div
      ref="clubModalRef"
      class="modal fade"
      tabindex="-1"
      aria-modal="true"
      role="dialog"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Прикрепить клуб</h5>
            <button
              type="button"
              class="btn-close"
              aria-label="Закрыть"
              @click="clubModal?.hide?.()"
            />
          </div>
          <div class="modal-body">
            <div class="input-group mb-2">
              <span class="input-group-text"
                ><i class="bi bi-search" aria-hidden="true"></i
              ></span>
              <input
                v-model="attachClub.q"
                class="form-control"
                placeholder="Поиск клуба"
                @keyup.enter="openAttachClub"
              />
              <button
                class="btn btn-outline-brand"
                :disabled="attachClub.loading"
                @click="openAttachClub"
              >
                Найти
              </button>
            </div>
            <select
              v-model="attachClub.selected"
              class="form-select"
              :disabled="attachClub.loading"
            >
              <option value="">— Выберите клуб —</option>
              <option v-for="c in attachClub.clubs" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
          </div>
          <div class="modal-footer">
            <button
              class="btn btn-outline-secondary"
              :disabled="attachClub.loading"
              @click="clubModal?.hide?.()"
            >
              Отмена
            </button>
            <button
              class="btn btn-brand"
              :disabled="attachClub.loading || !attachClub.selected"
              @click="confirmAttachClub"
            >
              <span
                v-if="attachClub.loading"
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

    <!-- Attach Team Modal -->
    <div
      ref="teamModalRef"
      class="modal fade"
      tabindex="-1"
      aria-modal="true"
      role="dialog"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Прикрепить команду</h5>
            <button
              type="button"
              class="btn-close"
              aria-label="Закрыть"
              @click="teamModal?.hide?.()"
            />
          </div>
          <div class="modal-body">
            <div class="input-group mb-2">
              <span class="input-group-text"
                ><i class="bi bi-search" aria-hidden="true"></i
              ></span>
              <input
                v-model="attachTeam.q"
                class="form-control"
                placeholder="Поиск команды"
                @keyup.enter="openAttachTeam"
              />
              <button
                class="btn btn-outline-brand"
                :disabled="attachTeam.loading"
                @click="openAttachTeam"
              >
                Найти
              </button>
            </div>
            <div class="mb-2">
              <select v-model="attachTeam.clubId" class="form-select">
                <option value="">— Все клубы —</option>
                <option v-for="c in links.clubs" :key="c.id" :value="c.id">
                  {{ c.name }}
                </option>
              </select>
            </div>
            <select
              v-model="attachTeam.selected"
              class="form-select"
              :disabled="attachTeam.loading"
            >
              <option value="">— Выберите команду —</option>
              <option v-for="t in attachTeam.teams" :key="t.id" :value="t.id">
                {{ t.name }}
              </option>
            </select>
          </div>
          <div class="modal-footer">
            <button
              class="btn btn-outline-secondary"
              :disabled="attachTeam.loading"
              @click="teamModal?.hide?.()"
            >
              Отмена
            </button>
            <button
              class="btn btn-brand"
              :disabled="attachTeam.loading || !attachTeam.selected"
              @click="confirmAttachTeam"
            >
              <span
                v-if="attachTeam.loading"
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
                confirmDetach.type === 'club'
                  ? 'Открепить клуб'
                  : 'Открепить команду'
              }}
              «{{ confirmDetach.name }}» от пользователя?
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
