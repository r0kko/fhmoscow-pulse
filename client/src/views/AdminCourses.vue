<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { RouterLink } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';
import { toDateTimeLocal, fromDateTimeLocal } from '../utils/time.js';

const activeTab = ref('assign');

const users = ref([]); // referees with course assignments
const allUsers = ref([]); // for responsible selector
const courses = ref([]);
const loadingUsers = ref(false);
const error = ref('');
const courseError = ref('');
const search = ref('');
let searchTimeout;

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
const selectedTrainingType = computed(() =>
  trainingTypes.value.find((t) => t.id === trainingForm.value.type_id)
);

const filter = ref({ type: '', teacher: '', course: '' });
const teacherOptions = computed(() => {
  const map = new Map();
  trainings.value.forEach((t) => {
    if (t.teacher) map.set(t.teacher.id, t.teacher);
  });
  return Array.from(map.values());
});
const filteredTrainings = computed(() =>
  trainings.value.filter((t) => {
    if (filter.value.type && t.type?.id !== filter.value.type) return false;
    if (filter.value.teacher && t.teacher?.id !== filter.value.teacher)
      return false;
    if (
      filter.value.course &&
      !t.courses?.some((c) => c.id === filter.value.course)
    )
      return false;
    return true;
  })
);
const upcomingTrainings = computed(() => {
  const now = Date.now();
  return filteredTrainings.value.filter(
    (t) => new Date(t.start_at).getTime() >= now
  );
});
const pastTrainings = computed(() => {
  const now = Date.now();
  return filteredTrainings.value.filter(
    (t) => new Date(t.start_at).getTime() < now
  );
});

function fullName(u) {
  return [u.last_name, u.first_name, u.patronymic].filter(Boolean).join(' ');
}

