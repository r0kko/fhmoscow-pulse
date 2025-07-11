<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';

const ROLE_ORDER = ['COACH', 'EQUIPMENT_MANAGER', 'PARTICIPANT'];

const route = useRoute();
const training = ref(null);
const trainingError = ref('');
const loadingTraining = ref(false);

const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(8);
const loading = ref(false);
const error = ref('');

const addForm = ref({ user_id: '', training_role_id: '' });
const addLoading = ref(false);
const judges = ref([]);
const trainingRoles = ref([]);
const lastAddedUserId = ref(null);

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value))
);

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
});

watch([page, pageSize], loadRegistrations);

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
    const params = new URLSearchParams({
      page: page.value,
      limit: pageSize.value,
    });
    const data = await apiFetch(
      `/camp-trainings/${route.params.id}/registrations?${params}`
    );
    list.value = data.registrations.map((r) => ({
      ...r,
      role_id: r.role ? r.role.id : '',
      highlight: false,
    }));
    total.value = data.total;
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
        <div class="col">
          <label class="form-label">Судья</label>
          <select v-model="addForm.user_id" class="form-select">
            <option value="" disabled>Выберите судью</option>
            <option v-for="j in judges" :key="j.user.id" :value="j.user.id">
              {{ j.user.last_name }} {{ j.user.first_name }} {{ j.user.patronymic }}
            </option>
          </select>
        </div>
        <div class="col">
          <label class="form-label">Роль</label>
          <select v-model="addForm.training_role_id" class="form-select">
            <option value="" disabled>Выберите роль</option>
            <option v-for="r in trainingRoles" :key="r.id" :value="r.id">
              {{ r.name }}
            </option>
          </select>
        </div>
        <div class="col-auto">
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
                  <td class="text-end">
                    <button class="btn btn-sm btn-danger" @click="removeRegistration(r.user.id)">Удалить</button>
                  </td>
                </tr>
              </TransitionGroup>
            </table>
          </div>
        </div>
      </div>
      <p v-else-if="!loading && !loadingTraining" class="text-muted mb-0">Нет записей.</p>
      <nav class="mt-3" v-if="totalPages > 1">
        <ul class="pagination justify-content-center">
          <li class="page-item" :class="{ disabled: page === 1 }">
            <button class="page-link" @click="page--" :disabled="page === 1">Пред</button>
          </li>
          <li class="page-item" v-for="p in totalPages" :key="p" :class="{ active: page === p }">
            <button class="page-link" @click="page = p">{{ p }}</button>
          </li>
          <li class="page-item" :class="{ disabled: page === totalPages }">
            <button class="page-link" @click="page++" :disabled="page === totalPages">След</button>
          </li>
        </ul>
      </nav>
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
