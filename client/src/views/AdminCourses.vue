<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { RouterLink } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';
import BrandSpinner from '../components/BrandSpinner.vue';
import EmptyState from '../components/EmptyState.vue';
import { toDateTimeLocal, fromDateTimeLocal } from '../utils/time.js';

const activeTab = ref('assign');

const users = ref([]); // referees with course assignments
const allUsers = ref([]); // for responsible selector and teacher dropdown
const courses = ref([]);
const loadingUsers = ref(false);
const error = ref('');
const courseError = ref('');
const search = ref('');
let searchTimeout;
const filterRole = ref('');
const history = ref([]);
const historyLoading = ref(false);
const historyError = ref('');
const historyJudgeName = ref('');
const historyModalRef = ref(null);
let historyModal;
const sortOrder = ref('desc');
const sortedUsers = computed(() => {
  const data = [...users.value];
  data.sort((a, b) => {
    const av = a.training_stats.total
      ? a.training_stats.visited / a.training_stats.total
      : 0;
    const bv = b.training_stats.total
      ? b.training_stats.visited / b.training_stats.total
      : 0;
    return sortOrder.value === 'asc' ? av - bv : bv - av;
  });
  return data;
});

const courseForm = ref({
  name: '',
  description: '',
  responsible_id: '',
  telegram_url: '',
});
const editingCourse = ref(null);
const courseModalRef = ref(null);
let courseModal;
const courseFormError = ref('');
const courseSaveLoading = ref(false);

const trainingTypes = ref([]);
const trainingTypesLoaded = ref(false);
const typesError = ref('');

const trainings = ref([]);
const trainingsError = ref('');
const loadingTrainings = ref(false);
const grounds = ref([]);
const trainingForm = ref({
  type_id: '',
  ground_id: '',
  url: '',
  start_at: '',
  end_at: '',
  capacity: '',
  courses: [],
});
const editingTraining = ref(null);
const trainingModalRef = ref(null);
let trainingModal;
const trainingFormError = ref('');
const trainingSaveLoading = ref(false);
const trainingTypeRef = ref(null);
const trainingGroundRef = ref(null);
const trainingUrlRef = ref(null);
const selectedTrainingType = computed(() =>
  trainingTypes.value.find((t) => t.id === trainingForm.value.type_id)
);

const filter = ref({ type: '', teacher: '', course: '' });
const teachers = ref([]);
const teacherRoleId = ref(null);
const upcomingTrainings = computed(() => {
  const now = Date.now();
  return trainings.value.filter((t) => new Date(t.start_at).getTime() >= now);
});
const pastTrainings = computed(() => {
  const now = Date.now();
  return trainings.value.filter((t) => new Date(t.start_at).getTime() < now);
});

function fullName(u) {
  return [u.last_name, u.first_name, u.patronymic].filter(Boolean).join(' ');
}

function shortName(u) {
  return [
    u.last_name,
    [u.first_name, u.patronymic]
      .filter(Boolean)
      .map((n) => `${n[0]}.`)
      .join(' '),
  ]
    .filter(Boolean)
    .join(' ');
}

async function loadUsers() {
  loadingUsers.value = true;
  try {
    const params = new URLSearchParams({ limit: 1000 });
    if (filterRole.value) {
      params.append('role', filterRole.value);
    } else {
      params.append('role', 'REFEREE');
      params.append('role', 'BRIGADE_REFEREE');
    }
    if (search.value) params.append('search', search.value);
    const data = await apiFetch(`/course-users?${params.toString()}`);
    users.value = data.users.map((u) => ({
      ...u,
      course_id: u.course ? u.course.id : '',
    }));
  } catch (e) {
    error.value = e.message;
  } finally {
    loadingUsers.value = false;
  }
}

watch(search, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(loadUsers, 300);
});

watch(filterRole, loadUsers);

watch(activeTab, (val) => {
  if (val === 'trainings') {
    if (!trainingTypesLoaded.value) loadTrainingTypes();
    loadCourses();
    loadGrounds();
    loadTeacherRole();
    loadTeacherOptions();
    loadTrainingsAdmin();
  } else if (val === 'assign') {
    loadUsers();
    loadCourses();
  }
});

watch(
  () => filter.value.type,
  () => {
    if (activeTab.value === 'trainings') loadTrainingsAdmin();
  }
);
watch(
  () => filter.value.teacher,
  () => {
    if (activeTab.value === 'trainings') loadTrainingsAdmin();
  }
);
watch(
  () => filter.value.course,
  () => {
    if (activeTab.value === 'trainings') loadTrainingsAdmin();
  }
);

watch(
  () => trainingForm.value.type_id,
  (val) => {
    const tt = trainingTypes.value.find((t) => t.id === val);
    if (
      tt &&
      tt.default_capacity &&
      (!editingTraining.value || !trainingForm.value.capacity)
    ) {
      trainingForm.value.capacity = tt.default_capacity;
    }
    // Не сбрасываем ground/url при переключении типа, чтобы не терять ввод.
    // Ненужное поле будет проигнорировано при отправке.
  }
);