async function loadUsers() {
  loadingUsers.value = true;
  try {
    const params = new URLSearchParams({ limit: 1000 });
    params.append('role', 'REFEREE');
    params.append('role', 'BRIGADE_REFEREE');
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

watch(activeTab, (val) => {
  if (val === 'trainings') {
    if (!trainingTypesLoaded.value) loadTrainingTypes();
    loadCourses();
    loadGrounds();
    loadTrainingsAdmin();
  }
});

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
    if (tt?.online) {
      trainingForm.value.ground_id = '';
    } else {
      trainingForm.value.url = '';
    }
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

async function loadTrainingsAdmin() {
  loadingTrainings.value = true;
  try {
    const data = await apiFetch('/course-trainings?limit=1000');
    trainings.value = data.trainings;
  } catch (e) {
    trainingsError.value = e.message;
  } finally {
    loadingTrainings.value = false;
  }
}

function openTrainingModal(training = null) {
  if (!trainingModal) {
    trainingModal = new Modal(trainingModalRef.value);
  }
  if (training) {
    editingTraining.value = training;
    trainingForm.value = {
      type_id: training.type_id || training.type?.id || '',
      ground_id: training.ground_id || '',
      url: training.url || '',
      start_at: toDateTimeLocal(training.start_at),
      end_at: toDateTimeLocal(training.end_at),
      capacity: training.capacity || '',
      courses: training.courses ? training.courses.map((c) => c.id) : [],
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
    const method = editingTraining.value ? 'PUT' : 'POST';
    const url = editingTraining.value
      ? `/course-trainings/${editingTraining.value.id}`
      : '/course-trainings';
    const body = {
      type_id: trainingForm.value.type_id,
      start_at: fromDateTimeLocal(trainingForm.value.start_at),
      end_at: fromDateTimeLocal(trainingForm.value.end_at),
      capacity: trainingForm.value.capacity || undefined,
      courses: trainingForm.value.courses,
      ...(selectedTrainingType.value?.online
        ? { url: trainingForm.value.url || undefined }
        : { ground_id: trainingForm.value.ground_id }),
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
  if (!confirm('Удалить тренировку?')) return;
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
          <li class="breadcrumb-item active" aria-current="page">Мероприятия</li>
        </ol>
      </nav>
      <h1 class="mb-3">Мероприятия</h1>
      <div class="card section-card tile fade-in shadow-sm mb-3">
        <div class="card-body p-2">
          <ul
            class="nav nav-pills nav-fill justify-content-between mb-0 tab-selector"
          >
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: activeTab === 'assign' }"
                @click="activeTab = 'assign'"
              >
                Назначение
              </button>
            </li>
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: activeTab === 'courses' }"
                @click="activeTab = 'courses'"
              >
                Курсы
              </button>
            </li>
            <li class="nav-item">
              <button
                class="nav-link"
                :class="{ active: activeTab === 'trainings' }"
                @click="activeTab = 'trainings'"
              >
                Мероприятия
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div v-if="activeTab === 'assign'">
        <div class="card section-card mb-3">
          <div class="card-body">
            <div class="row g-2 mb-3">
              <div class="col-sm-6">
                <input
                  v-model="search"
                  type="search"
                  class="form-control"
                  placeholder="Поиск"
                />
              </div>
            </div>
            <div v-if="loadingUsers" class="text-muted">Загрузка...</div>
            <div v-else-if="error" class="alert alert-danger">{{ error }}</div>
            <div
              v-else-if="users.length"
              class="table-responsive d-none d-sm-block"
            >
              <table class="table admin-table table-striped align-middle mb-0">
                <thead>
                  <tr>
                    <th>ФИО</th>
                    <th class="text-center">Курс</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="u in users" :key="u.user.id">
                    <td>{{ formatName(u.user) }}</td>
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
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else-if="!users.length" class="text-muted mb-0">
              Пользователи не найдены.
            </p>
            <div v-if="users.length" class="d-block d-sm-none">
              <div v-for="u in users" :key="u.user.id" class="card mb-2">
                <div class="card-body">
                  <p class="mb-2 fw-semibold">{{ formatName(u.user) }}</p>
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

        <div ref="courseModalRef" class="modal fade" tabindex="-1">
          <div class="modal-dialog">
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
                  <option
                    v-for="t in teacherOptions"
                    :key="t.id"
                    :value="t.id"
                  >
                    {{ fullName(t) }}
                  </option>
                </select>
              </div>
              <div class="col-md-4">
                <select v-model="filter.course" class="form-select">
                  <option value="">Все курсы</option>
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
                      {{ t.teacher ? fullName(t.teacher) : '—' }}
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
                        aria-label="Редактировать тренировку"
                        @click="openTrainingModal(t)"
                      >
                        <i class="bi bi-pencil" aria-hidden="true"></i>
                      </button>
                      <button
                        class="btn btn-sm btn-danger"
                        aria-label="Удалить тренировку"
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
            <div class="d-sm-none" v-if="upcomingTrainings.length">
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
                    <small class="text-muted d-block" v-if="t.teacher"
                      >{{ fullName(t.teacher) }}</small
                    >
                    <small class="text-muted d-block"
                      >{{ t.courses.map((c) => c.name).join(', ') }}</small
                    >
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
                      aria-label="Редактировать тренировку"
                      @click="openTrainingModal(t)"
                    >
                      <i class="bi bi-pencil" aria-hidden="true"></i>
                    </button>
                    <button
                      class="btn btn-danger"
                      aria-label="Удалить тренировку"
                      @click="deleteTraining(t.id)"
                    >
                      <i class="bi bi-trash" aria-hidden="true"></i>
                    </button>
                  </div>
                </li>
              </ul>
            </div>
            <div
              v-else
              class="d-sm-none mb-3 text-muted text-center"
            >
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
                      {{ t.teacher ? fullName(t.teacher) : '—' }}
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
                        aria-label="Редактировать тренировку"
                        @click="openTrainingModal(t)"
                      >
                        <i class="bi bi-pencil" aria-hidden="true"></i>
                      </button>
                      <button
                        class="btn btn-sm btn-danger"
                        aria-label="Удалить тренировку"
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
            <div class="d-sm-none" v-if="pastTrainings.length">
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
                    <small class="text-muted d-block" v-if="t.teacher"
                      >{{ fullName(t.teacher) }}</small
                    >
                    <small class="text-muted d-block"
                      >{{ t.courses.map((c) => c.name).join(', ') }}</small
                    >
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
                      aria-label="Редактировать тренировку"
                      @click="openTrainingModal(t)"
                    >
                      <i class="bi bi-pencil" aria-hidden="true"></i>
                    </button>
                    <button
                      class="btn btn-danger"
                      aria-label="Удалить тренировку"
                      @click="deleteTraining(t.id)"
                    >
                      <i class="bi bi-trash" aria-hidden="true"></i>
                    </button>
                  </div>
                </li>
              </ul>
            </div>
            <div
              v-else
              class="d-sm-none mb-3 text-muted text-center"
            >
              Нет прошедших мероприятий
            </div>

            <button class="btn btn-brand mt-3" @click="openTrainingModal()">
              Добавить тренировку
            </button>
          </div>
        </div>

        <div ref="trainingModalRef" class="modal fade" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">
                  {{
                    editingTraining
                      ? 'Редактировать тренировку'
                      : 'Новая тренировка'
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
                    v-model.number="trainingForm.type_id"
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
                <div v-if="selectedTrainingType?.online" class="mb-3">
                  <label class="form-label">Ссылка</label>
                  <input
                    v-model="trainingForm.url"
                    type="url"
                    class="form-control"
                  />
                </div>
                <div v-else class="mb-3">
                  <label class="form-label">Площадка</label>
                  <select
                    v-model.number="trainingForm.ground_id"
                    class="form-select"
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
                    v-model="trainingForm.capacity"
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
