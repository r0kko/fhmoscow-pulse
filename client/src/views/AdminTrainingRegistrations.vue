<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';

const ROLE_ORDER = ['COACH', 'EQUIPMENT_MANAGER', 'PARTICIPANT'];

const route = useRoute();
const training = ref(null);
const trainingError = ref('');
const loadingTraining = ref(false);

const list = ref([]);
const loading = ref(false);
const error = ref('');

const addForm = ref({ user_id: '', training_role_id: '' });
const addLoading = ref(false);
const judges = ref([]);
const trainingRoles = ref([]);
const lastAddedUserId = ref(null);
const normativeTypes = ref([]);
const units = ref([]);
const resultUser = ref(null);
const resultForm = ref({ type_id: '', value: '', minutes: '', seconds: '' });
const resultError = ref('');
const resultModalRef = ref(null);
let resultModal;

const attendanceMarked = computed(() => training.value?.attendance_marked);
const allMarked = computed(() =>
  list.value
    .filter((r) => showAttendance(r))
    .every((r) => r.present === true || r.present === false)
);
const currentUnit = computed(() => {
  const t = normativeTypes.value.find((x) => x.id === resultForm.value.type_id);
  if (!t) return null;
  return units.value.find((u) => u.id === t.unit_id) || null;
});

function showAttendance(reg) {
  const alias = reg.role?.alias;
  return alias === 'PARTICIPANT' || alias === 'EQUIPMENT_MANAGER';
}

function attendanceIcon(reg) {
  if (reg.present === true) return 'bi-check-lg text-success';
  if (reg.present === false) return 'bi-x-lg text-danger';
  return 'bi-question-lg text-muted';
}

function attendanceTitle(reg) {
  if (reg.present === true) return 'Присутствовал';
  if (reg.present === false) return 'Отсутствовал';
  return 'Не отмечено';
}


const groupedRegistrations = computed(() => {
  const map = {};
  trainingRoles.value.forEach((r) => {
    map[r.id] = { role: r, registrations: [] };
  });
  const none = { role: null, registrations: [] };
  for (const r of list.value) {
    const group = map[r.role_id] || none;
    group.registrations.push(r);
  }
  const groups = [];
  trainingRoles.value.forEach((r) => {
    const g = map[r.id];
    if (g.registrations.length) groups.push(g);
  });
  if (none.registrations.length) groups.push(none);
  return groups;
});

onMounted(() => {
  loadTraining();
  loadRegistrations();
  loadJudges();
  loadTrainingRoles();
  resultModal = new Modal(resultModalRef.value);
});