watch(
  () => trainingForm.value.start_at,
  (val) => {
    if (!val || editingTraining.value) return;
    const end = new Date(val);
    end.setMinutes(end.getMinutes() + 90);
    trainingForm.value.end_at = toDateTimeLocal(end.toISOString());
  }
);

async function loadAllUsers() {
  try {
    const data = await apiFetch('/users?limit=1000');
    allUsers.value = data.users;
  } catch (e) {
    error.value = e.message;
  }
}

async function loadCourses() {
  try {
    const data = await apiFetch('/courses?limit=1000');
    courses.value = data.courses;
  } catch (e) {
    error.value = e.message;
  }
}

async function loadTrainingTypes() {
  try {
    const data = await apiFetch('/course-training-types?limit=1000');
    trainingTypes.value = data.types;
    trainingTypesLoaded.value = true;
  } catch (e) {
    typesError.value = e.message;
  }
}

async function loadGrounds() {
  try {
    const data = await apiFetch('/grounds?limit=1000');
    grounds.value = data.grounds;
  } catch (e) {
    trainingsError.value = e.message;
  }
}

async function loadTeacherRole() {
  try {
    const data = await apiFetch('/training-roles?forCamp=false');
    const role = data.roles.find((r) => r.alias === 'TEACHER');
    teacherRoleId.value = role ? role.id : null;
  } catch (_) {
    teacherRoleId.value = null;
  }
}

async function loadTeacherOptions() {
  try {
    if (!allUsers.value.length) await loadAllUsers();
    teachers.value = allUsers.value;
  } catch (_) {
    teachers.value = [];
  }
}

async function loadTrainingsAdmin() {
  loadingTrainings.value = true;
  try {
    const params = new URLSearchParams({ limit: 1000 });
    if (filter.value.type) params.append('type_id', filter.value.type);
    if (filter.value.teacher) params.append('teacher_id', filter.value.teacher);
    if (filter.value.course) params.append('course_id', filter.value.course);
    const data = await apiFetch(`/course-trainings?${params}`);
    trainings.value = data.trainings.map((t) => ({
      ...t,
      teacher_id: t.teacher ? t.teacher.id : '',
    }));
  } catch (e) {
    trainingsError.value = e.message;
  } finally {
    loadingTrainings.value = false;
  }
}

async function assignTeacher(training) {
  try {
    if (!training.teacher_id) {
      if (training.teacher) {
        await apiFetch(
          `/course-trainings/${training.id}/registrations/${training.teacher.id}`,
          { method: 'DELETE' }
        );
      }
      await loadTrainingsAdmin();
      return;
    }
    await apiFetch(`/course-trainings/${training.id}/registrations`, {
      method: 'POST',
      body: JSON.stringify({
        user_id: training.teacher_id,
        training_role_id: teacherRoleId.value,
      }),
    });
    await loadTrainingsAdmin();
  } catch (e) {
    alert(e.message);
    training.teacher_id = training.teacher ? training.teacher.id : '';
    await loadTrainingsAdmin();
  }
}

async function openTrainingModal(training = null) {
  if (!trainingModal) {
    trainingModal = new Modal(trainingModalRef.value);
    try {
      trainingModalRef.value.addEventListener('shown.bs.modal', () => {
        // Set initial focus for better UX
        const el = trainingTypeRef.value || trainingGroundRef.value || trainingUrlRef.value;
        if (el && typeof el.focus === 'function') el.focus();
      });
    } catch {}
  }
  // Ensure reference lists are loaded
  if (!trainingTypesLoaded.value) await loadTrainingTypes();
  if (!grounds.value.length) await loadGrounds();
  if (!courses.value.length) await loadCourses();
  if (training) {
    editingTraining.value = training;
    trainingForm.value = {
      type_id: training.type_id || training.type?.id || '',
      ground_id: training.ground_id || '',
      url: training.url || '',
      start_at: toDateTimeLocal(training.start_at),
      end_at: toDateTimeLocal(training.end_at),
      capacity: training.capacity || '',
      courses: training.courses ? training.courses.map((c) => c.id).filter(Boolean) : [],
    };
  } else {
    editingTraining.value = null;
    trainingForm.value = {
      type_id: '',
      ground_id: '',
      url: '',
      start_at: '',
      end_at: '',
      capacity: '',
      courses: [],
    };
  }
  trainingFormError.value = '';
  trainingModal.show();
}

