<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { apiFetch } from '../api';
import PageNav from '../components/PageNav.vue';
import { loadPageSize, savePageSize } from '../utils/pageSize.js';

const route = useRoute();
const training = ref(null);
const trainingError = ref('');
const loadingTraining = ref(false);

const list = ref([]);
const loading = ref(false);
const error = ref('');

const addForm = ref({ user_id: '' });
const addLoading = ref(false);
const judges = ref([]);
const filteredJudges = computed(() => {
  if (!training.value?.courses?.length) return judges.value;
  const courseIds = training.value.courses.map((c) => c.id);
  return judges.value.filter(
    (j) => j.course && courseIds.includes(j.course.id)
  );
});
const listenerRoleId = ref(null);
const lastAddedUserId = ref(null);
const finishLoading = ref(false);
const finishError = ref('');

const attendanceMarked = computed(() => training.value?.attendance_marked);
const allMarked = computed(() =>
  list.value.every((r) => r.present === true || r.present === false)
);

onMounted(() => {
  loadTraining();
  loadRegistrations();
  loadJudges();
  loadListenerRole();
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

function fullName(u) {
  return [u.last_name, u.first_name, u.patronymic].filter(Boolean).join(' ');
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

async function loadTraining() {
  loadingTraining.value = true;
  try {
    const data = await apiFetch(`/course-trainings/${route.params.id}`);
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
    const data = await apiFetch(
      `/course-trainings/${route.params.id}/registrations?limit=1000`
    );
    list.value = data.registrations
      .filter((r) => r.role?.alias === 'LISTENER')
      .map((r) => ({ ...r, highlight: false }));
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
    const params = new URLSearchParams({ limit: 1000 });
    // Limit to referee roles only
    params.append('role', 'REFEREE');
    params.append('role', 'BRIGADE_REFEREE');
    const data = await apiFetch(`/course-users?${params.toString()}`);
    judges.value = data.users;
  } catch (_) {
    judges.value = [];
  }
}

async function loadListenerRole() {
  try {
    const data = await apiFetch('/training-roles?forCamp=false');
    const role = data.roles.find((r) => r.alias === 'LISTENER');
    listenerRoleId.value = role ? role.id : null;
  } catch (_) {
    listenerRoleId.value = null;
  }
}

async function addRegistration() {
  if (!addForm.value.user_id || !listenerRoleId.value) return;
  try {
    addLoading.value = true;
    await apiFetch(`/course-trainings/${route.params.id}/registrations`, {
      method: 'POST',
      body: JSON.stringify({
        user_id: addForm.value.user_id,
        training_role_id: listenerRoleId.value,
      }),
    });
    lastAddedUserId.value = addForm.value.user_id;
    addForm.value.user_id = '';
    await loadRegistrations();
    await loadTraining();
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
      `/course-trainings/${route.params.id}/registrations/${userId}`,
      { method: 'DELETE' }
    );
    await loadRegistrations();
    await loadTraining();
  } catch (e) {
    alert(e.message);
  }
}

async function setPresence(userId, value) {
  try {
    await apiFetch(
      `/course-trainings/${route.params.id}/registrations/${userId}/presence`,
      {
        method: 'PUT',
        body: JSON.stringify({ present: value }),
      }
    );
    await loadRegistrations();
  } catch (e) {
    alert(e.message);
  }
}

async function finish() {
  if (!allMarked.value) {
    alert('Отметьте посещаемость для всех участников');
    return;
  }
  try {
    finishLoading.value = true;
    await apiFetch(`/course-trainings/${route.params.id}/attendance`, {
      method: 'PUT',
      body: JSON.stringify({ attendance_marked: true }),
    });
    await loadTraining();
    finishError.value = '';
  } catch (e) {
    finishError.value = e.message;
  } finally {
    finishLoading.value = false;
  }
}

// Eligible but not registered (course-matched referees who haven't registered)
const eligibleNotRegistered = computed(() => {
  const registeredIds = new Set(list.value.map((r) => r.user.id));
  const courseIds = training.value?.courses?.map((c) => c.id) || [];
  return judges.value
    .filter((j) => j.course && courseIds.includes(j.course.id))
    .filter((j) => !registeredIds.has(j.user.id))
    .map((j) => j.user)
    .slice()
    .sort((a, b) => fullName(a).localeCompare(fullName(b), 'ru'));
});

// Pagination for eligible list
const eligiblePage = ref(1);
const eligiblePageSize = ref(loadPageSize('adminCourseEligiblePageSize', 8));
const eligibleTotalPages = computed(() =>
  Math.max(
    1,
    Math.ceil(eligibleNotRegistered.value.length / eligiblePageSize.value)
  )
);
const visibleEligible = computed(() => {
  const start = (eligiblePage.value - 1) * eligiblePageSize.value;
  return eligibleNotRegistered.value.slice(
    start,
    start + eligiblePageSize.value
  );
});

// Reset page to 1 when dataset changes
watch(
  () => eligibleNotRegistered.value.length,
  () => {
    eligiblePage.value = 1;
  }
);

// Keep page in bounds
watch(
  () => [eligibleTotalPages.value, eligiblePageSize.value],
  () => {
    if (eligiblePage.value > eligibleTotalPages.value)
      eligiblePage.value = eligibleTotalPages.value;
  }
);
watch(
  () => eligiblePageSize.value,
  (val) => savePageSize('adminCourseEligiblePageSize', val)
);
</script>

<template>
  <div class="py-3 admin-training-registrations-page">
    <div class="container">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item">
            <RouterLink to="/admin/courses">Курсы</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">Участники</li>
        </ol>
      </nav>
      <h1 class="mb-3">Участники занятия</h1>
      <p v-if="training" class="mb-3">
        <strong>{{ training.type?.name }}</strong>
        <span v-if="training.teacher"> · {{ fullName(training.teacher) }}</span
        >,
        {{ formatDateTimeRange(training.start_at, training.end_at) }}
      </p>
      <div v-if="trainingError" class="alert alert-danger mb-3">
        {{ trainingError }}
      </div>
      <div v-if="error" class="alert alert-danger mb-3">{{ error }}</div>
      <div v-if="loading || loadingTraining" class="text-center my-3">
        <div
          class="spinner-border spinner-brand"
          role="status"
          aria-label="Загрузка"
        ></div>
      </div>
      <div class="row g-2 align-items-end mb-3">
        <div class="col-12 col-sm">
          <label class="form-label">Судья</label>
          <select v-model="addForm.user_id" class="form-select">
            <option value="" disabled>Выберите судью</option>
            <option
              v-for="j in filteredJudges"
              :key="j.user.id"
              :value="j.user.id"
            >
              {{ j.user.last_name }} {{ j.user.first_name }}
              {{ j.user.patronymic }}
            </option>
          </select>
        </div>
        <div class="col-12 col-sm-auto d-grid d-sm-block">
          <button
            class="btn btn-brand"
            :disabled="addLoading || !addForm.user_id"
            @click="addRegistration"
          >
            <span
              v-if="addLoading"
              class="spinner-border spinner-border-sm spinner-brand me-2"
            ></span>
            Добавить
          </button>
        </div>
      </div>
      <div v-if="list.length" class="card section-card tile fade-in shadow-sm">
        <div class="card-body">
          <div class="table-responsive d-none d-sm-block">
            <table class="table admin-table table-striped align-middle mb-0">
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th class="text-center">Посещение</th>
                  <th></th>
                </tr>
              </thead>
              <TransitionGroup tag="tbody" name="fade-list">
                <tr
                  v-for="r in list"
                  :key="r.user.id"
                  :class="{ highlight: r.highlight }"
                >
                  <td>
                    {{ r.user.last_name }} {{ r.user.first_name }}
                    {{ r.user.patronymic }}
                  </td>
                  <td class="text-center">
                    <div
                      class="btn-group btn-group-sm presence-group"
                      role="group"
                    >
                      <input
                        :id="`present-yes-${r.user.id}`"
                        type="radio"
                        class="btn-check"
                        :name="`present-${r.user.id}`"
                        autocomplete="off"
                        :checked="r.present === true"
                        :disabled="attendanceMarked"
                        @change="setPresence(r.user.id, true)"
                      />
                      <label
                        class="btn btn-outline-success presence-btn"
                        :for="`present-yes-${r.user.id}`"
                      >
                        <i class="bi bi-check-lg" aria-hidden="true"></i>
                        <span class="visually-hidden">Да</span>
                      </label>
                      <input
                        :id="`present-no-${r.user.id}`"
                        type="radio"
                        class="btn-check"
                        :name="`present-${r.user.id}`"
                        autocomplete="off"
                        :checked="r.present === false"
                        :disabled="attendanceMarked"
                        @change="setPresence(r.user.id, false)"
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
                      class="btn btn-sm btn-danger action-btn"
                      @click="removeRegistration(r.user.id)"
                    >
                      <i class="bi bi-x-lg" aria-hidden="true"></i>
                      <span class="visually-hidden">Удалить</span>
                    </button>
                  </td>
                </tr>
              </TransitionGroup>
            </table>
          </div>
          <div class="d-block d-sm-none">
            <div
              v-for="r in list"
              :key="r.user.id"
              :class="[
                'card',
                'registration-card',
                'mb-2',
                { highlight: r.highlight },
              ]"
            >
              <div class="card-body">
                <div class="fw-medium mb-1">
                  {{ r.user.last_name }} {{ r.user.first_name }}
                  {{ r.user.patronymic }}
                </div>
                <div class="d-flex align-items-center justify-content-between">
                  <div
                    class="btn-group btn-group-sm presence-group me-2"
                    role="group"
                  >
                    <input
                      :id="`present-yes-m-${r.user.id}`"
                      type="radio"
                      class="btn-check"
                      :name="`present-m-${r.user.id}`"
                      autocomplete="off"
                      :checked="r.present === true"
                      :disabled="attendanceMarked"
                      @change="setPresence(r.user.id, true)"
                    />
                    <label
                      class="btn btn-outline-success presence-btn"
                      :for="`present-yes-m-${r.user.id}`"
                    >
                      <i class="bi bi-check-lg" aria-hidden="true"></i>
                      <span class="visually-hidden">Да</span>
                    </label>
                    <input
                      :id="`present-no-m-${r.user.id}`"
                      type="radio"
                      class="btn-check"
                      :name="`present-m-${r.user.id}`"
                      autocomplete="off"
                      :checked="r.present === false"
                      :disabled="attendanceMarked"
                      @change="setPresence(r.user.id, false)"
                    />
                    <label
                      class="btn btn-outline-danger presence-btn"
                      :for="`present-no-m-${r.user.id}`"
                    >
                      <i class="bi bi-x-lg" aria-hidden="true"></i>
                      <span class="visually-hidden">Нет</span>
                    </label>
                  </div>
                  <div class="ms-auto text-end">
                    <button
                      class="btn btn-sm btn-danger action-btn"
                      @click="removeRegistration(r.user.id)"
                    >
                      <i class="bi bi-x-lg" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p v-else-if="!loading && !loadingTraining" class="text-muted mb-0">
        Нет записей.
      </p>
      <template v-if="!attendanceMarked">
        <button
          class="btn btn-brand mt-3"
          :disabled="!list.length || !allMarked || finishLoading"
          @click="finish"
        >
          <span
            v-if="finishLoading"
            class="spinner-border spinner-border-sm me-2"
          ></span>
          Сохранить
        </button>
        <div v-if="finishError" class="alert alert-danger mt-3">
          {{ finishError }}
        </div>
      </template>
      <p v-else class="alert alert-success mt-3">Посещаемость отмечена</p>

      <!-- Eligible but not registered list -->
      <div
        v-if="eligibleNotRegistered.length"
        class="card section-card tile fade-in shadow-sm mt-3"
      >
        <div class="card-body">
          <h2 class="h6 mb-3">Доступно к регистрации, но не записаны</h2>
          <div class="table-responsive d-none d-sm-block">
            <table class="table admin-table table-striped align-middle mb-0">
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th class="d-none d-md-table-cell">Телефон</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in visibleEligible" :key="u.id">
                  <td>{{ fullName(u) }}</td>
                  <td class="d-none d-md-table-cell">
                    {{ u.phone ? formatPhone(u.phone) : '' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="d-sm-none">
            <div v-for="u in visibleEligible" :key="u.id" class="mb-2">
              <div class="card registration-card">
                <div class="card-body">
                  <div class="fw-medium">{{ fullName(u) }}</div>
                  <div class="small text-muted">
                    {{ u.phone ? formatPhone(u.phone) : '' }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <PageNav
            v-if="eligibleTotalPages > 1"
            v-model:page="eligiblePage"
            v-model:page-size="eligiblePageSize"
            :total-pages="eligibleTotalPages"
            :sizes="[5, 8, 10, 20]"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.highlight {
  animation: highlightBg 2s ease-out;
}
.presence-group .presence-btn {
  width: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0;
}

.action-btn {
  width: 2.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0;
}

.registration-card {
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
}

@media (max-width: 575.98px) {
  .action-btn {
    width: 2rem;
  }

  .registration-card {
    margin-left: -0.5rem;
    margin-right: -0.5rem;
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
