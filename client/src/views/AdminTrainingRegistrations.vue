<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { apiFetch } from '../api.js';

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

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value))
);

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
    }));
    total.value = data.total;
    error.value = '';
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
    trainingRoles.value = data.roles;
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
            Добавить
          </button>
        </div>
      </div>
      <div v-if="list.length" class="card section-card tile fade-in shadow-sm">
        <div class="card-body p-3 table-responsive">
          <table class="table admin-table table-striped align-middle mb-0">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Роль</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in list" :key="r.user.id">
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
            </tbody>
          </table>
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
</style>