async function saveTraining() {
  trainingSaveLoading.value = true;
  try {
    // Базовая валидация формы для предотвращения 400
    trainingFormError.value = '';
    const tt = selectedTrainingType.value;
    if (!trainingForm.value.type_id) {
      throw new Error('Укажите тип мероприятия');
    }
    if (!trainingForm.value.start_at) {
      throw new Error('Укажите дату и время начала');
    }
    if (!trainingForm.value.end_at) {
      throw new Error('Укажите дату и время окончания');
    }
    const startISO = fromDateTimeLocal(trainingForm.value.start_at);
    const endISO = fromDateTimeLocal(trainingForm.value.end_at);
    if (!startISO || !endISO || new Date(endISO) <= new Date(startISO)) {
      throw new Error('Время окончания должно быть позже начала');
    }
    if (tt?.online) {
      if (!trainingForm.value.url)
        throw new Error('Укажите ссылку для онлайн‑мероприятия');
    } else {
      if (!trainingForm.value.ground_id) throw new Error('Выберите площадку');
    }

    const method = editingTraining.value ? 'PUT' : 'POST';
    const url = editingTraining.value
      ? `/course-trainings/${editingTraining.value.id}`
      : '/course-trainings';
    const courseIds = Array.isArray(trainingForm.value.courses)
      ? trainingForm.value.courses.filter((id) => typeof id === 'string' && id.length > 0)
      : [];
    const capacityValue =
      trainingForm.value.capacity === '' || trainingForm.value.capacity === null
        ? undefined
        : trainingForm.value.capacity;
    const body = {
      type_id: trainingForm.value.type_id,
      start_at: startISO,
      end_at: endISO,
      capacity: capacityValue,
      courses: courseIds,
      ...(selectedTrainingType.value?.online
        ? { url: trainingForm.value.url || undefined }
        : { ground_id: trainingForm.value.ground_id || undefined }),
    };
    await apiFetch(url, {
      method,
      body: JSON.stringify(body),
    });
    trainingModal.hide();
    await loadTrainingsAdmin();
  } catch (e) {
    trainingFormError.value = e.message;
  } finally {
    trainingSaveLoading.value = false;
  }
}

async function deleteTraining(id) {
  if (!confirm('Удалить мероприятие?')) return;
  try {
    await apiFetch(`/course-trainings/${id}`, { method: 'DELETE' });
    await loadTrainingsAdmin();
  } catch (e) {
    alert(e.message);
  }
}

async function setCourse(u) {
  try {
    if (!u.course_id) {
      await apiFetch(`/course-users/${u.user.id}`, { method: 'DELETE' });
    } else {
      await apiFetch(`/course-users/${u.user.id}`, {
        method: 'POST',
        body: JSON.stringify({ course_id: u.course_id }),
      });
    }
  } catch (e) {
    alert(e.message);
  }
}

function formatName(u) {
  return `${u.last_name} ${u.first_name} ${u.patronymic || ''}`.trim();
}

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

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

function presenceIcon(val) {
  if (val === true) return 'bi-check-lg text-success';
  if (val === false) return 'bi-x-lg text-danger';
  return 'bi-question-lg text-muted';
}

function presenceTitle(val) {
  if (val === true) return 'Присутствовал';
  if (val === false) return 'Отсутствовал';
  return 'Не отмечено';
}

function toggleSort() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
}

async function openHistory(u) {
  historyJudgeName.value = formatName(u.user);
  history.value = [];
  historyLoading.value = true;
  historyError.value = '';
  historyModal.show();
  try {
    const params = new URLSearchParams({ page: 1, limit: 50 });
    const data = await apiFetch(
      `/course-trainings/users/${u.user.id}/history?${params}`
    );
    history.value = data.trainings || [];
  } catch (e) {
    historyError.value = e.message;
  } finally {
    historyLoading.value = false;
  }
}

function openCourseModal(course = null) {
  if (!courseModal) {
    courseModal = new Modal(courseModalRef.value);
  }
  if (course) {
    editingCourse.value = course;
    courseForm.value = {
      name: course.name,
      description: course.description || '',
      responsible_id: course.responsible_id,
      telegram_url: course.telegram_url || '',
    };
  } else {
    editingCourse.value = null;
    courseForm.value = {
      name: '',
      description: '',
      responsible_id: '',
      telegram_url: '',
    };
  }
  courseFormError.value = '';
  courseModal.show();
}

async function saveCourse() {
  courseSaveLoading.value = true;
  try {
    const body = JSON.stringify(courseForm.value);
    let data;
    if (editingCourse.value) {
      data = await apiFetch(`/courses/${editingCourse.value.id}`, {
        method: 'PUT',
        body,
      });
      const idx = courses.value.findIndex(
        (c) => c.id === editingCourse.value.id
      );
      if (idx !== -1) courses.value[idx] = data.course;
    } else {
      data = await apiFetch('/courses', { method: 'POST', body });
      courses.value.push(data.course);
    }
    courseModal.hide();
  } catch (e) {
    courseFormError.value = e.message;
  } finally {
    courseSaveLoading.value = false;
  }
}

async function deleteCourse(id) {
  if (!confirm('Удалить курс?')) return;
  try {
    await apiFetch(`/courses/${id}`, { method: 'DELETE' });
    courses.value = courses.value.filter((c) => c.id !== id);
  } catch (e) {
    courseError.value = e.message;
  }
}

onMounted(() => {
  historyModal = new Modal(historyModalRef.value);
  loadUsers();
  loadAllUsers();
  loadCourses();
});

onBeforeUnmount(() => {
  try {
    clearTimeout(searchTimeout);
  } catch {}
  try {
    trainingModal?.hide?.();
    trainingModal?.dispose?.();
  } catch {}
  try {
    courseModal?.hide?.();
    courseModal?.dispose?.();
  } catch {}
  try {
    historyModal?.hide?.();
    historyModal?.dispose?.();
  } catch {}
});
</script>

