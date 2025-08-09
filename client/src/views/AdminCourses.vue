<script setup>
import { ref, onMounted, computed } from 'vue';
import { RouterLink } from 'vue-router';
import Modal from 'bootstrap/js/dist/modal';
import { apiFetch } from '../api.js';

const activeTab = ref('assign');

const users = ref([]); // referees for assignment
const allUsers = ref([]); // for responsible selector
const courses = ref([]);
const selectedUser = ref(null);
const userCourses = ref([]);
const loadingUsers = ref(false);
const userLoading = ref(false);
const error = ref('');
const userError = ref('');
const courseError = ref('');
const newCourseId = ref('');

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

async function loadUsers() {
  loadingUsers.value = true;
  try {
    const data = await apiFetch(
      '/users?role=REFEREE&role=BRIGADE_REFEREE&limit=1000'
    );
    users.value = data.users;
  } catch (e) {
    error.value = e.message;
  } finally {
    loadingUsers.value = false;
  }
}

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

async function selectUser(user) {
  selectedUser.value = user;
  userCourses.value = [];
  userError.value = '';
  userLoading.value = true;
  try {
    const data = await apiFetch(`/course-users/${user.id}`);
    userCourses.value = data.courses;
  } catch (e) {
    userError.value = e.message;
  } finally {
    userLoading.value = false;
  }
}

const availableCourses = computed(() =>
  courses.value.filter((c) => !userCourses.value.find((uc) => uc.id === c.id))
);

async function assignCourse() {
  if (!newCourseId.value) return;
  userLoading.value = true;
  try {
    const data = await apiFetch(`/course-users/${selectedUser.value.id}`, {
      method: 'POST',
      body: JSON.stringify({ course_id: newCourseId.value }),
    });
    userCourses.value = data.courses;
    newCourseId.value = '';
  } catch (e) {
    userError.value = e.message;
  } finally {
    userLoading.value = false;
  }
}

async function removeCourse(courseId) {
  userLoading.value = true;
  try {
    const data = await apiFetch(
      `/course-users/${selectedUser.value.id}/${courseId}`,
      { method: 'DELETE' }
    );
    userCourses.value = data.courses;
  } catch (e) {
    userError.value = e.message;
  } finally {
    userLoading.value = false;
  }
}

function openCourseModal(course = null) {
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
  courseModal = new Modal(courseModalRef.value);
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
          <li class="breadcrumb-item active" aria-current="page">Курсы</li>
        </ol>
      </nav>
      <h1 class="mb-3">Курсы</h1>
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
          </ul>
        </div>
      </div>

      <div v-if="activeTab === 'assign'" class="row">
        <div class="col-md-4 mb-3">
          <div class="card section-card h-100">
            <div class="card-body">
              <h2 class="card-title h6 mb-3">Пользователи</h2>
              <div v-if="loadingUsers" class="text-muted">Загрузка...</div>
              <div v-else-if="error" class="alert alert-danger">
                {{ error }}
              </div>
              <ul v-else class="list-group user-list">
                <li
                  v-for="u in users"
                  :key="u.id"
                  class="list-group-item list-group-item-action"
                  :class="{ active: selectedUser && selectedUser.id === u.id }"
                  @click="selectUser(u)"
                >
                  {{ u.last_name }} {{ u.first_name }} {{ u.patronymic }}
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div class="col-md-8 mb-3" v-if="selectedUser">
          <div class="card section-card h-100">
            <div class="card-body">
              <h2 class="card-title h6 mb-3">
                Курсы пользователя {{ selectedUser.last_name }}
                {{ selectedUser.first_name }}
              </h2>
              <div v-if="userLoading" class="text-muted">Загрузка...</div>
              <div v-else>
                <ul class="list-group mb-3">
                  <li
                    v-for="c in userCourses"
                    :key="c.id"
                    class="list-group-item d-flex justify-content-between align-items-center"
                  >
                    <span>{{ c.name }}</span>
                    <button
                      class="btn btn-sm btn-danger"
                      @click="removeCourse(c.id)"
                    >
                      <i class="bi bi-x-lg" aria-hidden="true"></i>
                    </button>
                  </li>
                  <li
                    v-if="userCourses.length === 0"
                    class="list-group-item text-muted"
                  >
                    Нет назначенных курсов
                  </li>
                </ul>
                <div class="d-flex gap-2">
                  <select
                    v-model="newCourseId"
                    class="form-select"
                    :disabled="userLoading || availableCourses.length === 0"
                  >
                    <option value="">Выберите курс</option>
                    <option
                      v-for="c in availableCourses"
                      :key="c.id"
                      :value="c.id"
                    >
                      {{ c.name }}
                    </option>
                  </select>
                  <button
                    class="btn btn-brand"
                    :disabled="userLoading || !newCourseId"
                    @click="assignCourse"
                  >
                    <span
                      v-if="userLoading"
                      class="spinner-border spinner-border-sm me-2"
                    ></span>
                    Назначить
                  </button>
                </div>
                <div v-if="userError" class="alert alert-danger mt-3">
                  {{ userError }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else>
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
                        @click="openCourseModal(c)"
                      >
                        <i class="bi bi-pencil" aria-hidden="true"></i>
                      </button>
                      <button
                        class="btn btn-sm btn-danger"
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
                    <small class="text-muted" v-if="c.responsible">
                      {{
                        c.responsible.last_name + ' ' + c.responsible.first_name
                      }}
                    </small>
                  </div>
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-primary" @click="openCourseModal(c)">
                      <i class="bi bi-pencil" aria-hidden="true"></i>
                    </button>
                    <button class="btn btn-danger" @click="deleteCourse(c.id)">
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
    </div>
  </div>
</template>

<style scoped>
.section-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 0;
}
.user-list {
  max-height: 60vh;
  overflow-y: auto;
}
.tab-selector {
  gap: 0.5rem;
}
.tab-selector .nav-link {
  border-radius: 0.5rem;
}
</style>