function formatDateTimeRange(start, end) {
  if (!start) return '';
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const startDate = new Date(start);
  const endDate = new Date(end);
  const date = `${pad(startDate.getDate())}.${pad(startDate.getMonth() + 1)}.${startDate.getFullYear()}`;
  const startTime = `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`;
  const endTime = `${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
  return `${date} ${startTime} - ${endTime}`;
}

async function loadTraining() {
  loadingTraining.value = true;
  try {
    const data = await apiFetch(`/camp-trainings/${route.params.id}`);
    training.value = data.training;
    await loadNormativeData();
    trainingError.value = '';
  } catch (e) {
    training.value = null;
    trainingError.value = e.message;
  } finally {
    loadingTraining.value = false;
  }
}

async function loadRegistrations() {
  loading.value = true;
  try {
    const data = await apiFetch(
      `/camp-trainings/${route.params.id}/registrations?limit=1000`
    );
    list.value = data.registrations.map((r) => ({
      ...r,
      role_id: r.role ? r.role.id : '',
      highlight: false,
    }));
    error.value = '';
    if (lastAddedUserId.value) {
      const added = list.value.find((r) => r.user.id === lastAddedUserId.value);
      if (added) {
        added.highlight = true;
        setTimeout(() => {
          added.highlight = false;
        }, 1500);
      }
      lastAddedUserId.value = null;
    }
  } catch (e) {
    list.value = [];
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function loadJudges() {
  try {
    const data = await apiFetch('/referee-group-users');
    judges.value = data.judges;
  } catch (_) {
    judges.value = [];
  }
}

async function loadTrainingRoles() {
  try {
    const data = await apiFetch('/training-roles');
    trainingRoles.value = data.roles
      .slice()
      .sort((a, b) => {
        const i1 = ROLE_ORDER.indexOf(a.alias);
        const i2 = ROLE_ORDER.indexOf(b.alias);
        if (i1 === -1 && i2 === -1) {
          return a.name.localeCompare(b.name);
        }
        if (i1 === -1) return 1;
        if (i2 === -1) return -1;
        return i1 - i2;
      });
  } catch (_) {
    trainingRoles.value = [];
  }
}

async function loadNormativeData() {
  if (!training.value) return;
  try {
    const [typeData, unitData] = await Promise.all([
      apiFetch(`/normative-types?limit=100&season_id=${training.value.season_id}`),
      apiFetch('/measurement-units'),
    ]);
    normativeTypes.value = typeData.types || [];
    units.value = unitData.units || [];
  } catch (_e) {
    normativeTypes.value = [];
    units.value = [];
  }
}

async function addRegistration() {
  if (!addForm.value.user_id || !addForm.value.training_role_id) return;
  try {
    addLoading.value = true;
    await apiFetch(`/camp-trainings/${route.params.id}/registrations`, {
      method: 'POST',
      body: JSON.stringify(addForm.value),
    });
    lastAddedUserId.value = addForm.value.user_id;
    addForm.value.user_id = '';
    addForm.value.training_role_id = '';
    await loadRegistrations();
  } catch (e) {
    alert(e.message);
  } finally {
    addLoading.value = false;
  }
}

async function removeRegistration(userId) {
  if (!confirm('Удалить запись?')) return;
  try {
    await apiFetch(
      `/camp-trainings/${route.params.id}/registrations/${userId}`,
      { method: 'DELETE' }
    );
    await loadRegistrations();
  } catch (e) {
    alert(e.message);
  }
}

async function updateRegistration(reg) {
  try {
    await apiFetch(
      `/camp-trainings/${route.params.id}/registrations/${reg.user.id}`,
      {
        method: 'PUT',
        body: JSON.stringify({ training_role_id: reg.role_id }),
      }
    );
    reg.role = trainingRoles.value.find((r) => r.id === reg.role_id) || null;
    reg.highlight = true;
    setTimeout(() => {
      reg.highlight = false;
    }, 1500);
  } catch (e) {
    alert(e.message);
  }
}

async function setPresence(reg, value) {
  try {
    await apiFetch(
      `/camp-trainings/${route.params.id}/registrations/${reg.user.id}/presence`,
      {
        method: 'PUT',
        body: JSON.stringify({ present: value }),
      }
    );
    reg.present = value;
  } catch (e) {
    alert(e.message);
  }
}

async function finishAttendance() {
  if (!allMarked.value) {
    alert('Отметьте посещаемость для всех участников');
    return;
  }
  try {
    const data = await apiFetch(`/camp-trainings/${route.params.id}/attendance`, {
      method: 'PUT',
      body: JSON.stringify({ attendance_marked: true }),
    });
    training.value = data.training;
  } catch (e) {
    alert(e.message);
  }
}

function openResultModal(reg) {
  resultUser.value = reg.user;
  resultForm.value = { type_id: '', value: '', minutes: '', seconds: '' };
  resultError.value = '';
  resultModal.show();
}

async function saveResult() {
  const type = normativeTypes.value.find((t) => t.id === resultForm.value.type_id);
  if (!type) {
    resultError.value = 'Выберите норматив';
    return;
  }
  const unit = units.value.find((u) => u.id === type.unit_id);
  let val;
  if (unit?.alias === 'MIN_SEC') {
    const m = parseInt(resultForm.value.minutes || '0', 10);
    const s = parseInt(resultForm.value.seconds || '0', 10);
    if (Number.isNaN(m) || Number.isNaN(s) || s < 0 || s > 59) {
      resultError.value = 'Неверное значение';
      return;
    }
    val = `${m}:${String(s).padStart(2, '0')}`;
  } else {
    val = resultForm.value.value;
    if (val === '' || val == null) {
      resultError.value = 'Неверное значение';
      return;
    }
  }
  const payload = {
    user_id: resultUser.value.id,
    season_id: training.value.season_id,
    training_id: training.value.id,
    type_id: type.id,
    value: val,
  };
  try {
    await apiFetch('/normative-results', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    resultModal.hide();
  } catch (e) {
    resultError.value = e.message;
  }
}
</script>

<template>
  <div class="py-3 admin-training-registrations-page">
    <div class="container">
      <nav aria-label="breadcrumb" class="mb-3">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item">
            <RouterLink to="/camp-stadiums">Сборы</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Участники</li>
        </ol>
      </nav>
      <h1 class="mb-3">Участники тренировки</h1>
      <p v-if="training" class="mb-3">
        <strong>{{ training.type?.name }}</strong>,
        {{ formatDateTimeRange(training.start_at, training.end_at) }}
      </p>
      <div v-if="trainingError" class="alert alert-danger mb-3">{{ trainingError }}</div>
      <div v-if="error" class="alert alert-danger mb-3">{{ error }}</div>
      <div v-if="loading || loadingTraining" class="text-center my-3">
        <div class="spinner-border" role="status"></div>
      </div>
      <div class="row g-2 align-items-end mb-3">
        <div class="col-12 col-sm">
          <label class="form-label">Судья</label>
          <select v-model="addForm.user_id" class="form-select">
            <option value="" disabled>Выберите судью</option>
            <option v-for="j in judges" :key="j.user.id" :value="j.user.id">
              {{ j.user.last_name }} {{ j.user.first_name }} {{ j.user.patronymic }}
            </option>
          </select>
        </div>
        <div class="col-12 col-sm">
          <label class="form-label">Роль</label>
          <select v-model="addForm.training_role_id" class="form-select">
            <option value="" disabled>Выберите роль</option>
            <option v-for="r in trainingRoles" :key="r.id" :value="r.id">
              {{ r.name }}
            </option>
          </select>
        </div>
        <div class="col-12 col-sm-auto d-grid d-sm-block">
          <button class="btn btn-brand" @click="addRegistration" :disabled="addLoading">
            <span v-if="addLoading" class="spinner-border spinner-border-sm me-2"></span>
            Добавить
          </button>
        </div>
      </div>
      <div v-if="list.length" class="card section-card tile fade-in shadow-sm">
        <div class="card-body p-3">
          <div v-for="group in groupedRegistrations" :key="group.role ? group.role.id : 'none'" class="mb-4 table-responsive">
            <h5 class="mb-2">{{ group.role ? group.role.name : 'Без роли' }}</h5>
            <table class="table admin-table table-striped align-middle mb-0">
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th>Роль</th>
                  <th class="text-center">Посещение</th>
                  <th></th>
                </tr>
              </thead>
              <TransitionGroup tag="tbody" name="fade-list">
                <tr
                  v-for="r in group.registrations"
                  :key="r.user.id"
                  :class="{ highlight: r.highlight }"
                >
                  <td>{{ r.user.last_name }} {{ r.user.first_name }} {{ r.user.patronymic }}</td>
                  <td>
                    <select v-model="r.role_id" class="form-select form-select-sm" @change="updateRegistration(r)">
                      <option value="" disabled>Выберите роль</option>
                      <option v-for="role in trainingRoles" :key="role.id" :value="role.id">
                        {{ role.name }}
                      </option>
                    </select>
                  </td>
                  <td class="text-center">
                    <div
                      v-if="showAttendance(r)"
                      class="btn-group btn-group-sm presence-group"
                      role="group"
                    >
                      <input
                        type="radio"
                        class="btn-check"
                        :id="`present-yes-${r.user.id}`"
                        :name="`present-${r.user.id}`"
                        autocomplete="off"
                        :checked="r.present === true"
                        @change="setPresence(r, true)"
                        :disabled="attendanceMarked"
                      />
                      <label
                        class="btn btn-outline-success presence-btn"
                        :for="`present-yes-${r.user.id}`"
                      >
                        <i class="bi bi-check-lg" aria-hidden="true"></i>
                        <span class="visually-hidden">Да</span>
                      </label>
                      <input
                        type="radio"
                        class="btn-check"
                        :id="`present-no-${r.user.id}`"
                        :name="`present-${r.user.id}`"
                        autocomplete="off"
                        :checked="r.present === false"
                        @change="setPresence(r, false)"
                        :disabled="attendanceMarked"
                      />
                      <label
                        class="btn btn-outline-danger presence-btn"
                        :for="`present-no-${r.user.id}`"
                      >
                        <i class="bi bi-x-lg" aria-hidden="true"></i>
                        <span class="visually-hidden">Нет</span>
                      </label>
                    </div>
                  </td>
                  <td class="text-end">
                    <button
                      v-if="showAttendance(r)"
                      class="btn btn-sm btn-secondary me-2"
                      @click="openResultModal(r)"
                    >
                      <i class="bi bi-plus-lg" aria-hidden="true"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" @click="removeRegistration(r.user.id)">
                      <i class="bi bi-x-lg" aria-hidden="true"></i>
                      <span class="visually-hidden">Удалить</span>
                    </button>
                  </td>
                </tr>
              </TransitionGroup>
            </table>
          </div>
        </div>
      </div>
      <button
        v-if="list.length && !attendanceMarked"
        class="btn btn-brand mt-3"
        @click="finishAttendance"
        :disabled="!allMarked"
      >
        Завершить
      </button>
      <p v-else-if="attendanceMarked" class="alert alert-success mt-3">
        Посещаемость отмечена
      </p>
      <p v-else-if="!loading && !loadingTraining" class="text-muted mb-0">
        Нет записей.
      </p>
      <div ref="resultModalRef" class="modal fade" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <form @submit.prevent="saveResult">
              <div class="modal-header">
                <h5 class="modal-title">Результат норматива</h5>
                <button
                  type="button"
                  class="btn-close"
                  @click="resultModal.hide()"
                ></button>
              </div>
              <div class="modal-body">
                <div v-if="resultError" class="alert alert-danger mb-2">
                  {{ resultError }}
                </div>
                <div class="form-floating mb-3">
                  <select
                    id="resType"
                    v-model="resultForm.type_id"
                    class="form-select"
                    required
                  >
                    <option value="" disabled>Тип норматива</option>
                    <option v-for="t in normativeTypes" :key="t.id" :value="t.id">
                      {{ t.name }}
                    </option>
                  </select>
                  <label for="resType">Тип норматива</label>
                </div>
                <div v-if="currentUnit?.alias === 'MIN_SEC'" class="row g-2 mb-3">
                  <div class="col">
                    <div class="form-floating">
                      <input
                        id="resMin"
                        type="number"
                        min="0"
                        v-model.number="resultForm.minutes"
                        class="form-control"
                        placeholder="Минуты"
                        required
                      />
                      <label for="resMin">Минуты</label>
                    </div>
                  </div>
                  <div class="col">
                    <div class="form-floating">
                      <input
                        id="resSec"
                        type="number"
                        min="0"
                        max="59"
                        v-model.number="resultForm.seconds"
                        class="form-control"
                        placeholder="Секунды"
                        required
                      />
                      <label for="resSec">Секунды</label>
                    </div>
                  </div>
                </div>
                <div v-else class="form-floating mb-3">
                  <input
                    id="resValue"
                    type="number"
                    v-model="resultForm.value"
                    class="form-control"
                    placeholder="Значение"
                    required
                  />
                  <label for="resValue">Значение</label>
                </div>
              </div>
              <div class="modal-footer">
                <button
                  type="button"
                  class="btn btn-secondary"
                  @click="resultModal.hide()"
                >
                  Отмена
                </button>
                <button type="submit" class="btn btn-primary">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-list-enter-active,
.fade-list-leave-active,
.fade-list-move {
  transition: all 0.2s ease;
}
.fade-list-enter-from,
.fade-list-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
.highlight {
  animation: highlightBg 2s ease-out;
}
.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}

.presence-group .presence-btn {
  width: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0;
}

@media (max-width: 575.98px) {
  .admin-training-registrations-page {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
  }

  .admin-training-registrations-page nav[aria-label='breadcrumb'] {
    margin-bottom: 0.25rem !important;
  }

  .section-card {
    margin-left: -1rem;
    margin-right: -1rem;
  }
}

@keyframes highlightBg {
  from {
    background-color: #fff3cd;
  }
  to {
    background-color: transparent;
  }
}
</style>