<template>
  <div class="py-4">
    <div class="container admin-courses-page">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink to="/admin">Администрирование</RouterLink>
          </li>
          <li class="breadcrumb-item active" aria-current="page">
            Мероприятия
          </li>
        </ol>
      </nav>
      <h1 class="mb-3">Мероприятия</h1>
      <div class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body p-2">
          <ul
            v-edge-fade
            class="nav nav-pills nav-fill justify-content-between mb-0 tab-selector"
            role="tablist"
          >
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: activeTab === 'assign' }"
                role="tab"
                :aria-selected="activeTab === 'assign'"
                @click="activeTab = 'assign'"
              >
                Список судей
              </button>
            </li>
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: activeTab === 'courses' }"
                role="tab"
                :aria-selected="activeTab === 'courses'"
                @click="activeTab = 'courses'"
              >
                Курсы
              </button>
            </li>
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: activeTab === 'trainings' }"
                role="tab"
                :aria-selected="activeTab === 'trainings'"
                @click="activeTab = 'trainings'"
              >
                Мероприятия
              </button>
            </li>
          </ul>
        </div>
      </div>

        <div
          ref="historyModalRef"
          class="modal fade"
          tabindex="-1"
          role="dialog"
          aria-modal="true"
          data-bs-backdrop="static"
          data-bs-keyboard="false"
        >
          <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header">
                <h2 class="modal-title h5">
                  История посещений — {{ historyJudgeName }}
                </h2>
              <button
                type="button"
                class="btn-close"
                aria-label="Закрыть"
                @click="historyModal.hide()"
              ></button>
            </div>
            <div class="modal-body">
              <div v-if="historyError" class="alert alert-danger">
                {{ historyError }}
              </div>
              <div v-if="historyLoading" class="text-center my-3">
                <div class="spinner-border" role="status"></div>
              </div>
              <div v-if="history.length">
                <div class="table-responsive d-none d-sm-block">
                  <table class="table table-striped align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Время</th>
                        <th>Тренер</th>
                        <th>Тип</th>
                        <th>Стадион</th>
                        <th class="text-center">Факт</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="t in history" :key="t.id">
                        <td>{{ formatDateTimeRange(t.start_at, t.end_at) }}</td>
                        <td>
                          {{
                            t.coaches?.length ? formatName(t.coaches[0]) : ''
                          }}
                        </td>
                        <td>{{ t.type?.name }}</td>
                        <td>{{ t.ground?.name }}</td>
                        <td class="text-center">
                          <i
                            :class="presenceIcon(t.my_presence)"
                            :title="presenceTitle(t.my_presence)"
                          ></i>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="d-block d-sm-none">
                  <div
                    v-for="t in history"
                    :key="t.id"
                    class="card training-card mb-2"
                  >
                    <div class="card-body p-2">
                      <p class="mb-1 fw-semibold">
                        {{ formatDateTimeRange(t.start_at, t.end_at) }}
                      </p>
                      <p class="mb-1">
                        {{ t.coaches?.length ? formatName(t.coaches[0]) : '' }}
                      </p>
                      <p class="mb-1">{{ t.type?.name }}</p>
                      <p class="mb-1">{{ t.ground?.name }}</p>
                      <p class="mb-0 text-center">
                        <i
                          :class="presenceIcon(t.my_presence)"
                          :title="presenceTitle(t.my_presence)"
                        ></i>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <p v-else-if="!historyLoading" class="text-muted mb-0">
                История пуста.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'assign'">
        <div class="card section-card mb-3">
          <div class="card-body">
            <h2 class="card-title h5 mb-3">Список судей</h2>
            <div class="row g-2 mb-3">
              <div class="col-sm">
                <input
                  v-model="search"
                  type="search"
                  class="form-control"
                  placeholder="Поиск судьи"
                />
              </div>
              <div class="col-sm">
                <select v-model="filterRole" class="form-select">
                  <option value="">Все роли</option>
                  <option value="REFEREE">Судья в поле</option>
                  <option value="BRIGADE_REFEREE">Судья в бригаде</option>
                </select>
              </div>
            </div>
            <BrandSpinner v-if="loadingUsers" label="Загрузка" />
            <div v-else-if="error" class="alert alert-danger">{{ error }}</div>
            <div
              v-else-if="sortedUsers.length"
              class="table-responsive d-none d-sm-block"
            >
              <table class="table admin-table table-striped align-middle mb-0">
                <thead>
                  <tr>
                    <th>ФИО</th>
                    <th class="text-center">Дата рождения</th>
                    <th class="text-center">Курс</th>
                    <th class="text-center sortable" @click="toggleSort">
                      Мероприятия
                      <i
                        :class="[
                          sortOrder === 'asc'
                            ? 'bi bi-caret-up-fill'
                            : 'bi bi-caret-down-fill',
                          'icon-brand',
                        ]"
                      ></i>
                    </th>
                    <th class="text-center">История</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="u in sortedUsers" :key="u.user.id">
                    <td>{{ formatName(u.user) }}</td>
                    <td class="text-center">
                      {{ formatDate(u.user.birth_date) }}
                    </td>
                    <td class="text-center">
                      <select
                        v-model="u.course_id"
                        class="form-select"
                        @change="setCourse(u)"
                      >
                        <option value="">Без курса</option>
                        <option v-for="c in courses" :key="c.id" :value="c.id">
                          {{ c.name }}
                        </option>
                      </select>
                    </td>
                    <td class="text-center">
                      {{ u.training_stats.visited }} /
                      {{ u.training_stats.total }}
                      <span v-if="u.training_stats.total">
                        ({{
                          Math.round(
                            (u.training_stats.visited /
                              u.training_stats.total) *
                              100
                          )
                        }}%)
                      </span>
                    </td>
                    <td class="text-center">
                      <button
                        class="btn btn-sm btn-outline-secondary"
                        aria-label="История посещений"
                        @click="openHistory(u)"
                      >
                        <i class="bi bi-clock-history"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <EmptyState
              v-else
              icon="bi-people"
              title="Судьи не найдены"
              description="Измените фильтры или попробуйте позже"
            />
            <div v-if="sortedUsers.length" class="d-block d-sm-none">
              <div v-for="u in sortedUsers" :key="u.user.id" class="card mb-2">
                <div class="card-body">
                  <p class="mb-1 fw-semibold">{{ formatName(u.user) }}</p>
                  <p class="mb-1 text-muted">
                    {{ formatDate(u.user.birth_date) }}
                  </p>
                  <select
                    v-model="u.course_id"
                    class="form-select mt-1"
                    @change="setCourse(u)"
                  >
                    <option value="">Без курса</option>
                    <option v-for="c in courses" :key="c.id" :value="c.id">
                      {{ c.name }}
                    </option>
                  </select>
                  <p class="mb-0 mt-1">
                    {{ u.training_stats.visited }} /
                    {{ u.training_stats.total }}
                    <span v-if="u.training_stats.total">
                      ({{
                        Math.round(
                          (u.training_stats.visited / u.training_stats.total) *
                            100
                        )
                      }}%)
                    </span>
                  </p>
                  <div class="text-end mt-1">
                    <button
                      class="btn btn-sm btn-outline-secondary"
                      aria-label="История посещений"
                      @click="openHistory(u)"
                    >
                      <i class="bi bi-clock-history"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'courses'">
        <div class="card section-card mb-3">
          <div class="card-body">
            <div v-if="courseError" class="alert alert-danger mb-3">
              {{ courseError }}
            </div>
            <div class="table-responsive d-none d-sm-block">
              <table class="table admin-table table-striped align-middle mb-0">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th class="d-none d-md-table-cell">Ответственный</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in courses" :key="c.id">
                    <td>{{ c.name }}</td>
                    <td class="d-none d-md-table-cell">
                      {{
                        c.responsible
                          ? `${c.responsible.last_name} ${c.responsible.first_name}`
                          : ''
                      }}
                    </td>
                    <td class="text-end">
                      <button
                        class="btn btn-sm btn-primary me-2"
                        aria-label="Редактировать курс"
                        @click="openCourseModal(c)"
                      >
                        <i class="bi bi-pencil" aria-hidden="true"></i>
                      </button>
                      <button
                        class="btn btn-sm btn-danger"
                        aria-label="Удалить курс"
                        @click="deleteCourse(c.id)"
                      >
                        <i class="bi bi-trash" aria-hidden="true"></i>
                      </button>
                    </td>
                  </tr>
                  <tr v-if="courses.length === 0">
                    <td colspan="3" class="text-center text-muted">
                      Нет курсов
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="d-sm-none">
              <ul class="list-group">
                <li
                  v-for="c in courses"
                  :key="c.id"
                  class="list-group-item d-flex justify-content-between align-items-center"
                >
                  <div>
                    <div>{{ c.name }}</div>
                    <small v-if="c.responsible" class="text-muted">
                      {{
                        c.responsible.last_name + ' ' + c.responsible.first_name
                      }}
                    </small>
                  </div>
                  <div class="btn-group btn-group-sm">
                    <button
                      class="btn btn-primary"
                      aria-label="Редактировать курс"
                      @click="openCourseModal(c)"
                    >
                      <i class="bi bi-pencil" aria-hidden="true"></i>
                    </button>
                    <button
                      class="btn btn-danger"
                      aria-label="Удалить курс"
                      @click="deleteCourse(c.id)"
                    >
                      <i class="bi bi-trash" aria-hidden="true"></i>
                    </button>
                  </div>
                </li>
                <li
                  v-if="courses.length === 0"
                  class="list-group-item text-muted"
                >
                  Нет курсов
                </li>
              </ul>
            </div>
            <button class="btn btn-brand mt-3" @click="openCourseModal()">
              Добавить курс
            </button>
          </div>
        </div>

        <div
          ref="courseModalRef"
          class="modal fade"
          tabindex="-1"
          role="dialog"
          aria-modal="true"
          data-bs-backdrop="static"
          data-bs-keyboard="false"
        >
          <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">
                  {{ editingCourse ? 'Редактировать курс' : 'Новый курс' }}
                </h5>
                <button
                  type="button"
                  class="btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                ></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <label class="form-label">Название</label>
                  <input
                    v-model="courseForm.name"
                    type="text"
                    class="form-control"
                  />
                </div>
                <div class="mb-3">
                  <label class="form-label">Описание</label>
                  <textarea
                    v-model="courseForm.description"
                    class="form-control"
                    rows="3"
                  ></textarea>
                </div>
                <div class="mb-3">
                  <label class="form-label">Ответственный</label>
                  <select
                    v-model="courseForm.responsible_id"
                    class="form-select"
                  >
                    <option value="">Выберите пользователя</option>
                    <option v-for="u in allUsers" :key="u.id" :value="u.id">
                      {{ u.last_name }} {{ u.first_name }}
                    </option>
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label">Ссылка на чат</label>
                  <input
                    v-model="courseForm.telegram_url"
                    type="url"
                    class="form-control"
                  />
                </div>
                <div v-if="courseFormError" class="alert alert-danger">
                  {{ courseFormError }}
                </div>
              </div>
              <div class="modal-footer">
                <button
                  type="button"
                  class="btn btn-secondary"
                  data-bs-dismiss="modal"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  class="btn btn-brand"
                  :disabled="courseSaveLoading"
                  @click="saveCourse"
                >
                  <span
                    v-if="courseSaveLoading"
                    class="spinner-border spinner-border-sm me-2"
                  ></span>
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'trainings'">
        <div class="card section-card mb-3">
          <div class="card-body">
            <div v-if="trainingsError" class="alert alert-danger mb-3">
              {{ trainingsError }}
            </div>
            <div class="row g-2 mb-3">
              <div class="col-md-4">
                <select v-model="filter.type" class="form-select">
                  <option value="">Все типы</option>
                  <option
                    v-for="tt in trainingTypes"
                    :key="tt.id"
                    :value="tt.id"
                  >
                    {{ tt.name }}
                  </option>
                </select>
              </div>
              <div class="col-md-4">
                <select v-model="filter.teacher" class="form-select">
                  <option value="">Все преподаватели</option>
                  <option v-for="t in teachers" :key="t.id" :value="t.id">
                    {{ shortName(t) }}
                  </option>
                </select>
              </div>
              <div class="col-md-4">
                <select v-model="filter.course" class="form-select">
                  <option value="">Все курсы</option>
                  <option value="none">Без курса</option>
                  <option v-for="c in courses" :key="c.id" :value="c.id">
                    {{ c.name }}
                  </option>
                </select>
              </div>
            </div>

            <h2 class="h5 mb-3">Будущие</h2>
            <div
              v-if="upcomingTrainings.length"
              class="table-responsive d-none d-sm-block"
            >
              <table class="table admin-table table-striped align-middle mb-0">
                <thead>
                  <tr>
                    <th>Начало</th>
                    <th class="d-none d-md-table-cell">Тип</th>
                    <th class="d-none d-md-table-cell">Преподаватель</th>
                    <th class="d-none d-md-table-cell">Курсы</th>
                    <th class="text-center">Запись</th>
                    <th class="text-center">Посещ.</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="t in upcomingTrainings" :key="t.id">
                    <td>
                      {{
                        new Date(t.start_at).toLocaleString('ru-RU', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                          timeZone: 'Europe/Moscow',
                        })
                      }}
                    </td>
                    <td class="d-none d-md-table-cell">{{ t.type?.name }}</td>
                    <td class="d-none d-md-table-cell">
                      <select
                        v-model="t.teacher_id"
                        class="form-select form-select-sm"
                        @change="assignTeacher(t)"
                      >
                        <option value="">Без преподавателя</option>
                        <option v-for="u in teachers" :key="u.id" :value="u.id">
                          {{ shortName(u) }}
                        </option>
                      </select>
                    </td>
                    <td class="d-none d-md-table-cell">
                      {{ t.courses.map((c) => c.name).join(', ') }}
                    </td>
                    <td class="text-center">{{ t.registered_count }}</td>
                    <td class="text-center">
                      <i
                        v-if="t.attendance_marked"
                        class="bi bi-check-circle text-success"
                        aria-label="Отмечено"
                      ></i>
                      <i
                        v-else
                        class="bi bi-dash-circle text-muted"
                        aria-label="Не отмечено"
                      ></i>
                    </td>
                    <td class="text-end">
                      <RouterLink
                        :to="`/admin/course-trainings/${t.id}/registrations`"
                        class="btn btn-sm btn-primary me-2"
                        aria-label="Регистрации"
                      >
                        <i class="bi bi-people" aria-hidden="true"></i>
                      </RouterLink>
                      <button
                        class="btn btn-sm btn-secondary me-2"
                        aria-label="Редактировать мероприятие"
                        @click="openTrainingModal(t)"
                      >
                        <i class="bi bi-pencil" aria-hidden="true"></i>
                      </button>
                      <button
                        class="btn btn-sm btn-danger"
                        aria-label="Удалить мероприятие"
                        @click="deleteTraining(t.id)"
                      >
                        <i class="bi bi-trash" aria-hidden="true"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="alert alert-info mb-3">
              Нет будущих мероприятий
            </div>
            <div v-if="upcomingTrainings.length" class="d-sm-none">
              <ul class="list-group">
                <li
                  v-for="t in upcomingTrainings"
                  :key="t.id"
                  class="list-group-item d-flex justify-content-between align-items-center"
                >
                  <div>
                    <div>
                      {{
                        new Date(t.start_at).toLocaleString('ru-RU', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                          timeZone: 'Europe/Moscow',
                        })
                      }}
                    </div>
                    <small class="text-muted d-block">{{ t.type?.name }}</small>
                    <select
                      v-model="t.teacher_id"
                      class="form-select form-select-sm mb-1"
                      @change="assignTeacher(t)"
                    >
                      <option value="">Без преподавателя</option>
                      <option v-for="u in teachers" :key="u.id" :value="u.id">
                        {{ shortName(u) }}
                      </option>
                    </select>
                    <small class="text-muted d-block">{{
                      t.courses.map((c) => c.name).join(', ')
                    }}</small>
                    <small class="text-muted d-block"
                      >Запись: {{ t.registered_count }}, Посещ.:
                      {{ t.attendance_marked ? '✓' : '—' }}</small
                    >
                  </div>
                  <div class="btn-group btn-group-sm">
                    <RouterLink
                      :to="`/admin/course-trainings/${t.id}/registrations`"
                      class="btn btn-primary"
                      aria-label="Регистрации"
                    >
                      <i class="bi bi-people" aria-hidden="true"></i>
                    </RouterLink>
                    <button
                      class="btn btn-secondary"
                      aria-label="Редактировать мероприятие"
                      @click="openTrainingModal(t)"
                    >
                      <i class="bi bi-pencil" aria-hidden="true"></i>
                    </button>
                    <button
                      class="btn btn-danger"
                      aria-label="Удалить мероприятие"
                      @click="deleteTraining(t.id)"
                    >
                      <i class="bi bi-trash" aria-hidden="true"></i>
                    </button>
                  </div>
                </li>
              </ul>
            </div>
            <div v-else class="d-sm-none mb-3 text-muted text-center">
              Нет будущих мероприятий
            </div>

            <h2 class="h5 mb-3 mt-4">Прошедшие</h2>
            <div
              v-if="pastTrainings.length"
              class="table-responsive d-none d-sm-block"
            >
              <table class="table admin-table table-striped align-middle mb-0">
                <thead>
                  <tr>
                    <th>Начало</th>
                    <th class="d-none d-md-table-cell">Тип</th>
                    <th class="d-none d-md-table-cell">Преподаватель</th>
                    <th class="d-none d-md-table-cell">Курсы</th>
                    <th class="text-center">Запись</th>
                    <th class="text-center">Посещ.</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="t in pastTrainings" :key="t.id">
                    <td>
                      {{
                        new Date(t.start_at).toLocaleString('ru-RU', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                          timeZone: 'Europe/Moscow',
                        })
                      }}
                    </td>
                    <td class="d-none d-md-table-cell">{{ t.type?.name }}</td>
                    <td class="d-none d-md-table-cell">
                      <select
                        v-model="t.teacher_id"
                        class="form-select form-select-sm"
                        @change="assignTeacher(t)"
                      >
                        <option value="">Без преподавателя</option>
                        <option v-for="u in teachers" :key="u.id" :value="u.id">
                          {{ shortName(u) }}
                        </option>
                      </select>
                    </td>
                    <td class="d-none d-md-table-cell">
                      {{ t.courses.map((c) => c.name).join(', ') }}
                    </td>
                    <td class="text-center">{{ t.registered_count }}</td>
                    <td class="text-center">
                      <i
                        v-if="t.attendance_marked"
                        class="bi bi-check-circle text-success"
                        aria-label="Отмечено"
                      ></i>
                      <i
                        v-else
                        class="bi bi-dash-circle text-muted"
                        aria-label="Не отмечено"
                      ></i>
                    </td>
                    <td class="text-end">
                      <RouterLink
                        :to="`/admin/course-trainings/${t.id}/registrations`"
                        class="btn btn-sm btn-primary me-2"
                        aria-label="Регистрации"
                      >
                        <i class="bi bi-people" aria-hidden="true"></i>
                      </RouterLink>
                      <button
                        class="btn btn-sm btn-secondary me-2"
                        aria-label="Редактировать мероприятие"
                        @click="openTrainingModal(t)"
                      >
                        <i class="bi bi-pencil" aria-hidden="true"></i>
                      </button>
                      <button
                        class="btn btn-sm btn-danger"
                        aria-label="Удалить мероприятие"
                        @click="deleteTraining(t.id)"
                      >
                        <i class="bi bi-trash" aria-hidden="true"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="alert alert-info mb-3">
              Нет прошедших мероприятий
            </div>
            <div v-if="pastTrainings.length" class="d-sm-none">
              <ul class="list-group">
                <li
                  v-for="t in pastTrainings"
                  :key="t.id"
                  class="list-group-item d-flex justify-content-between align-items-center"
                >
                  <div>
                    <div>
                      {{
                        new Date(t.start_at).toLocaleString('ru-RU', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                          timeZone: 'Europe/Moscow',
                        })
                      }}
                    </div>
                    <small class="text-muted d-block">{{ t.type?.name }}</small>
                    <select
                      v-model="t.teacher_id"
                      class="form-select form-select-sm mb-1"
                      @change="assignTeacher(t)"
                    >
                      <option value="">Без преподавателя</option>
                      <option v-for="u in teachers" :key="u.id" :value="u.id">
                        {{ shortName(u) }}
                      </option>
                    </select>
                    <small class="text-muted d-block">{{
                      t.courses.map((c) => c.name).join(', ')
                    }}</small>
                    <small class="text-muted d-block"
                      >Запись: {{ t.registered_count }}, Посещ.:
                      {{ t.attendance_marked ? '✓' : '—' }}</small
                    >
                  </div>
                  <div class="btn-group btn-group-sm">
                    <RouterLink
                      :to="`/admin/course-trainings/${t.id}/registrations`"
                      class="btn btn-primary"
                      aria-label="Регистрации"
                    >
                      <i class="bi bi-people" aria-hidden="true"></i>
                    </RouterLink>
                    <button
                      class="btn btn-secondary"
                      aria-label="Редактировать мероприятие"
                      @click="openTrainingModal(t)"
                    >
                      <i class="bi bi-pencil" aria-hidden="true"></i>
                    </button>
                    <button
                      class="btn btn-danger"
                      aria-label="Удалить мероприятие"
                      @click="deleteTraining(t.id)"
                    >
                      <i class="bi bi-trash" aria-hidden="true"></i>
                    </button>
                  </div>
                </li>
              </ul>
            </div>
            <div v-else class="d-sm-none mb-3 text-muted text-center">
              Нет прошедших мероприятий
            </div>

            <button class="btn btn-brand mt-3" @click="openTrainingModal()">
              Добавить мероприятие
            </button>
          </div>
        </div>

        <div
          ref="trainingModalRef"
          class="modal fade"
          tabindex="-1"
          role="dialog"
          aria-modal="true"
          data-bs-backdrop="static"
          data-bs-keyboard="false"
        >
          <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">
                  {{
                    editingTraining
                      ? 'Редактировать мероприятие'
                      : 'Новое мероприятие'
                  }}
                </h5>
                <button
                  type="button"
                  class="btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                ></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <label class="form-label">Тип</label>
                  <select
                    ref="trainingTypeRef"
                    v-model="trainingForm.type_id"
                    class="form-select"
                  >
                    <option value="">Выберите тип</option>
                    <option
                      v-for="tt in trainingTypes"
                      :key="tt.id"
                      :value="tt.id"
                    >
                      {{ tt.name }}
                    </option>
                  </select>
                </div>
                <div class="mb-3" v-show="selectedTrainingType?.online">
                  <label class="form-label">Ссылка</label>
                  <input
                    ref="trainingUrlRef"
                    v-model="trainingForm.url"
                    type="url"
                    class="form-control"
                    :disabled="!selectedTrainingType?.online"
                  />
                </div>
                <div class="mb-3" v-show="!selectedTrainingType?.online">
                  <label class="form-label">Площадка</label>
                  <select
                    ref="trainingGroundRef"
                    v-model="trainingForm.ground_id"
                    class="form-select"
                    :disabled="selectedTrainingType?.online"
                  >
                    <option value="">Выберите площадку</option>
                    <option v-for="g in grounds" :key="g.id" :value="g.id">
                      {{ g.name }}
                    </option>
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label">Начало</label>
                  <input
                    v-model="trainingForm.start_at"
                    type="datetime-local"
                    class="form-control"
                  />
                </div>
                <div class="mb-3">
                  <label class="form-label">Окончание</label>
                  <input
                    v-model="trainingForm.end_at"
                    type="datetime-local"
                    class="form-control"
                  />
                </div>
                <div class="mb-3">
                  <label class="form-label">Вместимость</label>
                  <input
                    v-model.number="trainingForm.capacity"
                    type="number"
                    min="0"
                    class="form-control"
                  />
                </div>
                <div class="mb-3">
                  <label class="form-label">Курсы</label>
                  <select
                    v-model="trainingForm.courses"
                    multiple
                    class="form-select"
                  >
                    <option v-for="c in courses" :key="c.id" :value="c.id">
                      {{ c.name }}
                    </option>
                  </select>
                </div>
                <div v-if="trainingFormError" class="alert alert-danger">
                  {{ trainingFormError }}
                </div>
              </div>
              <div class="modal-footer">
                <button
                  type="button"
                  class="btn btn-secondary"
                  data-bs-dismiss="modal"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  class="btn btn-brand"
                  :disabled="trainingSaveLoading"
                  @click="saveTraining"
                >
                  <span
                    v-if="trainingSaveLoading"
                    class="spinner-border spinner-border-sm me-2"
                  ></span>
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}
.tab-selector {
  gap: 0.5rem;
}
.tab-selector .nav-link {
  border-radius: 0.5rem;
}
</style>
